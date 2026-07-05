-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: settle_bet_stats RPC
--
-- Called by wingoEngine.ts after every bet is settled.
-- Uses SQL expressions (col + delta) to avoid read-modify-write races.
-- Handles both winners (balance credit + win stats) and losers (bet count only).
--
-- Also fixes trg_wagering_on_bet_insert: the existing trigger fires only when
-- status='completed' at INSERT time, but bets are inserted as 'pending'.
-- We drop and recreate it to fire unconditionally on INSERT.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. settle_bet_stats RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_bet_stats(
  p_user_id    UUID,
  p_bet_amount NUMERIC,
  p_win_amount NUMERIC,
  p_is_win     BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_win THEN
    UPDATE public.users
    SET
      main_balance     = main_balance     + p_win_amount,
      total_win_amount = total_win_amount + p_win_amount,
      total_winning    = total_winning    + p_win_amount,
      total_bets       = total_bets       + 1,
      bet_count        = bet_count        + 1,
      total_bets_count = total_bets_count + 1
    WHERE id = p_user_id;
  ELSE
    UPDATE public.users
    SET
      total_bets       = total_bets       + 1,
      bet_count        = bet_count        + 1,
      total_bets_count = total_bets_count + 1
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_bet_stats(UUID, NUMERIC, NUMERIC, BOOLEAN)
  TO service_role;

-- ── 2. Fix wagering trigger: fire on every INSERT, not just status='completed' ─
-- The broken trigger only fires when NEW.status = 'completed', but bets are
-- inserted as 'pending'. Drop and recreate without the WHEN condition.

DROP TRIGGER IF EXISTS trg_wagering_on_bet_insert ON public.betting_history;

CREATE TRIGGER trg_wagering_on_bet_insert
  AFTER INSERT ON public.betting_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_wagering_on_bet();
