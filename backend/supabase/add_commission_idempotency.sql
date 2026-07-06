-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Commission Claim Idempotency
-- Purpose: Prevent duplicate commission credits on page refresh
-- ════════════════════════════════════════════════════════════════════════════════

-- Add claimed flag to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS claimed_by TEXT;

-- Create index for fast lookup of unclaimed commissions
CREATE INDEX IF NOT EXISTS idx_transactions_unclaimed 
ON public.transactions(user_id, type, claimed) 
WHERE type = 'commission' AND claimed = FALSE;

-- ════════════════════════════════════════════════════════════════════════════════
-- FUNCTION: Claim Commission (Idempotent)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_commission(
  p_user_id UUID,
  p_commission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_amount NUMERIC;
  v_already_claimed BOOLEAN;
  v_current_balance NUMERIC;
BEGIN
  -- 1. Check if commission exists and belongs to user
  SELECT amount, claimed 
  INTO v_commission_amount, v_already_claimed
  FROM public.transactions
  WHERE id = p_commission_id 
    AND user_id = p_user_id 
    AND type = 'commission'
  FOR UPDATE;

  IF v_commission_amount IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Commission not found'
    );
  END IF;

  -- 2. Check if already claimed (idempotency check)
  IF v_already_claimed = TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Commission already claimed',
      'claimed_at', (SELECT claimed_at FROM public.transactions WHERE id = p_commission_id)
    );
  END IF;

  -- 3. Get current balance
  SELECT main_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- 4. Update commission as claimed (atomic transaction)
  UPDATE public.transactions
  SET 
    claimed = TRUE,
    claimed_at = NOW(),
    claimed_by = p_user_id::TEXT,
    updated_at = NOW()
  WHERE id = p_commission_id
    AND claimed = FALSE;

  -- 5. Check if update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Commission was already claimed by another request'
    );
  END IF;

  -- 6. Credit balance (only after commission is marked as claimed)
  UPDATE public.users
  SET 
    main_balance = main_balance + v_commission_amount,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 7. Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Commission claimed successfully',
    'amount', v_commission_amount,
    'new_balance', v_current_balance + v_commission_amount,
    'claimed_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_commission(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- FUNCTION: Get Unclaimed Commissions
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_unclaimed_commissions(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  amount NUMERIC,
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
    t.id,
    t.amount,
    t.created_at,
    t.remarks
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.type = 'commission'
    AND t.claimed = FALSE
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unclaimed_commissions(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- FUNCTION: Get Total Unclaimed Commission
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_total_unclaimed_commission(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'commission'
    AND claimed = FALSE;
  
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_unclaimed_commission(UUID) TO authenticated;
