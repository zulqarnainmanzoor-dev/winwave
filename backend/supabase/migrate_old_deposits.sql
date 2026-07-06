-- ================================================================
-- MIGRATE OLD DEPOSITS TO DEPOSIT_HISTORY
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Migrate from deposits table (old agent system)
INSERT INTO public.deposit_history (
  id,
  user_id,
  amount,
  method,
  status,
  remarks,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  d.user_id,
  d.amount,
  'PKPAY' as method,
  'completed' as status,
  'Migrated from old deposits table' as remarks,
  d.created_at,
  d.created_at as updated_at
FROM public.deposits d
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_history dh 
  WHERE dh.user_id = d.user_id 
    AND dh.amount = d.amount 
    AND ABS(EXTRACT(EPOCH FROM (dh.created_at - d.created_at))) < 60
)
ON CONFLICT DO NOTHING;

-- 2. Migrate from transactions table where type = 'deposit'
INSERT INTO public.deposit_history (
  id,
  user_id,
  amount,
  method,
  status,
  gateway_ref,
  remarks,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  t.user_id,
  t.amount,
  CASE 
    WHEN t.gateway_ref LIKE '%jazz%' THEN 'JAZZCASH'
    WHEN t.gateway_ref LIKE '%easy%' THEN 'EASYPAISA'
    ELSE 'PKPAY'
  END as method,
  'completed' as status,
  t.gateway_ref,
  COALESCE(t.remarks, 'Migrated from transactions table') as remarks,
  t.created_at,
  t.created_at as updated_at
FROM public.transactions t
WHERE t.type = 'deposit'
  AND t.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_history dh 
    WHERE dh.user_id = t.user_id 
      AND dh.amount = t.amount 
      AND ABS(EXTRACT(EPOCH FROM (dh.created_at - t.created_at))) < 60
  )
ON CONFLICT DO NOTHING;

-- 3. Update user total_deposit from migrated records
UPDATE public.users u
SET total_deposit = COALESCE(
  (SELECT SUM(amount) FROM public.deposit_history dh WHERE dh.user_id = u.id AND dh.status = 'completed'),
  0
)
WHERE EXISTS (
  SELECT 1 FROM public.deposit_history dh WHERE dh.user_id = u.id
);

-- 4. Create view for backward compatibility
CREATE OR REPLACE VIEW public.v_all_deposits AS
SELECT 
  dh.id,
  dh.user_id,
  dh.amount,
  dh.method,
  dh.status,
  dh.gateway_ref,
  dh.order_id,
  dh.remarks,
  dh.created_at,
  dh.updated_at,
  u.phone_number,
  u.invite_code
FROM public.deposit_history dh
LEFT JOIN public.users u ON dh.user_id = u.id
ORDER BY dh.created_at DESC;

-- 5. Add realtime publication for deposit_history if not already added
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_history;
EXCEPTION WHEN others THEN
  -- Already added, ignore error
  NULL;
END $$;

-- 6. Report migration results
DO $$
DECLARE
  v_deposits_count INT;
  v_transactions_count INT;
  v_total_count INT;
BEGIN
  SELECT COUNT(*) INTO v_deposits_count FROM public.deposits;
  SELECT COUNT(*) INTO v_transactions_count FROM public.transactions WHERE type = 'deposit' AND status = 'completed';
  SELECT COUNT(*) INTO v_total_count FROM public.deposit_history;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '- Old deposits table records: %', v_deposits_count;
  RAISE NOTICE '- Deposit transactions: %', v_transactions_count;
  RAISE NOTICE '- Total in deposit_history: %', v_total_count;
END $$;