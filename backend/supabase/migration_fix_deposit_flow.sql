-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix Deposit Flow - Enforce user_id NOT NULL and add logging
-- ════════════════════════════════════════════════════════════════════════════════

-- STEP 1: Add webhook_logs table for comprehensive debugging
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type TEXT NOT NULL,  -- 'deposit', 'payout', etc.
  request_id TEXT NOT NULL,
  order_id TEXT,
  user_id UUID,
  amount NUMERIC(18,2),
  status TEXT,
  payload JSONB,
  error_message TEXT,
  log_level TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warn', 'error'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_webhook_type ON public.webhook_logs(webhook_type);
CREATE INDEX IF NOT EXISTS idx_wl_order_id ON public.webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_wl_user_id ON public.webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_wl_created_at ON public.webhook_logs(created_at DESC);

-- STEP 2: Ensure deposit_history.user_id is NOT NULL
-- First, check for any NULL user_id records
SELECT COUNT(*) as null_user_id_count FROM public.deposit_history WHERE user_id IS NULL;

-- If there are NULL records, they must be manually investigated and fixed
-- For now, we'll add the constraint going forward

-- STEP 3: Add NOT NULL constraint (if not already present)
-- Note: This will fail if there are existing NULL values
-- Those must be fixed manually first
ALTER TABLE public.deposit_history 
  ALTER COLUMN user_id SET NOT NULL;

-- STEP 4: Add unique constraint on order_id (already exists, but verify)
-- This ensures no duplicate deposits for the same order_id

-- STEP 5: Create function to log webhook events
CREATE OR REPLACE FUNCTION public.fn_log_webhook_event(
  p_webhook_type TEXT,
  p_request_id TEXT,
  p_order_id TEXT,
  p_user_id UUID,
  p_amount NUMERIC,
  p_status TEXT,
  p_payload JSONB,
  p_error_message TEXT DEFAULT NULL,
  p_log_level TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.webhook_logs (
    webhook_type, request_id, order_id, user_id, amount, status, payload, error_message, log_level
  )
  VALUES (
    p_webhook_type, p_request_id, p_order_id, p_user_id, p_amount, p_status, p_payload, p_error_message, p_log_level
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_log_webhook_event(TEXT, TEXT, TEXT, UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT) TO service_role;

-- STEP 6: Create admin function to find deposits without user_id
CREATE OR REPLACE FUNCTION public.fn_find_orphaned_deposits()
RETURNS TABLE(
  id UUID,
  order_id TEXT,
  amount NUMERIC,
  method TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  remarks TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dh.id, dh.order_id, dh.amount, dh.method, dh.status, dh.created_at, dh.remarks
  FROM public.deposit_history dh
  WHERE dh.user_id IS NULL
  ORDER BY dh.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_orphaned_deposits() TO authenticated;

-- STEP 7: Create admin function to manually assign user_id to orphaned deposit
CREATE OR REPLACE FUNCTION public.fn_assign_user_to_deposit(
  p_deposit_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_user_exists BOOLEAN;
BEGIN
  -- Verify user exists
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Verify deposit exists
  SELECT * INTO v_deposit FROM public.deposit_history WHERE id = p_deposit_id;
  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  -- Update deposit with user_id
  UPDATE public.deposit_history
  SET user_id = p_user_id, updated_at = NOW()
  WHERE id = p_deposit_id;

  -- If deposit is completed, trigger balance credit
  IF v_deposit.status = 'completed' THEN
    UPDATE public.users
    SET main_balance = main_balance + v_deposit.amount,
        total_deposit = total_deposit + v_deposit.amount,
        wagering_required = wagering_required + v_deposit.amount,
        total_winning = total_winning + (v_deposit.amount * 0.02)
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'User assigned to deposit');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_assign_user_to_deposit(UUID, UUID) TO authenticated;

-- STEP 8: Add index on deposit_history status for faster queries
CREATE INDEX IF NOT EXISTS idx_dh_status_created ON public.deposit_history(status, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Check for any NULL user_id in deposit_history
-- SELECT COUNT(*) as null_count FROM public.deposit_history WHERE user_id IS NULL;

-- Check recent deposits
-- SELECT id, order_id, user_id, amount, status, created_at FROM public.deposit_history ORDER BY created_at DESC LIMIT 10;

-- Check webhook logs
-- SELECT * FROM public.webhook_logs ORDER BY created_at DESC LIMIT 20;

-- ════════════════════════════════════════════════════════════════════════════════
-- END MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
