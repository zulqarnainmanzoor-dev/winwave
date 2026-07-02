-- ================================================================
-- game_engine_profit_patch.sql
-- Run in Supabase SQL Editor after game_engine_final.sql
-- Adds: profit margin engine, set_result_by_chat RPC,
--       fixes force_big/force_small override logic
-- ================================================================

-- ── 1. Add profit tracking columns to game_rounds ────────────────
ALTER TABLE public.game_rounds
  ADD COLUMN IF NOT EXISTS total_pool       NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_payout     NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_profit  NUMERIC(18,2) NOT NULL DEFAULT 0;

-- ── 2. Profit Margin Engine ───────────────────────────────────────
-- Called after a round completes. Allocates 40% for payouts, 60% platform profit.
CREATE OR REPLACE FUNCTION public.fn_settle_round_profit(p_round_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pool   NUMERIC(18,2);
  v_payout NUMERIC(18,2);
  v_profit NUMERIC(18,2);
BEGIN
  SELECT COALESCE(total_big + total_small, 0)
    INTO v_pool
    FROM public.game_rounds
   WHERE id = p_round_id;

  v_payout := ROUND(v_pool * 0.40, 2); -- 40% for payouts (agent commissions + member withdrawals)
  v_profit := v_pool - v_payout;        -- 60% platform profit

  UPDATE public.game_rounds
     SET total_pool      = v_pool,
         total_payout    = v_payout,
         platform_profit = v_profit
   WHERE id = p_round_id;
END;
$$;

-- ── 3. Patch fn_tick_game_rounds: fix force override + call profit settle ──
-- The bug: when forced='BIG', v_num % 5 can produce 0 (violet/small boundary).
-- Fix: use explicit safe ranges and call fn_settle_round_profit after update.
CREATE OR REPLACE FUNCTION public.fn_tick_game_rounds()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode      TEXT;
  v_interval  INT;
  v_prefix    TEXT;
  v_now       TIMESTAMPTZ := NOW() AT TIME ZONE 'UTC';
  v_date_str  TEXT        := TO_CHAR(v_now, 'YYYYMMDD');
  v_secs      INT;
  v_round_num INT;
  v_period    TEXT;
  v_ends_at   TIMESTAMPTZ;
  v_round     RECORD;
  v_num       INT;
  v_size      TEXT;
  v_color     TEXT;
  v_forced    TEXT;
  v_hash      BIGINT;
  v_t         BIGINT;
  v_rand      FLOAT8;
  v_i         INT;
  v_char      INT;
BEGIN
  v_secs := EXTRACT(HOUR   FROM v_now)::INT * 3600
          + EXTRACT(MINUTE FROM v_now)::INT * 60
          + EXTRACT(SECOND FROM v_now)::INT;

  FOREACH v_mode IN ARRAY ARRAY['30s','1m','3m','5m'] LOOP
    v_interval := CASE v_mode
      WHEN '30s' THEN 30  WHEN '1m' THEN 60
      WHEN '3m'  THEN 180 ELSE           300
    END;
    v_prefix := CASE v_mode
      WHEN '30s' THEN '1000' WHEN '1m' THEN '2000'
      WHEN '3m'  THEN '3000' ELSE           '4000'
    END;

    -- a) Resolve expired active rounds
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode
        AND status = 'active' AND ends_at <= NOW()
    LOOP
      v_forced := v_round.target_result; -- 'BIG' | 'SMALL' | NULL

      -- Deterministic RNG (matches client JS hash)
      v_hash := 0;
      FOR v_i IN 1..LENGTH(v_round.period) LOOP
        v_char := ASCII(SUBSTRING(v_round.period, v_i, 1));
        v_hash := ((31 * v_hash + v_char) & x'FFFFFFFF'::BIGINT);
        IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
      END LOOP;
      v_t := (v_hash + 1834730485) & x'FFFFFFFF'::BIGINT;
      v_t := ((v_t # (v_t >> 15)) * ((v_t | 1) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t := (v_t # (v_t + ((v_t # (v_t >> 7)) * ((v_t | 61) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t := (v_t # (v_t >> 14)) & x'FFFFFFFF'::BIGINT;
      v_rand := v_t::FLOAT8 / 4294967296.0;
      v_num  := FLOOR(v_rand * 10)::INT;
      v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
      v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                      WHEN v_num % 2 = 0  THEN 'red'
                      ELSE 'green' END;

      -- ── FIXED Admin override: strictly honor target_result ──────
      -- Force BIG    → pick from {6,7,8,9}
      -- Force SMALL  → pick from {1,2,3,4}
      -- Force NUM:X  → exact number from chat command
      IF v_forced = 'BIG' THEN
        v_num   := 6 + (ABS(v_hash) % 4);  -- 6,7,8,9
        v_size  := 'Big';
        v_color := CASE WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' THEN
        v_num   := 1 + (ABS(v_hash) % 4);  -- 1,2,3,4
        v_size  := 'Small';
        v_color := CASE WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced LIKE 'NUM:%' THEN
        v_num   := SUBSTRING(v_forced FROM 5)::INT;  -- exact digit 0-9
        v_size  := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
        v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                        WHEN v_num % 2 = 0  THEN 'red'
                        ELSE 'green' END;
      END IF;

      UPDATE public.game_rounds
         SET status        = 'completed',
             result_number = v_num,
             result_size   = v_size,
             result_color  = v_color
       WHERE id = v_round.id;

      -- Settle profit margin for this round
      PERFORM public.fn_settle_round_profit(v_round.id);
    END LOOP;

    -- b) Create next active round if none exists
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active'
    ) THEN
      v_round_num := (v_secs / v_interval) + 1;
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      v_ends_at   := DATE_TRUNC('day', v_now)
                   + ((v_round_num * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, NOW(), v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ── 4. set_result_by_chat RPC ─────────────────────────────────────
-- Allows admin to force round outcome via chat command.
-- result_type: 'big' | 'small' (case-insensitive)
CREATE OR REPLACE FUNCTION public.set_result_by_chat(
  p_admin_id   UUID,
  p_result_type TEXT   -- 'big' or 'small'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target  TEXT;
  v_round   RECORD;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_id AND role IN ('admin', 'superadmin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_target := UPPER(TRIM(p_result_type)); -- 'BIG' or 'SMALL'

  IF v_target NOT IN ('BIG', 'SMALL') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result_type. Use ''big'' or ''small''.');
  END IF;

  -- Apply to all active wingo rounds (all modes)
  UPDATE public.game_rounds
     SET target_result = v_target
   WHERE game_type = 'wingo' AND status = 'active'
  RETURNING id, period, mode INTO v_round;

  RETURN jsonb_build_object(
    'success', true,
    'target_result', v_target,
    'applied_to_period', v_round.period,
    'mode', v_round.mode
  );
END;
$$;

-- ── 5. get_round_profit RPC (admin dashboard) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_round_profit(p_limit INT DEFAULT 10)
RETURNS TABLE(
  period TEXT, mode TEXT, total_pool NUMERIC, total_payout NUMERIC,
  platform_profit NUMERIC, result_size TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT gr.period, gr.mode, gr.total_pool, gr.total_payout,
           gr.platform_profit, gr.result_size, gr.created_at
      FROM public.game_rounds gr
     WHERE gr.status = 'completed'
     ORDER BY gr.created_at DESC
     LIMIT p_limit;
END;
$$;

-- ── 6. Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_settle_round_profit(UUID)          TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.set_result_by_chat(UUID, TEXT)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_round_profit(INT)                 TO authenticated, service_role;
