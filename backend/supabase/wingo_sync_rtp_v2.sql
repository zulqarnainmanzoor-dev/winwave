-- ================================================================
-- wingo_sync_rtp_v2.sql
-- Run ONCE in Supabase SQL Editor.
-- Covers:
--   1. get_server_time()          — frontend sync RPC
--   2. get_active_round_v2()      — returns server-computed period + timeLeft
--   3. RTP phase columns on users
--   4. fn_compute_rtp_phase()     — pure deterministic phase logic
--   5. get_user_rtp_phase()       — RPC called by client after each bet
--   6. fn_resolve_round_with_rtp()— server resolves result with RTP applied
--   7. fn_tick_game_rounds()      — hardened tick (idempotent, no +1)
--   8. pg_cron jobs               — wingo-tick-a/b, cleanup
-- ================================================================

-- ── 1. Server-time RPC ───────────────────────────────────────────
-- Returns UTC epoch seconds so the client can compute exact drift.
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'utc_epoch_ms',  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
                   + EXTRACT(MILLISECONDS FROM NOW())::INT % 1000,
    'utc_iso',       TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon, service_role;

-- ── 2. get_active_round_v2 ───────────────────────────────────────
-- Returns the authoritative period string + seconds remaining
-- computed entirely from server UTC — no client math needed.
CREATE OR REPLACE FUNCTION public.get_active_round_v2(p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_interval  INT;
  v_prefix    TEXT;
  v_now       TIMESTAMPTZ := NOW() AT TIME ZONE 'UTC';
  v_secs      INT;
  v_round_num INT;
  v_period    TEXT;
  v_ends_at   TIMESTAMPTZ;
  v_time_left INT;
  v_row       RECORD;
BEGIN
  v_interval := CASE p_mode
    WHEN '30s' THEN 30  WHEN '1m' THEN 60
    WHEN '3m'  THEN 180 ELSE 300
  END;
  v_prefix := CASE p_mode
    WHEN '30s' THEN '1000' WHEN '1m' THEN '2000'
    WHEN '3m'  THEN '3000' ELSE '4000'
  END;

  v_secs      := EXTRACT(HOUR   FROM v_now)::INT * 3600
               + EXTRACT(MINUTE FROM v_now)::INT * 60
               + EXTRACT(SECOND FROM v_now)::INT;
  v_round_num := v_secs / v_interval;   -- integer division, NO +1
  v_period    := TO_CHAR(v_now, 'YYYYMMDD') || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
  v_ends_at   := DATE_TRUNC('day', v_now) + (((v_round_num + 1) * v_interval) || ' seconds')::INTERVAL;
  v_time_left := GREATEST(0, EXTRACT(EPOCH FROM (v_ends_at - NOW()))::INT);

  -- Also pull DB row for target_result / admin override
  SELECT gr.id, gr.target_result, gr.total_big, gr.total_small
  INTO v_row
  FROM public.game_rounds gr
  WHERE gr.game_type = 'wingo' AND gr.mode = p_mode AND gr.period = v_period
  LIMIT 1;

  RETURN jsonb_build_object(
    'period',        v_period,
    'mode',          p_mode,
    'time_left',     v_time_left,
    'ends_at',       TO_CHAR(v_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'round_id',      v_row.id,
    'target_result', v_row.target_result,
    'total_big',     COALESCE(v_row.total_big,  0),
    'total_small',   COALESCE(v_row.total_small, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_round_v2(TEXT) TO authenticated, anon, service_role;

-- ── 3. RTP tracking columns on users ────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_deposit  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_winning  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bets_count INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rtp_phase      TEXT         NOT NULL DEFAULT 'honeymoon';

-- ── 4. fn_compute_rtp_phase ──────────────────────────────────────
-- Pure function: given stats, returns the correct phase.
-- Called by both the trigger and the RPC.
--
-- Phase rules:
--   honeymoon      → total_bets_count <= 20 OR total_winning < total_deposit * 0.60
--   controlled_loss→ total_winning > total_deposit * 1.10  (winning > 110% of deposit)
--   normal         → everything else (house edge applies)
CREATE OR REPLACE FUNCTION public.fn_compute_rtp_phase(
  p_total_deposit   NUMERIC,
  p_total_winning   NUMERIC,
  p_total_bets_count INT
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_total_bets_count <= 20
      OR p_total_winning < p_total_deposit * 0.60
    THEN 'honeymoon'
    WHEN p_total_winning > p_total_deposit * 1.10
    THEN 'controlled_loss'
    ELSE 'normal'
  END;
$$;

-- ── 5. get_user_rtp_phase RPC ────────────────────────────────────
-- Called by WinGoView after every bet insert.
CREATE OR REPLACE FUNCTION public.get_user_rtp_phase(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit  NUMERIC;
  v_winning  NUMERIC;
  v_bets     INT;
  v_phase    TEXT;
BEGIN
  SELECT
    COALESCE(total_deposit, 0),
    COALESCE(total_winning, 0),
    COALESCE(total_bets_count, 0)
  INTO v_deposit, v_winning, v_bets
  FROM public.users WHERE id = p_user_id;

  v_phase := public.fn_compute_rtp_phase(v_deposit, v_winning, v_bets);

  -- Persist phase so admin dashboard can see it
  UPDATE public.users SET rtp_phase = v_phase WHERE id = p_user_id;

  RETURN v_phase;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rtp_phase(UUID) TO authenticated, service_role;

-- ── 6. Trigger: update RTP stats on bet insert ───────────────────
-- Increments total_bets_count on every new bet.
-- total_winning is updated when a bet is resolved (see fn_resolve_round_with_rtp).
CREATE OR REPLACE FUNCTION public.fn_update_rtp_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit NUMERIC;
  v_winning NUMERIC;
  v_bets    INT;
BEGIN
  UPDATE public.users
  SET total_bets_count = total_bets_count + 1
  WHERE id = NEW.user_id
  RETURNING total_deposit, total_winning, total_bets_count
  INTO v_deposit, v_winning, v_bets;

  UPDATE public.users
  SET rtp_phase = public.fn_compute_rtp_phase(v_deposit, v_winning, v_bets)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rtp_phase ON public.betting_history;
CREATE TRIGGER trg_update_rtp_phase
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_rtp_phase();

-- ── 7. fn_resolve_round_with_rtp ─────────────────────────────────
-- Called by pg_cron tick when a round expires.
-- Applies RTP phase per-user to determine each bet's outcome,
-- then credits winnings and updates total_winning.
--
-- Algorithm:
--   honeymoon      → 50% chance to force a WIN for the user's bet type
--   normal         → use deterministic RNG result as-is (house edge ~4%)
--   controlled_loss→ force result OPPOSITE to user's bet type
--
-- Admin target_result always takes priority over RTP.
CREATE OR REPLACE FUNCTION public.fn_resolve_round_with_rtp(p_round_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round      RECORD;
  v_bet        RECORD;
  v_phase      TEXT;
  v_result_num INT;
  v_result_size TEXT;
  v_result_color TEXT;
  v_is_win     BOOLEAN;
  v_win_amount NUMERIC;
  v_forced_num INT;
  v_forced_size TEXT;
  v_forced_color TEXT;
BEGIN
  SELECT * INTO v_round FROM public.game_rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.status <> 'completed' THEN RETURN; END IF;

  v_result_num   := v_round.result_number;
  v_result_size  := v_round.result_size;
  v_result_color := v_round.result_color;

  FOR v_bet IN
    SELECT bh.*, u.rtp_phase
    FROM public.betting_history bh
    JOIN public.users u ON u.id = bh.user_id
    WHERE bh.round_id = p_round_id AND bh.status = 'pending'
  LOOP
    v_phase := v_bet.rtp_phase;

    -- Admin override takes full priority
    IF v_round.target_result IS NOT NULL THEN
      v_phase := 'normal';  -- use the already-computed result as-is
    END IF;

    -- ── RTP Phase Logic ──────────────────────────────────────────
    -- Start with the deterministic round result
    v_forced_num   := v_result_num;
    v_forced_size  := v_result_size;
    v_forced_color := v_result_color;

    IF v_phase = 'honeymoon' AND random() < 0.50 THEN
      -- Force a WIN for this user's bet type
      CASE v_bet.bet_type
        WHEN 'size' THEN
          IF v_bet.bet_value = 'Big' THEN
            v_forced_num := 5 + (FLOOR(random()*5))::INT;  -- 5-9
          ELSE
            v_forced_num := (FLOOR(random()*5))::INT;       -- 0-4
          END IF;
          v_forced_size  := v_bet.bet_value;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        WHEN 'color' THEN
          CASE v_bet.bet_value
            WHEN 'Green'  THEN v_forced_num := (ARRAY[1,3,7,9])[1 + (FLOOR(random()*4))::INT];
            WHEN 'Red'    THEN v_forced_num := (ARRAY[2,4,6,8])[1 + (FLOOR(random()*4))::INT];
            WHEN 'Violet' THEN v_forced_num := CASE WHEN random() < 0.5 THEN 0 ELSE 5 END;
            ELSE NULL;
          END CASE;
          v_forced_size  := CASE WHEN v_forced_num >= 5 THEN 'Big' ELSE 'Small' END;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        WHEN 'number' THEN
          v_forced_num   := v_bet.bet_value::INT;
          v_forced_size  := CASE WHEN v_forced_num >= 5 THEN 'Big' ELSE 'Small' END;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        ELSE NULL;
      END CASE;

    ELSIF v_phase = 'controlled_loss' THEN
      -- Force a LOSS for this user's bet type
      CASE v_bet.bet_type
        WHEN 'size' THEN
          -- Give opposite size
          IF v_bet.bet_value = 'Big' THEN
            v_forced_num := (FLOOR(random()*5))::INT;   -- 0-4 = Small
          ELSE
            v_forced_num := 5 + (FLOOR(random()*5))::INT; -- 5-9 = Big
          END IF;
          v_forced_size  := CASE WHEN v_forced_num >= 5 THEN 'Big' ELSE 'Small' END;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        WHEN 'color' THEN
          CASE v_bet.bet_value
            WHEN 'Green'  THEN v_forced_num := (ARRAY[2,4,6,8])[1 + (FLOOR(random()*4))::INT];
            WHEN 'Red'    THEN v_forced_num := (ARRAY[1,3,7,9])[1 + (FLOOR(random()*4))::INT];
            WHEN 'Violet' THEN v_forced_num := (ARRAY[1,2,3,4,6,7,8,9])[1 + (FLOOR(random()*8))::INT];
            ELSE NULL;
          END CASE;
          v_forced_size  := CASE WHEN v_forced_num >= 5 THEN 'Big' ELSE 'Small' END;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        WHEN 'number' THEN
          -- Pick any number except the one bet on
          v_forced_num := (v_bet.bet_value::INT + 1 + (FLOOR(random()*9))::INT) % 10;
          v_forced_size  := CASE WHEN v_forced_num >= 5 THEN 'Big' ELSE 'Small' END;
          v_forced_color := CASE WHEN v_forced_num IN (0,5) THEN 'violet'
                                 WHEN v_forced_num % 2 = 0  THEN 'red'
                                 ELSE 'green' END;
        ELSE NULL;
      END CASE;
    END IF;
    -- 'normal' phase: v_forced_* stays as the deterministic round result

    -- ── Determine win/loss ───────────────────────────────────────
    v_is_win := FALSE;
    CASE v_bet.bet_type
      WHEN 'size'   THEN v_is_win := (v_bet.bet_value = v_forced_size);
      WHEN 'number' THEN v_is_win := (v_bet.bet_value::INT = v_forced_num);
      WHEN 'color'  THEN
        v_is_win := (
          (v_bet.bet_value = 'Green'  AND (v_forced_color = 'green'  OR v_forced_num = 5)) OR
          (v_bet.bet_value = 'Red'    AND (v_forced_color = 'red'    OR v_forced_num = 0)) OR
          (v_bet.bet_value = 'Violet' AND v_forced_color = 'violet')
        );
      ELSE NULL;
    END CASE;

    v_win_amount := CASE
      WHEN v_is_win AND v_bet.bet_type = 'number' THEN v_bet.amount * 9.0
      WHEN v_is_win                               THEN v_bet.amount * 1.96
      ELSE 0
    END;

    -- ── Update bet record ────────────────────────────────────────
    UPDATE public.betting_history
    SET
      status        = CASE WHEN v_is_win THEN 'win' ELSE 'lose' END,
      is_win        = v_is_win,
      win_amount    = v_win_amount,
      result_number = v_forced_num,
      result_size   = v_forced_size,
      result_color  = v_forced_color
    WHERE id = v_bet.id;

    -- ── Credit winnings + update total_winning ───────────────────
    IF v_is_win AND v_win_amount > 0 THEN
      UPDATE public.users
      SET
        main_balance  = main_balance  + v_win_amount,
        total_winning = total_winning + v_win_amount,
        rtp_phase     = public.fn_compute_rtp_phase(total_deposit, total_winning + v_win_amount, total_bets_count)
      WHERE id = v_bet.user_id;
    END IF;

  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_round_with_rtp(UUID) TO service_role;

-- ── 8. Hardened fn_tick_game_rounds ──────────────────────────────
-- FIX: Use NUMERIC for all intermediate hash steps to avoid BIGINT
-- overflow before the 0xFFFFFFFF mask is applied.
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
  -- Use NUMERIC to avoid BIGINT overflow in intermediate multiply steps
  v_hash      NUMERIC;
  v_t         NUMERIC;
  v_rand      FLOAT8;
  v_i         INT;
  v_char      INT;
  v_mask      NUMERIC := 4294967295;  -- 0xFFFFFFFF
BEGIN
  v_secs := EXTRACT(HOUR   FROM v_now)::INT * 3600
          + EXTRACT(MINUTE FROM v_now)::INT * 60
          + EXTRACT(SECOND FROM v_now)::INT;

  FOREACH v_mode IN ARRAY ARRAY['30s','1m','3m','5m'] LOOP
    v_interval := CASE v_mode
      WHEN '30s' THEN 30  WHEN '1m' THEN 60
      WHEN '3m'  THEN 180 ELSE 300
    END;
    v_prefix := CASE v_mode
      WHEN '30s' THEN '1000' WHEN '1m' THEN '2000'
      WHEN '3m'  THEN '3000' ELSE '4000'
    END;

    -- a) Resolve ALL expired active rounds for this mode
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode
        AND status = 'active'
        AND ends_at <= NOW()
      ORDER BY ends_at ASC
    LOOP
      v_forced := v_round.target_result;

      -- Deterministic RNG matching client JS getResultForPeriod.
      -- Rule: >> and # (XOR) require BIGINT on BOTH sides.
      -- All intermediate results are kept in NUMERIC via MOD to avoid overflow,
      -- then cast to BIGINT only at the moment a bitwise op is needed.
      v_hash := 0;
      FOR v_i IN 1..LENGTH(v_round.period) LOOP
        v_char := ASCII(SUBSTRING(v_round.period, v_i, 1));
        v_hash := MOD(31 * v_hash + v_char, v_mask + 1);
        IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
      END LOOP;
      IF v_hash < 0 THEN v_hash := v_hash + 4294967296; END IF;

      -- Step 1: t = (hash + 0x6d2b79f5) & 0xFFFFFFFF
      v_t := MOD(v_hash + 1834730485, v_mask + 1);

      -- Step 2: t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
      -- Cast v_t to BIGINT for every bitwise operand
      v_t := MOD(
               MOD(v_t::BIGINT # (v_t::BIGINT >> 15), v_mask + 1) *
               MOD(v_t::BIGINT | 1::BIGINT,            v_mask + 1),
             v_mask + 1);

      -- Step 3: t = (t ^ (t + (t ^ (t >> 7)) * (t | 61))) & 0xFFFFFFFF
      v_t := MOD(
               v_t::BIGINT #
               MOD(
                 v_t +
                 MOD(
                   MOD(v_t::BIGINT # (v_t::BIGINT >> 7), v_mask + 1) *
                   MOD(v_t::BIGINT | 61::BIGINT,          v_mask + 1),
                 v_mask + 1),
               v_mask + 1)::BIGINT,
             v_mask + 1);

      -- Step 4: t = (t ^ (t >> 14)) & 0xFFFFFFFF
      v_t    := MOD(v_t::BIGINT # (v_t::BIGINT >> 14), v_mask + 1);
      v_rand := v_t::FLOAT8 / 4294967296.0;
      v_num  := FLOOR(v_rand * 10)::INT;
      v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
      v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                      WHEN v_num % 2 = 0  THEN 'red' ELSE 'green' END;

      -- Admin override
      IF v_forced = 'BIG' AND v_size <> 'Big' THEN
        v_num := 5 + (v_num % 5); v_size := 'Big';
        v_color := CASE WHEN v_num=5 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size <> 'Small' THEN
        v_num := v_num % 5; v_size := 'Small';
        v_color := CASE WHEN v_num=0 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced LIKE 'NUM:%' THEN
        v_num := SUBSTRING(v_forced FROM 5)::INT;
        v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
        v_color := CASE WHEN v_num IN (0,5) THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      END IF;

      -- Mark round completed with result
      UPDATE public.game_rounds
      SET status = 'completed', result_number = v_num,
          result_size = v_size, result_color = v_color
      WHERE id = v_round.id;

      -- Resolve all bets for this round with RTP logic
      PERFORM public.fn_resolve_round_with_rtp(v_round.id);
    END LOOP;

    -- b) Create next active round if none exists for this mode
    --    Period = floor(secs / interval) — NO +1
    --    ends_at = UTC day start + (round_num + 1) * interval
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active'
    ) THEN
      v_round_num := v_secs / v_interval;
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      v_ends_at   := DATE_TRUNC('day', v_now) AT TIME ZONE 'UTC'
                   + (((v_round_num + 1) * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, NOW(), v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_tick_game_rounds() TO postgres, service_role;

-- ── 9. pg_cron — reschedule ──────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('wingo-tick-a','wingo-tick-b','cleanup-bh','cleanup-gr');

    -- Tick at :00 of every minute
    PERFORM cron.schedule('wingo-tick-a', '* * * * *',
      'SELECT public.fn_tick_game_rounds();');
    -- Tick at :30 of every minute (covers 30s mode)
    PERFORM cron.schedule('wingo-tick-b', '* * * * *',
      'SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds();');
    -- Nightly cleanup
    PERFORM cron.schedule('cleanup-bh', '0 3 * * *',
      'DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL ''30 days'';');
    PERFORM cron.schedule('cleanup-gr', '0 4 * * *',
      'DELETE FROM public.game_rounds WHERE status = ''completed'' AND created_at < NOW() - INTERVAL ''60 days'';');
  END IF;
END $$;

-- ── 10. Seed active rounds immediately ───────────────────────────
SELECT public.fn_tick_game_rounds();

-- Verify
SELECT mode, period, status,
       TO_CHAR(ends_at AT TIME ZONE 'UTC', 'HH24:MI:SS') AS ends_utc,
       EXTRACT(EPOCH FROM (ends_at - NOW()))::INT         AS secs_left
FROM public.game_rounds
WHERE status = 'active'
ORDER BY mode;
