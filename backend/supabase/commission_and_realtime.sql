-- ================================================================
-- commission_and_realtime.sql
-- Run ONCE in Supabase SQL Editor.
-- Covers:
--   1. Commission trigger  — 1% of bet_amount credited to referrer
--   2. Realtime publication — withdrawal_history live updates
--   3. approve_withdrawal RPC — pending → processing (admin click)
--   4. complete_withdrawal RPC — processing → completed (webhook)
--   5. fail_withdrawal RPC    — any → failed + refund
-- ================================================================

-- ── 1. Commission Engine ─────────────────────────────────────────
-- Rate: 1% of bet_amount (Level 1 agent only).
-- Triggered on every INSERT into betting_history.
-- Credits referred_by user's main_balance.

CREATE OR REPLACE FUNCTION public.fn_credit_agent_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_id  UUID;
  v_commission   NUMERIC(18,2);
BEGIN
  -- Commission = exactly 1% of the raw bet amount
  v_commission := ROUND(NEW.amount * 0.01, 2);
  IF v_commission <= 0 THEN RETURN NEW; END IF;

  -- Find the referrer (Level 1 agent)
  SELECT referred_by INTO v_referrer_id
  FROM public.users
  WHERE id = NEW.user_id;

  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  -- Credit commission to referrer's main_balance atomically
  UPDATE public.users
  SET main_balance = main_balance + v_commission
  WHERE id = v_referrer_id;

  -- Audit trail
  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref, created_at)
  VALUES (
    v_referrer_id,
    'commission',
    v_commission,
    'completed',
    'bet:' || NEW.id::TEXT,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_agent_commission ON public.betting_history;
CREATE TRIGGER trg_credit_agent_commission
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_credit_agent_commission();

GRANT EXECUTE ON FUNCTION public.fn_credit_agent_commission() TO service_role;

-- ── 2. Realtime for withdrawal_history ───────────────────────────
-- Enables live INSERT/UPDATE events so the admin dashboard
-- receives new withdrawal requests without polling.

ALTER TABLE public.withdrawal_history REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'withdrawal_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_history;
  END IF;
END $$;

-- ── 3. approve_withdrawal — pending → processing ─────────────────
-- Called by admin "Approve" button click.
-- Sets status = 'processing' (not yet paid — payout API is next).
-- Deducts balance at this point so it can't be double-spent.
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID,
  p_gateway_ref   TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row    RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotent: already processed
  IF v_row.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_processed', 'status', v_row.status);
  END IF;

  -- Deduct from user balance (if not already deducted on request creation)
  -- Only deduct if status is still 'pending' (first approval)
  IF v_row.status = 'pending' THEN
    UPDATE public.users
    SET main_balance = GREATEST(0, main_balance - v_row.amount)
    WHERE id = v_row.user_id;
  END IF;

  UPDATE public.withdrawal_history
  SET
    status      = 'processing',
    gateway_ref = COALESCE(p_gateway_ref, gateway_ref),
    updated_at  = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'processing');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID, TEXT) TO authenticated, service_role;

-- ── 4. complete_withdrawal — processing → completed ───────────────
-- Called by the /api/webhooks/payout endpoint on PKPay success.
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  p_withdrawal_id UUID,
  p_gateway_ref   TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotent
  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_completed');
  END IF;

  IF v_row.status <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_status', 'status', v_row.status);
  END IF;

  UPDATE public.withdrawal_history
  SET
    status      = 'completed',
    gateway_ref = p_gateway_ref,
    updated_at  = NOW()
  WHERE id = p_withdrawal_id;

  -- Log to transactions for user history view
  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref, created_at)
  VALUES (v_row.user_id, 'withdraw', v_row.amount, 'completed', p_gateway_ref, NOW())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'status', 'completed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT) TO service_role;

-- ── 5. fail_withdrawal — any → failed + refund ───────────────────
-- Called when payout API fails or admin rejects.
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_withdrawal_id UUID,
  p_reason        TEXT DEFAULT 'Payment failed'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status IN ('completed', 'failed', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_finalized', 'status', v_row.status);
  END IF;

  -- Refund balance only if it was already deducted (status was processing/approved)
  IF v_row.status IN ('processing', 'approved') THEN
    UPDATE public.users
    SET main_balance = main_balance + v_row.amount
    WHERE id = v_row.user_id;
  END IF;

  UPDATE public.withdrawal_history
  SET status = 'failed', reason = p_reason, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'failed', 'refunded', v_row.status IN ('processing','approved'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID, TEXT) TO authenticated, service_role;

-- ── 6. Ensure updated_at column exists on withdrawal_history ─────
ALTER TABLE public.withdrawal_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
