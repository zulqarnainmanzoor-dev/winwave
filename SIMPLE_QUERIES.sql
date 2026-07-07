-- ════════════════════════════════════════════════════════════════════════════════
-- SIMPLIFIED QUERIES - No complex joins
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Check all members (users with referred_by set)
SELECT id, phone_number, referred_by, created_at
FROM public.users
WHERE referred_by IS NOT NULL
ORDER BY created_at DESC;

-- 2. Check all deposits
SELECT user_id, amount, status, created_at
FROM public.deposit_history
WHERE status = 'completed'
ORDER BY created_at DESC;

-- 3. Count members
SELECT COUNT(*) as total_members
FROM public.users
WHERE referred_by IS NOT NULL;

-- 4. Count deposits in past 24h
SELECT COUNT(*) as deposits_24h, SUM(amount) as total_amount
FROM public.deposit_history
WHERE status = 'completed'
AND created_at >= NOW() - INTERVAL '24 hours';

-- 5. Check Agent 1's members
SELECT COUNT(*) as agent1_members
FROM public.users
WHERE referred_by = '01fc7792-9b68-4dfd-9422-a1fb3706ba03';

-- 6. Check Agent 2's members
SELECT COUNT(*) as agent2_members
FROM public.users
WHERE referred_by = '6e8f78a6-d098-42dc-be11-897781f6b624';

-- ════════════════════════════════════════════════════════════════════════════════
