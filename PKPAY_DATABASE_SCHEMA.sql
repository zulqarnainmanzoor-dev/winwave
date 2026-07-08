-- ════════════════════════════════════════════════════════════════════════════════
-- PKPay AUTOMATIC DEPOSIT - DATABASE SCHEMA FIX
-- Run this in Supabase SQL Editor to ensure all required columns and functions exist
-- ════════════════════════════════════════════════════════════════════════════════

-- STEP 1: Verify and add missing columns to deposit_history
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS payment_link_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS pkpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS gateway_ref TEXT,
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on payment_link_id for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_deposit_history_payment_link_id 
ON public.deposit_history(payment_link_id);

-- Create index on order_id for lookups
CREATE INDEX IF NOT EXISTS idx_deposit_history_order_id 
ON public.deposit_history(order_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_deposit_history_status 
ON public.deposit_history(status);

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_deposit_history_user_id 
ON public.deposit_history(user_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 2: Verify users table has required columns
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS main_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS game_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_deposit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wagering_required NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 3: Verify transactions table exists and has required columns
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdraw', 'bonus', 'commission', etc.
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  gateway_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
ON public.transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON public.transactions(type);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON public.transactions(created_at);

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create trigger function for automatic deposit completion
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_on_deposit_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount NUMERIC;
  v_total_amount NUMERIC;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    
    -- Calculate bonus (2%)
    v_bonus_amount := ROUND(NEW.amount * 0.02, 2);
    v_total_amount := NEW.amount + v_bonus_amount;

    -- 1. Credit main_balance (NOT game_balance)
    UPDATE public.users
    SET 
      main_balance = main_balance + v_total_amount,
      total_deposit = total_deposit + NEW.amount,
      wagering_required = wagering_required + (NEW.amount * 1.5), -- 1.5x wagering requirement
      bonus_balance = bonus_balance + v_bonus_amount,
      updated_at = NOW()
    WHERE id = NEW.user_id;

    -- 2. Insert transaction record
    INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref)
    VALUES (
      NEW.user_id,
      'deposit',
      v_total_amount,
      'completed',
      'PKPay: ' || COALESCE(NEW.pkpay_order_id, NEW.order_id, 'unknown')
    );

    -- 3. Log the completion
    RAISE NOTICE 'Deposit completed: user_id=%, amount=%, bonus=%, total=%', 
      NEW.user_id, NEW.amount, v_bonus_amount, v_total_amount;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_deposit_completed ON public.deposit_history;

-- Create trigger
CREATE TRIGGER trg_deposit_completed
AFTER UPDATE ON public.deposit_history
FOR EACH ROW
EXECUTE FUNCTION public.fn_on_deposit_completed();

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 5: Create RPC function to verify and complete deposits
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_complete_deposit(
  p_payment_link_id TEXT,
  p_pkpay_order_id TEXT,
  p_status TEXT DEFAULT 'completed'
)
RETURNS JSONB AS $$
DECLARE
  v_deposit_id UUID;
  v_user_id UUID;
  v_amount NUMERIC;
  v_current_status TEXT;
BEGIN
  -- Find deposit by payment_link_id
  SELECT id, user_id, amount, status
  INTO v_deposit_id, v_user_id, v_amount, v_current_status
  FROM public.deposit_history
  WHERE payment_link_id = p_payment_link_id
  LIMIT 1;

  -- Check if deposit exists
  IF v_deposit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Deposit not found',
      'payment_link_id', p_payment_link_id
    );
  END IF;

  -- Check if already completed (prevent duplicates)
  IF v_current_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Deposit already completed',
      'deposit_id', v_deposit_id,
      'user_id', v_user_id,
      'amount', v_amount
    );
  END IF;

  -- Update deposit to completed
  UPDATE public.deposit_history
  SET 
    status = p_status,
    pkpay_order_id = p_pkpay_order_id,
    updated_at = NOW()
  WHERE id = v_deposit_id;

  -- Trigger will automatically credit balance
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Deposit completed successfully',
    'deposit_id', v_deposit_id,
    'user_id', v_user_id,
    'amount', v_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 6: Create RPC function to get deposit by payment_link_id
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_get_deposit_by_payment_link(
  p_payment_link_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_deposit RECORD;
BEGIN
  SELECT id, user_id, amount, status, order_id, payment_link_id, slug, created_at
  INTO v_deposit
  FROM public.deposit_history
  WHERE payment_link_id = p_payment_link_id
  LIMIT 1;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Deposit not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deposit', jsonb_build_object(
      'id', v_deposit.id,
      'user_id', v_deposit.user_id,
      'amount', v_deposit.amount,
      'status', v_deposit.status,
      'order_id', v_deposit.order_id,
      'payment_link_id', v_deposit.payment_link_id,
      'slug', v_deposit.slug,
      'created_at', v_deposit.created_at
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 7: Verify webhook endpoint can access these functions
-- ════════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.rpc_complete_deposit(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_deposit_by_payment_link(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_on_deposit_completed() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 8: Verify RLS policies allow webhook to update deposits
-- ════════════════════════════════════════════════════════════════════════════════

-- Create policy for service role to update deposits
CREATE POLICY "Service role can update deposits"
ON public.deposit_history
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create policy for authenticated users to read their own deposits
CREATE POLICY "Users can read their own deposits"
ON public.deposit_history
FOR SELECT
USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 9: Verify data integrity
-- ════════════════════════════════════════════════════════════════════════════════

-- Check deposit_history structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'deposit_history'
ORDER BY ordinal_position;

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'deposit_history';

-- Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'rpc_%' OR routine_name LIKE 'fn_%'
ORDER BY routine_name;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 10: Test the complete flow (optional)
-- ════════════════════════════════════════════════════════════════════════════════

-- Create test deposit
-- INSERT INTO public.deposit_history (
--   user_id,
--   amount,
--   method,
--   payment_link_id,
--   slug,
--   order_id,
--   status,
--   created_at,
--   updated_at
-- ) VALUES (
--   '01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid,
--   300,
--   'jazzcash',
--   'test-payment-link-id-123',
--   '8fb65585df22bb6c',
--   'ORD-1234567890-abc123',
--   'pending',
--   NOW(),
--   NOW()
-- );

-- Test RPC function
-- SELECT public.rpc_complete_deposit('test-payment-link-id-123', 'pkpay-order-123');

-- Verify balance was credited
-- SELECT main_balance, total_deposit, wagering_required FROM public.users 
-- WHERE id = '01fc7792-9b68-4dfd-9422-a1fb3706ba03';

-- ════════════════════════════════════════════════════════════════════════════════
-- ✅ SCHEMA VERIFICATION COMPLETE
-- ════════════════════════════════════════════════════════════════════════════════
-- 
-- After running this script:
-- ✅ deposit_history has all required columns
-- ✅ Indexes created for fast lookups
-- ✅ Trigger function created for automatic balance credit
-- ✅ RPC functions created for webhook to use
-- ✅ RLS policies configured
-- ✅ Ready for automatic deposit processing
--
-- ════════════════════════════════════════════════════════════════════════════════
