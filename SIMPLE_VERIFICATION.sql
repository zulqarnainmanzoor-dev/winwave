-- SIMPLE VERIFICATION - NO ERRORS
-- Run this after deploying the quick fix

-- 1. Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('generate_numeric_uid', 'get_agent_invited_members_simple', 'get_agent_dashboard_simple')
ORDER BY routine_name;

-- 2. Find agent with UID 146695130
SELECT 
  id,
  phone_number,
  referral_code as agent_uid,
  is_agent,
  created_at
FROM public.users 
WHERE referral_code = '146695130'
LIMIT 1;

-- 3. Check agent's invited members count
SELECT 
  COUNT(*) as invited_member_count
FROM public.users 
WHERE referred_by = (
  SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1
);

-- 4. Check deposits for agent's members (simple query)
SELECT 
  u.referral_code as member_uid,
  u.phone_number,
  u.total_deposit as lifetime_deposit,
  COUNT(dh.id) as total_deposits,
  COALESCE(SUM(dh.amount), 0) as total_deposit_amount
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed'
WHERE u.referred_by = (
  SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1
)
GROUP BY u.id, u.referral_code, u.phone_number, u.total_deposit
ORDER BY u.created_at DESC
LIMIT 10;

-- 5. Test the simple function (if it exists)
-- SELECT * FROM public.get_agent_invited_members_simple(
--   (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
-- )
-- LIMIT 5;

-- 6. Check today's date for reference
SELECT 
  NOW() as current_time,
  DATE_TRUNC('day', NOW()) as today_start,
  DATE_TRUNC('day', NOW()) + INTERVAL '1 day' as today_end;

-- 7. Check if any deposits exist today
SELECT 
  COUNT(*) as today_deposit_count,
  COALESCE(SUM(amount), 0) as today_deposit_amount
FROM public.deposit_history 
WHERE status = 'completed'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
  AND user_id IN (
    SELECT id FROM public.users 
    WHERE referred_by = (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
  );

-- 8. Simple UID check
SELECT 
  phone_number,
  referral_code,
  LENGTH(referral_code) as uid_length,
  CASE 
    WHEN referral_code ~ '^[0-9]+$' THEN 'Numeric'
    WHEN referral_code ~ '[A-Za-z]' THEN 'Alphanumeric'
    ELSE 'Unknown'
  END as uid_type
FROM public.users 
WHERE phone_number IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;