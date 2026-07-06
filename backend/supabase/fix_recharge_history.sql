-- ================================================================
-- FIX RECHARGE HISTORY - COMPREHENSIVE MIGRATION
-- Run this in Supabase SQL Editor to ensure ALL historical deposits are visible
-- ================================================================

-- 1. First, ensure the deposit_history table has all required columns
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposit_history' AND column_name = 'bonus') THEN
        ALTER TABLE public.deposit_history ADD COLUMN bonus NUMERIC(18,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposit_history' AND column_name = 'bonus_rate') THEN
        ALTER TABLE public.deposit_history ADD COLUMN bonus_rate NUMERIC(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposit_history' AND column_name = 'gateway_ref') THEN
        ALTER TABLE public.deposit_history ADD COLUMN gateway_ref TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposit_history' AND column_name = 'order_id') THEN
        ALTER TABLE public.deposit_history ADD COLUMN order_id TEXT UNIQUE;
    END IF;
END $$;

-- 2. Create a view that combines ALL deposit sources for backward compatibility
CREATE OR REPLACE VIEW public.v_complete_deposit_history AS
SELECT 
    dh.id,
    dh.user_id,
    dh.amount,
    dh.method,
    dh.status,
    dh.gateway_ref,
    dh.order_id,
    dh.bonus,
    dh.bonus_rate,
    dh.remarks,
    dh.created_at,
    dh.updated_at,
    'deposit_history' as source_table
FROM public.deposit_history dh

UNION ALL

-- Old deposits table (agent system)
SELECT 
    d.id,
    d.user_id,
    d.amount,
    'PKPAY' as method,
    'completed' as status,
    NULL as gateway_ref,
    d.id::TEXT as order_id,
    0 as bonus,
    0 as bonus_rate,
    'Migrated from old deposits table' as remarks,
    d.created_at,
    d.created_at as updated_at,
    'deposits' as source_table
FROM public.deposits d
WHERE NOT EXISTS (
    SELECT 1 FROM public.deposit_history dh 
    WHERE dh.user_id = d.user_id 
      AND dh.amount = d.amount 
      AND ABS(EXTRACT(EPOCH FROM (dh.created_at - d.created_at))) < 60
)

UNION ALL

-- Transactions table where type = 'deposit'
SELECT 
    t.id,
    t.user_id,
    t.amount,
    CASE 
        WHEN t.gateway_ref ILIKE '%jazz%' THEN 'JAZZCASH'
        WHEN t.gateway_ref ILIKE '%easy%' THEN 'EASYPAISA'
        ELSE 'PKPAY'
    END as method,
    t.status,
    t.gateway_ref,
    t.id::TEXT as order_id,
    0 as bonus,
    0 as bonus_rate,
    COALESCE(t.remarks, 'Migrated from transactions table') as remarks,
    t.created_at,
    t.updated_at,
    'transactions' as source_table
FROM public.transactions t
WHERE t.type = 'deposit'
  AND t.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_history dh 
    WHERE dh.user_id = t.user_id 
      AND dh.amount = t.amount 
      AND ABS(EXTRACT(EPOCH FROM (dh.created_at - t.created_at))) < 60
  );

-- 3. Create a function to get user's complete deposit history
CREATE OR REPLACE FUNCTION public.get_user_complete_deposit_history(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    amount NUMERIC(18,2),
    method TEXT,
    status TEXT,
    gateway_ref TEXT,
    order_id TEXT,
    bonus NUMERIC(18,2),
    bonus_rate NUMERIC(5,2),
    remarks TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        id,
        amount,
        method,
        status,
        gateway_ref,
        order_id,
        bonus,
        bonus_rate,
        remarks,
        created_at,
        updated_at
    FROM public.v_complete_deposit_history
    WHERE user_id = p_user_id
    ORDER BY created_at DESC;
$$;

-- 4. Update user total_deposit from ALL sources
UPDATE public.users u
SET total_deposit = COALESCE(
    (SELECT SUM(amount) FROM public.v_complete_deposit_history v 
     WHERE v.user_id = u.id AND v.status = 'completed'),
    0
);

-- 5. Add realtime publication for all relevant tables
DO $$
BEGIN
    -- Add tables to realtime publication if not already added
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN others THEN
    -- Tables may already be added to publication, ignore error
    NULL;
END $$;

-- 6. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deposit_history_user_id_created_at 
ON public.deposit_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_type_created_at 
ON public.transactions(user_id, type, created_at DESC) WHERE type = 'deposit';

-- 7. Report migration results
DO $$
DECLARE
    v_deposit_history_count INT;
    v_deposits_count INT;
    v_transactions_count INT;
    v_complete_count INT;
BEGIN
    SELECT COUNT(*) INTO v_deposit_history_count FROM public.deposit_history;
    SELECT COUNT(*) INTO v_deposits_count FROM public.deposits;
    SELECT COUNT(*) INTO v_transactions_count FROM public.transactions WHERE type = 'deposit' AND status = 'completed';
    SELECT COUNT(*) INTO v_complete_count FROM public.v_complete_deposit_history;
    
    RAISE NOTICE 'Recharge History Fix Complete:';
    RAISE NOTICE '- deposit_history records: %', v_deposit_history_count;
    RAISE NOTICE '- old deposits table records: %', v_deposits_count;
    RAISE NOTICE '- deposit transactions: %', v_transactions_count;
    RAISE NOTICE '- Total in complete view: %', v_complete_count;
END $$;