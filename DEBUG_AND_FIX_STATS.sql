-- ════════════════════════════════════════════════════════════════════════════════
-- DEBUG: Check what data exists
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Check if you have any members (direct invites)
SELECT COUNT(*) as member_count, id as agent_id
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

-- ════════════════════════════════════════════════════════════════════════════════
-- FIX: Drop and recreate the function with SIMPLER logic
-- ════════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_subordinate_past_24h_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_subordinate_past_24h_stats(p_agent_id UUID)
RETURNS TABLE(
  deposit_count BIGINT,
  deposit_amount NUMERIC,
  deposit_users BIGINT,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC,
  total_bet NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(dh.id)::BIGINT,
    COALESCE(SUM(dh.amount), 0),
    COUNT(DISTINCT dh.user_id)::BIGINT,
    COUNT(DISTINCT dh.user_id)::BIGINT,
    COALESCE(SUM(dh.amount), 0),
    0::NUMERIC
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  WHERE u.referred_by = p_agent_id
  AND dh.status = 'completed'
  AND dh.created_at >= NOW() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subordinate_past_24h_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST: Run this with YOUR actual agent UUID
-- ════════════════════════════════════════════════════════════════════════════════

-- First, get your agent UUID:
SELECT id, phone_number FROM public.users LIMIT 1;

-- Then test the function (replace UUID):
-- SELECT * FROM public.get_subordinate_past_24h_stats('YOUR_UUID_HERE'::uuid);

-- ════════════════════════════════════════════════════════════════════════════════
