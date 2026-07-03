-- ================================================================
-- game_engine_final.sql
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run — all statements are idempotent.
-- ================================================================

-- ── 1. Create game_rounds (or add missing columns if it exists) ──
-- First: fix any NOT NULL constraints on legacy columns that block our INSERTs
ALTER TABLE public.game_rounds ALTER COLUMN round_id DROP NOT NULL;
ALTER TABLE public.game_rounds ALTER COLUMN round_id SET DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.game_rounds (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type      TEXT          NOT NULL DEFAULT 'wingo',
  mode           TEXT          NOT NULL DEFAULT '30s',
  period         TEXT          NOT NULL,
  started_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ends_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  status         TEXT          NOT NULL DEFAULT 'active',
  target_result  TEXT          NULL,
  result_number  INT           NULL,
  result_size    TEXT          NULL,
  result_color   TEXT          NULL,
  total_big      NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_small    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT game_rounds_period_key UNIQUE (period)
);

-- Safe column additions (no-op if already present)
ALTER TABLE public.game_rounds
  ADD COLUMN IF NOT EXISTS game_type     TEXT          NOT NULL DEFAULT 'wingo',
  ADD COLUMN IF NOT EXISTS mode          TEXT          NOT NULL DEFAULT '30s',
  ADD COLUMN IF NOT EXISTS period        TEXT          NULL,
  ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ends_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status        TEXT          NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS target_result TEXT          NULL,
  ADD COLUMN IF NOT EXISTS result_number INT           NULL,
  ADD COLUMN IF NOT EXISTS result_size   TEXT          NULL,
  ADD COLUMN IF NOT EXISTS result_color  TEXT          NULL,
  ADD COLUMN IF NOT EXISTS total_big     NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_small   NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- Add unique constraint if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_rounds_period_key'
  ) THEN
    ALTER TABLE public.game_rounds ADD CONSTRAINT game_rounds_period_key UNIQUE (period);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gr_game_type_status ON public.game_rounds (game_type, status);
CREATE INDEX IF NOT EXISTS idx_gr_period           ON public.game_rounds (period);
CREATE INDEX IF NOT EXISTS idx_gr_ends_at          ON public.game_rounds (ends_at);

-- ── 2. betting_history ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.betting_history (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round_id       UUID          NULL REFERENCES public.game_rounds(id) ON DELETE SET NULL,
  period         TEXT          NOT NULL,
  game_type      TEXT          NOT NULL DEFAULT 'wingo',
  mode           TEXT          NOT NULL DEFAULT '30s',
  bet_type       TEXT          NOT NULL,
  bet_value      TEXT          NOT NULL,
  amount         NUMERIC(18,2) NOT NULL,
  win_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_win         BOOLEAN       NOT NULL DEFAULT FALSE,
  status         TEXT          NOT NULL DEFAULT 'pending',
  result_number  INT           NULL,
  result_size    TEXT          NULL,
  result_color   TEXT          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bh_user_id    ON public.betting_history (user_id);
CREATE INDEX IF NOT EXISTS idx_bh_period     ON public.betting_history (period);
CREATE INDEX IF NOT EXISTS idx_bh_created_at ON public.betting_history (created_at);

-- ── 3. Trigger: sync total_big / total_small on bet insert ────────
CREATE OR REPLACE FUNCTION public.fn_update_round_bet_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.round_id IS NOT NULL THEN
    UPDATE public.game_rounds
    SET
      total_big   = (SELECT COALESCE(SUM(amount),0) FROM public.betting_history
                     WHERE round_id = NEW.round_id AND bet_type = 'size' AND bet_value = 'Big'),
      total_small = (SELECT COALESCE(SUM(amount),0) FROM public.betting_history
                     WHERE round_id = NEW.round_id AND bet_type = 'size' AND bet_value = 'Small')
    WHERE id = NEW.round_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_round_bet_totals ON public.betting_history;
CREATE TRIGGER trg_update_round_bet_totals
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_round_bet_totals();

-- ── 4. Core tick function (24/7 server loop) ──────────────────────
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
      WHEN '30s' THEN 30
      WHEN '1m'  THEN 60
      WHEN '3m'  THEN 180
      ELSE            300
    END;
    v_prefix := CASE v_mode
      WHEN '30s' THEN '1000'
      WHEN '1m'  THEN '2000'
      WHEN '3m'  THEN '3000'
      ELSE            '4000'
    END;

    -- a) Resolve expired active rounds
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode
        AND status = 'active' AND ends_at <= NOW()
    LOOP
      v_forced := v_round.target_result;

      -- Deterministic RNG matching client JS hash
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

      -- Apply admin override
      IF v_forced = 'BIG' AND v_size <> 'Big' THEN
        v_num   := 5 + (v_num % 5);
        v_size  := 'Big';
        v_color := CASE WHEN v_num = 5 THEN 'violet' WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size <> 'Small' THEN
        v_num   := v_num % 5;
        v_size  := 'Small';
        v_color := CASE WHEN v_num = 0 THEN 'violet' WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced LIKE 'NUM:%' THEN
        v_num   := SUBSTRING(v_forced FROM 5)::INT;
        v_size  := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
        v_color := CASE WHEN v_num IN (0,5) THEN 'violet' WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      END IF;

      UPDATE public.game_rounds
      SET status = 'completed', result_number = v_num,
          result_size = v_size, result_color = v_color
      WHERE id = v_round.id;
    END LOOP;

    -- b) Create next active round if none exists
    -- round_num = floor(secs/interval) — NO +1, matches client JS exactly
    -- ends_at   = UTC day start + (round_num + 1) * interval
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active'
    ) THEN
      v_round_num := v_secs / v_interval;  -- integer division, no +1
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      -- ends_at = start of UTC day + (round_num + 1) * interval seconds
      v_ends_at   := DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                   + (((v_round_num + 1) * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, NOW(), v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- ── 5. RPCs ───────────────────────────────────────────────────────

-- get_active_round: used by admin dashboard and WinGoView client
CREATE OR REPLACE FUNCTION public.get_active_round(p_game_type TEXT, p_mode TEXT)
RETURNS TABLE(
  id UUID, period TEXT, ends_at TIMESTAMPTZ,
  target_result TEXT, total_big NUMERIC, total_small NUMERIC, status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT gr.id, gr.period, gr.ends_at, gr.target_result,
           gr.total_big, gr.total_small, gr.status
    FROM public.game_rounds gr
    WHERE gr.game_type = p_game_type
      AND gr.mode      = p_mode
      AND gr.status    = 'active'
    ORDER BY gr.started_at DESC
    LIMIT 1;
END;
$$;

-- set_round_target: admin forces BIG/SMALL
CREATE OR REPLACE FUNCTION public.set_round_target(p_period TEXT, p_target_result TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET target_result = p_target_result
  WHERE period = p_period AND status = 'active';
END;
$$;

-- complete_round: client fallback after local resolution
CREATE OR REPLACE FUNCTION public.complete_round(
  p_period TEXT, p_number INT, p_size TEXT, p_color TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET status = 'completed', result_number = p_number,
      result_size = p_size, result_color = p_color
  WHERE period = p_period AND status = 'active';
END;
$$;

-- ── 6. RLS ────────────────────────────────────────────────────────
ALTER TABLE public.game_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read game_rounds"       ON public.game_rounds;
DROP POLICY IF EXISTS "Service role all game_rounds"  ON public.game_rounds;
CREATE POLICY "Public read game_rounds"
  ON public.game_rounds FOR SELECT USING (true);
CREATE POLICY "Service role all game_rounds"
  ON public.game_rounds FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own betting_history"   ON public.betting_history;
DROP POLICY IF EXISTS "Users insert own betting_history" ON public.betting_history;
DROP POLICY IF EXISTS "Service role all betting_history" ON public.betting_history;
CREATE POLICY "Users read own betting_history"
  ON public.betting_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own betting_history"
  ON public.betting_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role all betting_history"
  ON public.betting_history FOR ALL USING (auth.role() = 'service_role');

-- ── 7. Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_tick_game_rounds()                 TO postgres;
GRANT EXECUTE ON FUNCTION public.get_active_round(TEXT, TEXT)          TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_round_target(TEXT, TEXT)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_round(TEXT, INT, TEXT, TEXT) TO authenticated, service_role;

-- ── 8. pg_cron (requires pg_cron extension enabled in Dashboard) ──
-- Dashboard → Database → Extensions → search "pg_cron" → Enable
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname IN ('wingo-tick-a','wingo-tick-b','cleanup-bh','cleanup-gr');

    PERFORM cron.schedule('wingo-tick-a', '* * * * *',
      'SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('wingo-tick-b', '* * * * *',
      'SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('cleanup-bh', '0 3 * * *',
      'DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL ''7 days'';');
    PERFORM cron.schedule('cleanup-gr', '0 4 * * *',
      'DELETE FROM public.game_rounds WHERE status = ''completed'' AND created_at < NOW() - INTERVAL ''30 days'';');
  END IF;
END $$;

-- ── 9. SEED: create active rounds RIGHT NOW ───────────────────────
-- This runs immediately so the admin dashboard shows live rounds
-- the moment this script finishes — no pg_cron needed to bootstrap.
SELECT public.fn_tick_game_rounds();

-- Verify: should show 4 rows (one per mode) with status='active'
SELECT game_type, mode, period, status, ends_at
FROM public.game_rounds
WHERE status = 'active'
ORDER BY mode;
