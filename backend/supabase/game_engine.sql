-- ================================================================
-- FILE: backend/supabase/game_engine.sql
-- Run this in Supabase SQL Editor (service_role / postgres role)
-- ================================================================

-- ── 1. game_rounds table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type      TEXT        NOT NULL,          -- 'wingo'
  mode           TEXT        NOT NULL,          -- '30s' | '1m' | '3m' | '5m'
  period         TEXT        NOT NULL UNIQUE,   -- e.g. '202506151000000123'
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at        TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'completed'
  -- Admin-injected result (set before 5-second mark)
  target_result  TEXT        NULL,              -- 'BIG' | 'SMALL' | NULL (auto)
  -- Final resolved result
  result_number  INT         NULL,              -- 0-9
  result_size    TEXT        NULL,              -- 'Big' | 'Small'
  result_color   TEXT        NULL,              -- 'red' | 'green' | 'violet'
  -- Bet totals (updated by trigger on betting_history inserts)
  total_big      NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_small    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_game_type_status
  ON public.game_rounds (game_type, status);

CREATE INDEX IF NOT EXISTS idx_game_rounds_period
  ON public.game_rounds (period);

-- ── 2. betting_history table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.betting_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round_id       UUID        NULL REFERENCES public.game_rounds(id) ON DELETE SET NULL,
  period         TEXT        NOT NULL,
  game_type      TEXT        NOT NULL DEFAULT 'wingo',
  mode           TEXT        NOT NULL DEFAULT '30s',
  bet_type       TEXT        NOT NULL,          -- 'color' | 'size' | 'number'
  bet_value      TEXT        NOT NULL,          -- 'Big','Small','Green','Red','Violet','0'-'9'
  amount         NUMERIC(18,2) NOT NULL,
  win_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_win         BOOLEAN     NOT NULL DEFAULT FALSE,
  status         TEXT        NOT NULL DEFAULT 'pending', -- 'pending'|'win'|'lose'
  result_number  INT         NULL,
  result_size    TEXT        NULL,
  result_color   TEXT        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_betting_history_user_id
  ON public.betting_history (user_id);

CREATE INDEX IF NOT EXISTS idx_betting_history_period
  ON public.betting_history (period);

CREATE INDEX IF NOT EXISTS idx_betting_history_created_at
  ON public.betting_history (created_at);

-- ── 3. Trigger: keep game_rounds.total_big / total_small in sync ─
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

-- ── 4. SQL View: live Big vs Small analysis per active round ──────
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
  CASE
    WHEN (gr.total_big + gr.total_small) = 0 THEN 0
    ELSE ROUND(gr.total_big  / (gr.total_big + gr.total_small) * 100, 1)
  END AS big_pct,
  CASE
    WHEN (gr.total_big + gr.total_small) = 0 THEN 0
    ELSE ROUND(gr.total_small / (gr.total_big + gr.total_small) * 100, 1)
  END AS small_pct,
  COUNT(bh.id)     AS total_bets,
  COUNT(DISTINCT bh.user_id) AS unique_bettors
FROM public.game_rounds gr
LEFT JOIN public.betting_history bh ON bh.round_id = gr.id
WHERE gr.status = 'active'
GROUP BY gr.id, gr.game_type, gr.mode, gr.period, gr.status,
         gr.target_result, gr.ends_at, gr.total_big, gr.total_small;

-- ── 5. RPC: upsert_active_round ───────────────────────────────────
-- Called by the WinGoView client every round to ensure a DB row exists.
CREATE OR REPLACE FUNCTION public.upsert_active_round(
  p_game_type TEXT,
  p_mode      TEXT,
  p_period    TEXT,
  p_ends_at   TIMESTAMPTZ
)
RETURNS TABLE(id UUID, target_result TEXT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Close any stale active rounds for this game_type+mode that have expired
  UPDATE public.game_rounds
  SET status = 'completed'
  WHERE game_type = p_game_type
    AND mode      = p_mode
    AND status    = 'active'
    AND ends_at   < NOW()
    AND period   != p_period;

  -- Insert new round if it doesn't exist yet
  INSERT INTO public.game_rounds (game_type, mode, period, ends_at, status)
  VALUES (p_game_type, p_mode, p_period, p_ends_at, 'active')
  ON CONFLICT (period) DO NOTHING;

  -- Return the current row for this period
  RETURN QUERY
    SELECT gr.id, gr.target_result, gr.status
    FROM public.game_rounds gr
    WHERE gr.period = p_period
    LIMIT 1;
END;
$$;

-- ── 6. RPC: set_round_target ──────────────────────────────────────
-- Admin calls this to inject a forced result.
CREATE OR REPLACE FUNCTION public.set_round_target(
  p_period        TEXT,
  p_target_result TEXT   -- 'BIG' | 'SMALL' | NULL to clear
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET target_result = p_target_result
  WHERE period = p_period AND status = 'active';
END;
$$;

-- ── 7. RPC: complete_round ────────────────────────────────────────
-- Called after result is resolved; marks round completed and saves result.
CREATE OR REPLACE FUNCTION public.complete_round(
  p_period       TEXT,
  p_number       INT,
  p_size         TEXT,
  p_color        TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET
    status        = 'completed',
    result_number = p_number,
    result_size   = p_size,
    result_color  = p_color
  WHERE period = p_period;
END;
$$;

-- ── 8. RLS ────────────────────────────────────────────────────────
ALTER TABLE public.game_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_history ENABLE ROW LEVEL SECURITY;

-- game_rounds: anyone can read active rounds (needed for client listener)
DROP POLICY IF EXISTS "Public read game_rounds"  ON public.game_rounds;
CREATE POLICY "Public read game_rounds"
  ON public.game_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role all game_rounds" ON public.game_rounds;
CREATE POLICY "Service role all game_rounds"
  ON public.game_rounds FOR ALL USING (auth.role() = 'service_role');

-- betting_history: users read own rows; service_role has full access
DROP POLICY IF EXISTS "Users read own betting_history" ON public.betting_history;
CREATE POLICY "Users read own betting_history"
  ON public.betting_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own betting_history" ON public.betting_history;
CREATE POLICY "Users insert own betting_history"
  ON public.betting_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role all betting_history" ON public.betting_history;
CREATE POLICY "Service role all betting_history"
  ON public.betting_history FOR ALL USING (auth.role() = 'service_role');

-- ── 9. Grant RPC access ───────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.upsert_active_round(TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_round_target(TEXT,TEXT)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_round(TEXT,INT,TEXT,TEXT)               TO authenticated;
GRANT SELECT ON public.v_active_round_bets TO authenticated;

-- ── 10. pg_cron: auto-cleanup betting_history older than 7 days ──
-- Requires pg_cron extension enabled in Supabase Dashboard → Extensions
SELECT cron.schedule(
  'cleanup-betting-history-7d',
  '0 3 * * *',   -- runs daily at 03:00 UTC
  $$DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL '7 days';$$
);

-- Also clean up completed game_rounds older than 30 days
SELECT cron.schedule(
  'cleanup-game-rounds-30d',
  '0 4 * * *',
  $$DELETE FROM public.game_rounds WHERE status = 'completed' AND created_at < NOW() - INTERVAL '30 days';$$
);
