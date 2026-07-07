-- ════════════════════════════════════════════════════════════════════════════════
-- CHECK: All members and deposits in system
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Check ALL users with referrers (members)
SELECT id, phone_number, referred_by, total_deposit, created_at
FROM public.users
WHERE referred_by IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;

-- 2. Check ALL deposits
SELECT user_id, amount, status, created_at
FROM public.deposit_history
ORDER BY created_at DESC
LIMIT 50;

-- 3. Check if ANY user has referred_by set
SELECT COUNT(*) as total_members
FROM public.users
WHERE referred_by IS NOT NULL;

-- 4. Check total deposits
SELECT COUNT(*) as total_deposits, SUM(amount) as total_amount
FROM public.deposit_history
WHERE status = 'completed';

-- 5. Check deposits in past 24 hours
SELECT COUNT(*) as deposits_24h, SUM(amount) as amount_24h
FROM public.deposit_history
WHERE status = 'completed'
AND created_at >= NOW() - INTERVAL '24 hours';

-- ════════════════════════════════════════════════════════════════════════════════
-- RESULT INTERPRETATION:
-- ════════════════════════════════════════════════════════════════════════════════

-- If query 1 shows 0 rows:
-- → NO MEMBERS EXIST IN SYSTEM
-- → This is why Invitees Overview shows 0
-- → You need to create test members first

-- If query 2 shows 0 rows:
-- → NO DEPOSITS EXIST IN SYSTEM
-- → Members need to make deposits

-- If query 3 shows 0:
-- → NO MEMBERS EXIST
-- → Need to create test data

-- ════════════════════════════════════════════════════════════════════════════════
