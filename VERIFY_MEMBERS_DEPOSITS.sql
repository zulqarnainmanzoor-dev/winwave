-- ════════════════════════════════════════════════════════════════════════════════
-- CHECK: Verify members are linked to agents
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Check all members with their referrers
SELECT u.id, u.phone_number, u.referred_by, COUNT(dh.id) as deposit_count, SUM(dh.amount) as total_deposits
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed'
WHERE u.referred_by IS NOT NULL
GROUP BY u.id, u.phone_number, u.referred_by
ORDER BY u.created_at DESC;

-- 2. Check deposits with member info
SELECT dh.id, dh.user_id, dh.amount, dh.status, dh.created_at, u.phone_number, u.referred_by
FROM public.deposit_history dh
JOIN public.users u ON dh.user_id = u.id
WHERE dh.status = 'completed'
AND dh.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY dh.created_at DESC;

-- 3. Check each agent's members and their deposits
SELECT 
  u.referred_by as agent_id,
  COUNT(DISTINCT u.id) as member_count,
  COUNT(DISTINCT dh.id) as deposit_count,
  SUM(dh.amount) as total_deposit_amount
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed' AND dh.created_at >= NOW() - INTERVAL '24 hours'
WHERE u.referred_by IS NOT NULL
GROUP BY u.referred_by;

-- 4. Test RPC function for Agent 1
SELECT * FROM public.get_subordinate_past_24h_stats('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- 5. Test RPC function for Agent 2
SELECT * FROM public.get_subordinate_past_24h_stats('6e8f78a6-d098-42dc-be11-897781f6b624'::uuid);

-- ════════════════════════════════════════════════════════════════════════════════
