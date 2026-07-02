-- ============================================================
-- FILE: backend/supabase/wagering_trigger.sql
-- PURPOSE: Keep remaining_wager in public.users in sync with
--          every bet placed/resolved in bet_history.
--          remaining_wager = wagering_required - wagering_completed
--          Withdrawal is only allowed when remaining_wager <= 0.
-- ============================================================

-- 1. Ensure the columns exist on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wagering_required  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wagering_completed NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_wager    NUMERIC(18,2) GENERATED ALWAYS AS
    (GREATEST(wagering_required - wagering_completed, 0)) STORED;

-- 2. Ensure bet_history table has the columns we need
--    (adjust column names to match your actual schema if different)
CREATE TABLE IF NOT EXISTS public.bet_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(18,2) NOT NULL DEFAULT 0,   -- amount wagered
  win_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,   -- 0 if loss
  is_win      BOOLEAN NOT NULL DEFAULT FALSE,
  game_type   TEXT,
  period      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Trigger function: on every INSERT into bet_history,
--    add the bet amount to wagering_completed for that user.
--    Also update main_balance atomically:
--      - win:  add win_amount
--      - loss: subtract amount (already deducted on bet placement in UI,
--              but this ensures DB is the source of truth)
CREATE OR REPLACE FUNCTION public.fn_update_wagering_on_bet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomically update wagering_completed and main_balance
  UPDATE public.users
  SET
    wagering_completed = LEAST(
      wagering_completed + NEW.amount,
      wagering_required          -- cap at required so remaining never goes negative
    ),
    -- Balance adjustment: win_amount already includes stake for wins (e.g. 1.96x)
    -- For losses the UI already deducted; we only credit wins here to avoid double-deduct.
    main_balance = CASE
      WHEN NEW.is_win THEN main_balance + NEW.win_amount
      ELSE main_balance          -- loss already deducted at bet placement
    END
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger to bet_history
DROP TRIGGER IF EXISTS trg_update_wagering_on_bet ON public.bet_history;
CREATE TRIGGER trg_update_wagering_on_bet
  AFTER INSERT ON public.bet_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_wagering_on_bet();

-- 5. Helper RPC: place_bet — called from the frontend instead of
--    direct table writes. Deducts balance + inserts bet_history atomically.
CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id   UUID,
  p_amount    NUMERIC,
  p_game_type TEXT,
  p_period    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_bet_id  UUID;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT main_balance INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct balance atomically
  UPDATE public.users
  SET main_balance = main_balance - p_amount
  WHERE id = p_user_id;

  -- Insert pending bet (trigger fires on INSERT)
  INSERT INTO public.bet_history (user_id, amount, win_amount, is_win, game_type, period)
  VALUES (p_user_id, p_amount, 0, FALSE, p_game_type, p_period)
  RETURNING id INTO v_bet_id;

  RETURN v_bet_id;
END;
$$;

-- 6. Helper RPC: resolve_bet — called when round result is known.
--    Updates the bet record; trigger handles balance + wagering.
CREATE OR REPLACE FUNCTION public.resolve_bet(
  p_bet_id    UUID,
  p_is_win    BOOLEAN,
  p_win_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount  NUMERIC;
BEGIN
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.bet_history
  WHERE id = p_bet_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Update the bet record
  UPDATE public.bet_history
  SET is_win = p_is_win, win_amount = p_win_amount
  WHERE id = p_bet_id;

  -- Credit win amount to balance if won
  IF p_is_win THEN
    UPDATE public.users
    SET main_balance = main_balance + p_win_amount
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- 7. RLS: users can only read their own bet_history
ALTER TABLE public.bet_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own bets" ON public.bet_history;
CREATE POLICY "Users read own bets"
  ON public.bet_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access bets" ON public.bet_history;
CREATE POLICY "Service role full access bets"
  ON public.bet_history FOR ALL
  USING (auth.role() = 'service_role');

-- 8. Grant execute on RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.place_bet(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_bet(UUID, BOOLEAN, NUMERIC)  TO authenticated;
