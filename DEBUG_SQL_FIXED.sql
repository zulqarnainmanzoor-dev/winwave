-- ════════════════════════════════════════════════════════════════════════════════
-- DEBUG: Check what data exists - FIXED VERSION
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Check if you have any members (direct invites)
SELECT referred_by as agent_id, COUNT(*) as member_count
FROM public.users 
WHERE referred_by IS NOT NULL
GROUP BY referred_by
LIMIT 10;

-- 2. Check if you have any deposits in past 24 hours
SELECT COUNT(*) as deposit_count, SUM(amount) as total_amount
FROM public.deposit_history
WHERE status = 'completed'
AND created_at >= NOW() - INTERVAL '24 hours';

-- 3. Check all users and their referrers
SELECT id, phone_number, referred_by, total_deposit, created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check deposit history
SELECT user_id, amount, status, created_at
FROM public.deposit_history
ORDER BY created_at DESC
LIMIT 20;

-- 5. Get YOUR agent ID (the one with no referrer)
SELECT id, phone_number, referred_by
FROM public.users
WHERE referred_by IS NULL
LIMIT 5;

-- 6. After getting your agent ID, check your members
-- Replace YOUR_AGENT_ID with the id from query 5
-- SELECT COUNT(*) as your_member_count
-- FROM public.users
-- WHERE referred_by = 'YOUR_AGENT_ID'::uuid;

-- 7. Check deposits from YOUR members
-- Replace YOUR_AGENT_ID with the id from query 5
-- SELECT dh.user_id, dh.amount, dh.status, dh.created_at
-- FROM public.deposit_history dh
-- JOIN public.users u ON dh.user_id = u.id
-- WHERE u.referred_by = 'YOUR_AGENT_ID'::uuid
-- AND dh.status = 'completed'
-- AND dh.created_at >= NOW() - INTERVAL '24 hours'
-- ORDER BY dh.created_at DESC;

-- ════════════════════════════════════════════════════════════════════════════════
