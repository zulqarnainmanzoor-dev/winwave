-- ================================================================
-- MISSING RPC FUNCTIONS FOR DEPOSIT/WITHDRAWAL APPROVAL
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. approve_withdrawal RPC (referenced in FundsManagement.tsx)
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_user_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Get withdrawal details with FOR UPDATE to lock row
  SELECT user_id, amount, status INTO v_withdrawal
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status != 'pending' AND v_withdrawal.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already processed');
  END IF;
  
  -- Update status to processing (will be completed by payout API)
  UPDATE public.withdrawal_history
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved and marked as processing');
END;
$$;

-- 2. complete_withdrawal RPC (referenced in webhook.ts)
CREATE OR REPLACE FUNCTION public.complete_withdrawal(p_withdrawal_id UUID, p_gateway_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
BEGIN
  -- Get withdrawal details
  SELECT user_id, amount, status INTO v_withdrawal
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already completed');
  END IF;
  
  -- Update to completed
  UPDATE public.withdrawal_history
  SET status = 'completed',
      gateway_ref = p_gateway_ref,
      updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  -- Update user's total_withdrawal (trigger will handle this)
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal completed');
END;
$$;

-- 3. fail_withdrawal RPC (referenced in webhook.ts and FundsManagement.tsx)
CREATE OR REPLACE FUNCTION public.fail_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_user_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Get withdrawal details with FOR UPDATE
  SELECT user_id, amount, status INTO v_withdrawal
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot fail completed withdrawal');
  END IF;
  
  -- Refund balance to user
  UPDATE public.users
  SET main_balance = main_balance + v_withdrawal.amount
  WHERE id = v_withdrawal.user_id;
  
  -- Mark withdrawal as failed
  UPDATE public.withdrawal_history
  SET status = 'failed',
      reason = p_reason,
      updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal failed and balance refunded');
END;
$$;

-- 4. approve_deposit RPC (for consistency)
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
BEGIN
  -- Get deposit details
  SELECT user_id, amount, status INTO v_deposit
  FROM public.deposit_history
  WHERE id = p_deposit_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already completed');
  END IF;
  
  -- Update to completed (trigger will credit balance)
  UPDATE public.deposit_history
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_deposit_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved and balance credited');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_deposit(UUID) TO authenticated, service_role;