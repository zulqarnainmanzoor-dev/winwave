-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Missing Payment Gateway Fields to Deposit & Withdrawal History
-- ════════════════════════════════════════════════════════════════════════════════
-- Purpose: Ensure all payment gateway fields are properly stored separately from
--          user account information. Prevents mixing of Order IDs with Account Numbers.
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: DEPOSIT_HISTORY - Add Missing Columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Add merchant_order_id if not exists
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS merchant_order_id TEXT;

-- Add pkpay_transaction_id if not exists
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS pkpay_transaction_id TEXT;

-- Add callback_status if not exists
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS callback_status TEXT;

-- Add callback_time if not exists
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS callback_time TIMESTAMPTZ;

-- Add gateway_response if not exists (for PKPay metadata/raw response)
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- Add payment_gateway if not exists
ALTER TABLE public.deposit_history
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'pkpay';

-- Rename gateway_ref to be more explicit (if needed, but keep for backward compatibility)
-- gateway_ref already exists and is used for PKPay reference

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_dh_merchant_order_id ON public.deposit_history(merchant_order_id);
CREATE INDEX IF NOT EXISTS idx_dh_pkpay_transaction_id ON public.deposit_history(pkpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_dh_callback_status ON public.deposit_history(callback_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: WITHDRAWAL_HISTORY - Add Missing Columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Add merchant_order_id if not exists
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS merchant_order_id TEXT;

-- Add pkpay_transaction_id if not exists
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS pkpay_transaction_id TEXT;

-- Add callback_status if not exists
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS callback_status TEXT;

-- Add callback_time if not exists
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS callback_time TIMESTAMPTZ;

-- Add gateway_response if not exists (for PKPay metadata/raw response)
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- Add payment_gateway if not exists
ALTER TABLE public.withdrawal_history
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'pkpay';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_wh_merchant_order_id ON public.withdrawal_history(merchant_order_id);
CREATE INDEX IF NOT EXISTS idx_wh_pkpay_transaction_id ON public.withdrawal_history(pkpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_wh_callback_status ON public.withdrawal_history(callback_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: VERIFY COLUMN STRUCTURE
-- ─────────────────────────────────────────────────────────────────────────────

-- Deposit History Final Structure:
-- id, user_id, amount, method, order_id, gateway_ref, bonus, bonus_rate, status, remarks,
-- merchant_order_id, pkpay_transaction_id, callback_status, callback_time, gateway_response,
-- payment_gateway, created_at, updated_at

-- Withdrawal History Final Structure:
-- id, user_id, amount, method, order_id, gateway_ref, account_name, account_no, bank_name,
-- status, remarks, merchant_order_id, pkpay_transaction_id, callback_status, callback_time,
-- gateway_response, payment_gateway, created_at, updated_at

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
