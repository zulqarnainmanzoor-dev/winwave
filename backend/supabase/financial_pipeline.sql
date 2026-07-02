-- ================================================================
-- financial_pipeline.sql
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. withdrawal_history table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_history (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  method          TEXT          NOT NULL,  -- 'JAZZCASH' | 'EASYPAISA'
  account_name    TEXT          NOT NULL,
  account_number  TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending',  -- pending | approved | completed | failed | rejected
  gateway_ref     TEXT          NULL,      -- PKPay payout transaction ID
  reason          TEXT          NULL,      -- rejection reason
  remarks         TEXT          NULL,      -- user-provided remarks
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wh_user_id    ON public.withdrawal_history (user_id);
CREATE INDEX IF NOT EXISTS idx_wh_status     ON public.withdrawal_history (status);
CREATE INDEX IF NOT EXISTS idx_wh_created_at ON public.withdrawal_history (created_at DESC);

-- ── 2. deposit_history table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_history (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       NUMERIC(18,2) NOT NULL,
  bonus        NUMERIC(18,2) NOT NULL DEFAULT 0,
  method       TEXT          NOT NULL DEFAULT 'gateway',
  status       TEXT          NOT NULL DEFAULT 'pending',  -- pending | success | failed
  gateway_ref  TEXT          NULL UNIQUE,  -- PKPay tx_ref (idempotency key)
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dh_user_id    ON public.deposit_history (user_id);
CREATE INDEX IF NOT EXISTS idx_dh_gateway_ref ON public.deposit_history (gateway_ref);

-- ── 3. Ensure users table has required balance columns ───────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS main_balance        NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_balance        NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wagering_required   NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wagering_completed  NUMERIC(18,2) NOT NULL DEFAULT 0;

-- ── 4. RPC: submit_withdrawal ─────────────────────────────────────
-- Called by frontend. Deducts balance atomically and creates pending row.
CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_user_id       UUID,
  p_amount        NUMERIC,
  p_method        TEXT,
  p_account_name  TEXT,
  p_account_number TEXT,
  p_remarks       TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance NUMERIC;
  v_id      UUID;
BEGIN
  -- Lock the user row
  SELECT main_balance INTO v_balance
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  UPDATE public.users
     SET main_balance = main_balance - p_amount
   WHERE id = p_user_id;

  -- Create pending withdrawal record
  INSERT INTO public.withdrawal_history
    (user_id, amount, method, account_name, account_number, status, remarks)
  VALUES
    (p_user_id, p_amount, p_method, p_account_name, p_account_number, 'pending', p_remarks)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_id);
END;
$$;

-- ── 5. RPC: handle_gateway_deposit (webhook) ──────────────────────
-- Idempotent: safe to call multiple times with same tx_ref.
CREATE OR REPLACE FUNCTION public.handle_gateway_deposit(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_tx_ref  TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bonus    NUMERIC;
  v_existing UUID;
BEGIN
  -- Idempotency check
  SELECT id INTO v_existing
    FROM public.deposit_history
   WHERE gateway_ref = p_tx_ref;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  v_bonus := ROUND(p_amount * 0.02, 2);

  -- Credit balance + wagering
  UPDATE public.users
     SET main_balance       = main_balance + p_amount + v_bonus,
         wagering_required  = wagering_required + p_amount + v_bonus,
         wagering_completed = 0
   WHERE id = p_user_id;

  -- Record deposit
  INSERT INTO public.deposit_history
    (user_id, amount, bonus, method, status, gateway_ref)
  VALUES
    (p_user_id, p_amount, v_bonus, 'gateway', 'success', p_tx_ref);

  RETURN jsonb_build_object('success', true, 'credited', p_amount + v_bonus);
END;
$$;

-- ── 6. RPC: approve_withdrawal (admin) ───────────────────────────
-- Called by admin after PKPay payout API succeeds.
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID,
  p_gateway_ref   TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.withdrawal_history
     SET status      = 'completed',
         gateway_ref = COALESCE(p_gateway_ref, gateway_ref),
         updated_at  = NOW()
   WHERE id = p_withdrawal_id;
END;
$$;

-- ── 7. RPC: fail_withdrawal (admin — refund on gateway error) ─────
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_withdrawal_id UUID,
  p_reason        TEXT DEFAULT 'Gateway error'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.withdrawal_history%ROWTYPE;
BEGIN
  SELECT * INTO v_row
    FROM public.withdrawal_history
   WHERE id = p_withdrawal_id AND status = 'approved';

  IF NOT FOUND THEN RETURN; END IF;

  -- Refund
  UPDATE public.users
     SET main_balance = main_balance + v_row.amount
   WHERE id = v_row.user_id;

  UPDATE public.withdrawal_history
     SET status     = 'failed',
         reason     = p_reason,
         updated_at = NOW()
   WHERE id = p_withdrawal_id;
END;
$$;

-- ── 8. RLS ────────────────────────────────────────────────────────
ALTER TABLE public.withdrawal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_history    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own withdrawals"  ON public.withdrawal_history;
DROP POLICY IF EXISTS "Service role all withdrawals" ON public.withdrawal_history;
CREATE POLICY "Users read own withdrawals"
  ON public.withdrawal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role all withdrawals"
  ON public.withdrawal_history FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own deposits"  ON public.deposit_history;
DROP POLICY IF EXISTS "Service role all deposits" ON public.deposit_history;
CREATE POLICY "Users read own deposits"
  ON public.deposit_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role all deposits"
  ON public.deposit_history FOR ALL USING (auth.role() = 'service_role');

-- ── 9. Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.submit_withdrawal(UUID,NUMERIC,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_gateway_deposit(UUID,NUMERIC,TEXT)           TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID,TEXT)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID,TEXT)                          TO service_role;
