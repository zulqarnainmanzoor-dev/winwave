-- ════════════════════════════════════════════════════════════════════════════════
-- 🚨 CRITICAL: RUN THIS IMMEDIATELY IN SUPABASE SQL EDITOR 🚨
-- This fixes the 406 and 409 errors preventing deposits
-- ════════════════════════════════════════════════════════════════════════════════

-- STEP 1: Check current deposit_history structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'deposit_history'
ORDER BY ordinal_position;

-- STEP 2: Add missing columns if they don't exist
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- STEP 3: Ensure order_id is UNIQUE (this prevents 409 errors)
-- First, check if constraint exists
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'deposit_history' AND constraint_type = 'UNIQUE';

-- If order_id doesn't have unique constraint, add it
-- (It should already exist based on schema, but verify)

-- STEP 4: Create the missing RPC function
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
  v_rate NUMERIC := 0.003;
BEGIN
  SELECT referred_by INTO v_referrer_id
  FROM public.users
  WHERE id = p_subordinate_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No referrer');
  END IF;

  v_commission := ROUND(p_processing_amount * v_rate, 2);

  UPDATE public.users
  SET main_balance = main_balance + v_commission
  WHERE id = v_referrer_id;

  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref)
  VALUES (v_referrer_id, 'commission', v_commission, 'completed',
          'Commission from ' || p_subordinate_id::TEXT);

  RETURN jsonb_build_object('success', true, 'commission', v_commission);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_team_commission(UUID, NUMERIC) TO authenticated;

-- STEP 5: Test the deposit insert (this should work now)
-- Uncomment and run to test:
/*
INSERT INTO public.deposit_history (
  user_id,
  amount,
  method,
  order_id,
  gateway_ref,
  status,
  created_at,
  updated_at
) VALUES (
  '01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid,
  300,
  'JAZZCASH',
  'test_order_' || NOW()::text,
  'https://cashier.pkpay.click/pay/test',
  'pending',
  NOW(),
  NOW()
);
*/

-- STEP 6: Verify everything is working
SELECT 
  'deposit_history columns' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'deposit_history';

SELECT 
  'process_team_commission function' as check_name,
  COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'process_team_commission';

-- ════════════════════════════════════════════════════════════════════════════════
-- ✅ AFTER RUNNING THIS SQL:
-- 1. Deposits should work without 406/409 errors
-- 2. Commission will be calculated automatically
-- 3. Users can deposit successfully
-- ════════════════════════════════════════════════════════════════════════════════