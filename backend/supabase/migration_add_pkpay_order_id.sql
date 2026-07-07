-- Migration: Add pkpay_order_id column to deposit_history
-- Purpose: Store PKPay's order ID separately from our payment link slug
-- Reason: PKPay sends back a different order ID (out_trade_no) than the payment link slug

-- Add column if it doesn't exist
ALTER TABLE deposit_history
ADD COLUMN IF NOT EXISTS pkpay_order_id VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deposit_history_pkpay_order_id 
ON deposit_history(pkpay_order_id);

-- Add comment explaining the column
COMMENT ON COLUMN deposit_history.pkpay_order_id IS 
'PKPay order ID (out_trade_no) - different from order_id which is the payment link slug';

-- Example data structure after migration:
-- order_id: "7099555e5d96948a" (payment link slug)
-- pkpay_order_id: "5675f9bea779453fbc12f6d1845be8d5" (PKPay out_trade_no)
-- Both are stored so we can match webhook callbacks correctly
