-- Migration: add wallet-related functions and triggers for public.users

-- 1) RPC: safe atomic transfer between main_balance and game_balance
CREATE OR REPLACE FUNCTION public.transfer_balance(
  p_from_type text,
  p_to_type text,
  p_amount numeric,
  p_user_id uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql AS $$
DECLARE
  mb numeric;
  gb numeric;
  from_col text := lower(p_from_type);
  to_col text := lower(p_to_type);
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 'Amount must be positive';
    RETURN;
  END IF;

  IF from_col NOT IN ('main_balance','game_balance') OR to_col NOT IN ('main_balance','game_balance') THEN
    RETURN QUERY SELECT false, 'Invalid balance types';
    RETURN;
  END IF;

  IF from_col = to_col THEN
    RETURN QUERY SELECT false, 'from_type and to_type cannot be the same';
    RETURN;
  END IF;

  SELECT main_balance, game_balance INTO mb, gb
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found';
    RETURN;
  END IF;

  IF from_col = 'main_balance' THEN
    IF mb < p_amount THEN
      RETURN QUERY SELECT false, 'Insufficient main balance';
      RETURN;
    END IF;
    mb := mb - p_amount;
    gb := gb + p_amount;
  ELSE
    IF gb < p_amount THEN
      RETURN QUERY SELECT false, 'Insufficient game balance';
      RETURN;
    END IF;
    gb := gb - p_amount;
    mb := mb + p_amount;
  END IF;

  UPDATE public.users
  SET main_balance = mb,
      game_balance = gb
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, 'OK';
END;
$$;

-- 2) RPC: increment user deposit, add bonus and wagering
CREATE OR REPLACE FUNCTION public.increment_user_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_bonus numeric,
  p_wagering numeric
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql AS $$
DECLARE
  mb numeric;
  wr numeric;
BEGIN
  IF p_amount < 0 THEN
    RETURN QUERY SELECT false, 'Invalid amount';
    RETURN;
  END IF;

  SELECT main_balance, wagering_required INTO mb, wr
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found';
    RETURN;
  END IF;

  mb := COALESCE(mb,0) + COALESCE(p_amount,0) + COALESCE(p_bonus,0);
  wr := COALESCE(wr,0) + COALESCE(p_wagering,0);

  UPDATE public.users
  SET main_balance = mb,
      wagering_required = wr
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, 'OK';
END;
$$;

-- 3) Trigger function to ensure unique wallet account numbers inside wallet_details JSONB
CREATE OR REPLACE FUNCTION public.ensure_unique_wallet()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  acct text;
  other_id uuid;
BEGIN
  IF NEW.wallet_details IS NULL THEN
    RETURN NEW;
  END IF;

  -- check easypaisa account if present
  acct := COALESCE(NEW.wallet_details->'easypaisa'->>'account', '');
  IF acct <> '' THEN
    SELECT id INTO other_id
    FROM public.users
    WHERE id IS DISTINCT FROM NEW.id
      AND (
        (wallet_details->'easypaisa'->>'account' = acct)
        OR (wallet_details->'jazzcash'->>'account' = acct)
        OR (wallet_details->'usdt'->>'account' = acct)
      )
    LIMIT 1;
    IF other_id IS NOT NULL THEN
      RAISE EXCEPTION 'Wallet already bound to another account';
    END IF;
  END IF;

  -- check jazzcash account if present
  acct := COALESCE(NEW.wallet_details->'jazzcash'->>'account', '');
  IF acct <> '' THEN
    SELECT id INTO other_id
    FROM public.users
    WHERE id IS DISTINCT FROM NEW.id
      AND (
        (wallet_details->'jazzcash'->>'account' = acct)
        OR (wallet_details->'easypaisa'->>'account' = acct)
        OR (wallet_details->'usdt'->>'account' = acct)
      )
    LIMIT 1;
    IF other_id IS NOT NULL THEN
      RAISE EXCEPTION 'Wallet already bound to another account';
    END IF;
  END IF;

  -- check usdt or other wallet account if present
  acct := COALESCE(NEW.wallet_details->'usdt'->>'account', '');
  IF acct <> '' THEN
    SELECT id INTO other_id
    FROM public.users
    WHERE id IS DISTINCT FROM NEW.id
      AND (
        (wallet_details->'usdt'->>'account' = acct)
        OR (wallet_details->'easypaisa'->>'account' = acct)
        OR (wallet_details->'jazzcash'->>'account' = acct)
      )
    LIMIT 1;
    IF other_id IS NOT NULL THEN
      RAISE EXCEPTION 'Wallet already bound to another account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS ensure_unique_wallet_trigger ON public.users;
CREATE TRIGGER ensure_unique_wallet_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_unique_wallet();

-- Ensure invite_code uniqueness (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS users_invite_code_unique ON public.users (invite_code) WHERE invite_code IS NOT NULL;

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS users_phone_number_idx ON public.users (phone_number);
CREATE INDEX IF NOT EXISTS users_wallet_details_gin ON public.users USING gin (wallet_details);

-- RLS policies (idempotent creation)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'select_own_user' AND tablename = 'users'
  ) THEN
    CREATE POLICY select_own_user ON public.users
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'update_own_user' AND tablename = 'users'
  ) THEN
    CREATE POLICY update_own_user ON public.users
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END;
$$;

-- End of migration
