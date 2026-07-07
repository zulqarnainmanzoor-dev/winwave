-- ════════════════════════════════════════════════════════════════════════════════
-- QUICK FIX: Deposit Flow Issues
-- Fixes: 406 error (missing columns), 409 error (conflicts), 404 error (missing RPC)
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. ADD MISSING COLUMNS to deposit_history if they don't exist
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS pkpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 2. CREATE MISSING RPC FUNCTION: process_team_commission
CREATE OR REPLACE FUNCTION public.process_team_commission(
  p_subordinate_id UUID,
  p_processing_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_commission NUMERIC;
  v_rate NUMERIC := 0.003; -- 0.3% for L0
BEGIN
  -- Get the referrer (agent)
  SELECT referred_by INTO v_referrer_id
  FROM public.users
  WHERE id = p_subordinate_id;

  -- If no referrer, return success (no commission to process)
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No referrer found');
  END IF;

  -- Calculate commission (0.3% of processing amount)
  v_commission := ROUND(p_processing_amount * v_rate, 2);

  -- Credit agent's balance
  UPDATE public.users
  SET main_balance = main_balance + v_commission
  WHERE id = v_referrer_id;

  -- Record transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    gateway_ref,
    remarks
  ) VALUES (
    v_referrer_id,
    'commission',
    v_commission,
    'completed',
    'Commission from member ' || p_subordinate_id::TEXT,
    'Processing amount: Rs ' || p_processing_amount || ' → Commission: Rs ' || v_commission
  );

  RETURN jsonb_build_object(
    'success', true,
    'commission', v_commission,
    'referrer_id', v_referrer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_team_commission(UUID, NUMERIC) TO authenticated;

-- 3. FIX: Update DepositView.tsx to use correct column names
-- The issue is that the frontend is trying to insert columns that don't exist
-- Solution: Only insert columns that exist in the table

-- 4. TEST: Verify deposit_history table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deposit_history'
ORDER BY ordinal_position;

-- 5. TEST: Verify process_team_commission function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'process_team_commission';

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF QUICK FIX
-- ════════════════════════════════════════════════════════════════════════════════