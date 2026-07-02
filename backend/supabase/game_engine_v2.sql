-- ================================================================
-- FILE: backend/supabase/game_engine_v2.sql
-- SAFE MIGRATION — adds columns without dropping existing data,
-- then installs the 24/7 server-side round loop via pg_cron.
--
-- Run order:
--   1. Paste into Supabase SQL Editor and execute.
--   2. Enable pg_cron in Dashboard → Database → Extensions.
--   3. The cron job fires every 30 s and self-manages all modes.
-- ================================================================

-- ── SECTION 1: Safe schema migration ────────────────────────────
-- Add any missing columns to game_rounds without touching existing rows.

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

-- Unique constraint on period (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_rounds_period_key'
  ) THEN
    ALTER TABLE public.game_rounds ADD CONSTRAINT game_rounds_period_key UNIQUE (period);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_rounds_game_type_status ON public.game_rounds (game_type, status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_period           ON public.game_rounds (period);
CREATE INDEX IF NOT EXISTS idx_game_rounds_ends_at          ON public.game_rounds (ends_at);

-- ── SECTION 2: betting_history (safe create) ─────────────────────
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

-- ── SECTION 3: Trigger — keep total_big/total_small in sync ──────
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

-- ── SECTION 4: Core helper — deterministic RNG ───────────────────
-- Mirrors the client-side getResultForPeriod() hash so results match.
CREATE OR REPLACE FUNCTION public.fn_result_for_period(p_period TEXT)
RETURNS TABLE(result_number INT, result_size TEXT, result_color TEXT)
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash   BIGINT := 0;
  v_i      INT;
  v_char   INT;
  v_t      BIGINT;
  v_rand   FLOAT8;
  v_num    INT;
BEGIN
  -- Replicate JS: hash = (Math.imul(31, hash) + charCode) | 0
  FOR v_i IN 1..LENGTH(p_period) LOOP
    v_char := ASCII(SUBSTRING(p_period, v_i, 1));
    v_hash := ((31 * v_hash + v_char) & x'FFFFFFFF'::BIGINT);
    -- Simulate signed 32-bit overflow
    IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
  END LOOP;

  -- hash += 0x6d2b79f5
  v_t := (v_hash + 1834730485) & x'FFFFFFFF'::BIGINT;
  -- t = Math.imul(t ^ (t >>> 15), t | 1)
  v_t := ((v_t # (v_t >> 15)) * ((v_t | 1) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
  -- t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  v_t := (v_t # (v_t + ((v_t # (v_t >> 7)) * ((v_t | 61) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
  -- (t ^ (t >>> 14)) >>> 0
  v_t := (v_t # (v_t >> 14)) & x'FFFFFFFF'::BIGINT;
  v_rand := v_t::FLOAT8 / 4294967296.0;

  v_num := FLOOR(v_rand * 10)::INT;

  result_number := v_num;
  result_size   := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
  result_color  := CASE
    WHEN v_num = 0 OR v_num = 5 THEN 'violet'
    WHEN v_num % 2 = 0           THEN 'red'
    ELSE                              'green'
  END;
  RETURN NEXT;
END;
$$;

-- ── SECTION 5: 24/7 Server-Side Round Loop ───────────────────────
-- fn_tick_game_rounds() is called by pg_cron every 30 seconds.
-- It handles ALL four WinGo modes autonomously:
--   30s → interval 30,  prefix '1000'
--   1m  → interval 60,  prefix '2000'
--   3m  → interval 180, prefix '3000'
--   5m  → interval 300, prefix '4000'
--
-- For each mode it:
--   a) Resolves any expired active rounds (applies target_result or RNG).
--   b) Creates the next round if none is active.

CREATE OR REPLACE FUNCTION public.fn_tick_game_rounds()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode       TEXT;
  v_interval   INT;
  v_prefix     TEXT;
  v_now        TIMESTAMPTZ := NOW();
  v_date_str   TEXT        := TO_CHAR(v_now AT TIME ZONE 'UTC', 'YYYYMMDD');
  v_secs       INT;
  v_round_num  INT;
  v_period     TEXT;
  v_ends_at    TIMESTAMPTZ;
  v_round      RECORD;
  v_res        RECORD;
  v_forced     TEXT;
  v_num        INT;
  v_size       TEXT;
  v_color      TEXT;
BEGIN
  v_secs := EXTRACT(HOUR FROM v_now AT TIME ZONE 'UTC')::INT * 3600
          + EXTRACT(MINUTE FROM v_now AT TIME ZONE 'UTC')::INT * 60
          + EXTRACT(SECOND FROM v_now AT TIME ZONE 'UTC')::INT;

  FOR v_mode, v_interval, v_prefix IN
    VALUES ('30s',30,'1000'), ('1m',60,'2000'), ('3m',180,'3000'), ('5m',300,'4000')
  LOOP
    -- ── a) Resolve expired active rounds ──────────────────────────
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo'
        AND mode      = v_mode
        AND status    = 'active'
        AND ends_at  <= v_now
    LOOP
      v_forced := v_round.target_result;

      -- Get RNG result for this period
      SELECT r.result_number, r.result_size, r.result_color
      INTO v_res
      FROM public.fn_result_for_period(v_round.period) r;

      v_num   := v_res.result_number;
      v_size  := v_res.result_size;
      v_color := v_res.result_color;

      -- Override with admin-forced result if set
      IF v_forced = 'BIG' AND v_size != 'Big' THEN
        v_num   := 5 + (v_res.result_number % 5);  -- maps to 5-9
        v_size  := 'Big';
        v_color := CASE WHEN v_num = 5 THEN 'violet'
                        WHEN v_num % 2 = 0 THEN 'red'
                        ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size != 'Small' THEN
        v_num   := v_res.result_number % 5;         -- maps to 0-4
        v_size  := 'Small';
        v_color := CASE WHEN v_num = 0 THEN 'violet'
                        WHEN v_num % 2 = 0 THEN 'red'
                        ELSE 'green' END;
      END IF;

      -- Mark round completed with final result
      UPDATE public.game_rounds
      SET status        = 'completed',
          result_number = v_num,
          result_size   = v_size,
          result_color  = v_color
      WHERE id = v_round.id;

    END LOOP;

    -- ── b) Create next active round if none exists ─────────────────
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active'
    ) THEN
      v_round_num := (v_secs / v_interval) + 1;
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      v_ends_at   := DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                   + ((v_round_num * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds
        (game_type, mode, period, started_at, ends_at, status)
      VALUES
        ('wingo', v_mode, v_period, v_now, v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- ── SECTION 6: pg_cron schedule ──────────────────────────────────
-- Fires every 30 seconds — covers the 30s mode tick-for-tick,
-- and handles 1m/3m/5m rounds on their natural expiry.
-- Requires pg_cron extension (Dashboard → Database → Extensions → pg_cron).

SELECT cron.unschedule('wingo-round-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'wingo-round-tick'
);

SELECT cron.schedule(
  'wingo-round-tick',
  '* * * * *',   -- every minute (pg_cron minimum granularity)
  $$ SELECT public.fn_tick_game_rounds(); $$
);

-- For sub-minute (30s) precision, schedule a second job offset by 30s:
SELECT cron.unschedule('wingo-round-tick-30s') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'wingo-round-tick-30s'
);
-- pg_cron doesn't support seconds natively; use this workaround:
SELECT cron.schedule(
  'wingo-round-tick-30s',
  '* * * * *',
  $$ SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds(); $$
);

-- ── SECTION 7: Cleanup cron jobs ─────────────────────────────────
SELECT cron.unschedule('cleanup-betting-history-7d') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-betting-history-7d'
);
SELECT cron.schedule(
  'cleanup-betting-history-7d',
  '0 3 * * *',
  $$ DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL '7 days'; $$
);

SELECT cron.unschedule('cleanup-game-rounds-30d') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-game-rounds-30d'
);
SELECT cron.schedule(
  'cleanup-game-rounds-30d',
  '0 4 * * *',
  $$ DELETE FROM public.game_rounds WHERE status = 'completed' AND created_at < NOW() - INTERVAL '30 days'; $$
);

-- ── SECTION 8: Views ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_active_round_bets AS
SELECT
  gr.id            AS round_id,
  gr.game_type,
  gr.mode,
  gr.period,
  gr.status,
  gr.target_result,
  gr.ends_at,
  gr.total_big,
  gr.total_small,
  CASE WHEN (gr.total_big + gr.total_small) = 0 THEN 0
       ELSE ROUND(gr.total_big  / (gr.total_big + gr.total_small) * 100, 1)
  END AS big_pct,
  CASE WHEN (gr.total_big + gr.total_small) = 0 THEN 0
       ELSE ROUND(gr.total_small / (gr.total_big + gr.total_small) * 100, 1)
  END AS small_pct,
  COUNT(bh.id)              AS total_bets,
  COUNT(DISTINCT bh.user_id) AS unique_bettors
FROM public.game_rounds gr
LEFT JOIN public.betting_history bh ON bh.round_id = gr.id
WHERE gr.status = 'active'
GROUP BY gr.id, gr.game_type, gr.mode, gr.period, gr.status,
         gr.target_result, gr.ends_at, gr.total_big, gr.total_small;

-- ── SECTION 9: RPCs ───────────────────────────────────────────────
-- set_round_target: admin injects forced result
CREATE OR REPLACE FUNCTION public.set_round_target(p_period TEXT, p_target_result TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET target_result = p_target_result
  WHERE period = p_period AND status = 'active';
END;
$$;

-- get_active_round: client/admin fetches current active round for a mode
CREATE OR REPLACE FUNCTION public.get_active_round(p_game_type TEXT, p_mode TEXT)
RETURNS TABLE(id UUID, period TEXT, ends_at TIMESTAMPTZ, target_result TEXT,
              total_big NUMERIC, total_small NUMERIC, status TEXT)
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

-- complete_round: called by client after local resolution (fallback)
CREATE OR REPLACE FUNCTION public.complete_round(
  p_period TEXT, p_number INT, p_size TEXT, p_color TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET status = 'completed', result_number = p_number,
      result_size = p_size, result_color = p_color
  WHERE period = p_period AND status = 'active';
END;
$$;

-- ── SECTION 10: RLS ───────────────────────────────────────────────
ALTER TABLE public.game_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read game_rounds"       ON public.game_rounds;
DROP POLICY IF EXISTS "Service role all game_rounds"  ON public.game_rounds;
CREATE POLICY "Public read game_rounds"      ON public.game_rounds FOR SELECT USING (true);
CREATE POLICY "Service role all game_rounds" ON public.game_rounds FOR ALL    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own betting_history"   ON public.betting_history;
DROP POLICY IF EXISTS "Users insert own betting_history" ON public.betting_history;
DROP POLICY IF EXISTS "Service role all betting_history" ON public.betting_history;
CREATE POLICY "Users read own betting_history"   ON public.betting_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own betting_history" ON public.betting_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role all betting_history" ON public.betting_history FOR ALL    USING (auth.role() = 'service_role');

-- ── SECTION 11: Grants ────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_tick_game_rounds()                          TO postgres;
GRANT EXECUTE ON FUNCTION public.get_active_round(TEXT, TEXT)                   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_round_target(TEXT, TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_round(TEXT, INT, TEXT, TEXT)          TO authenticated;
GRANT SELECT  ON public.v_active_round_bets                                     TO authenticated;

-- ── SECTION 12: Seed first rounds immediately ─────────────────────
-- Run the tick once right now so rounds exist before any user opens the app.
SELECT public.fn_tick_game_rounds();
