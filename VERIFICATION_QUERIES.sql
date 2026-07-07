-- VERIFICATION QUERIES FOR ALL FIXES
-- Run these in Supabase SQL Editor after deploying fixes

-- 1. Verify Numeric UID Generation
SELECT 
  phone_number, 
  referral_code, 
  LENGTH(referral_code) as uid_length,
  referral_code ~ '^[0-9]+$' as is_numeric,
  public.generate_numeric_uid_9digit(phone_number) as new_numeric_uid
FROM public.users 
WHERE phone_number IS NOT NULL 
LIMIT 10;

-- 2. Verify Platform Past 24h Deposits
SELECT * FROM public.get_platform_past_24h_deposits_complete();

-- 3. Verify Commission Calculation
SELECT 
  300 as deposit_amount,
  0 as vip_level,
  public.calculate_deposit_commission(300, 0) as l0_commission,
  300 * 0.003 as expected_l0,
  
  1 as vip_level,
  public.calculate_deposit_commission(300, 1) as l1_commission,
  300 * 0.0035 as expected_l1,
  
  6 as vip_level,
  public.calculate_deposit_commission(300, 6) as l6_commission,
  300 * 0.005 as expected_l6;

-- 4. Verify VIP Level Requirements
SELECT 
  total_bets,
  vip_level,
  CASE
    WHEN COALESCE(total_bets, 0) < 62500 THEN 0
    WHEN COALESCE(total_bets, 0) < 250000 THEN 1
    WHEN COALESCE(total_bets, 0) < 500000 THEN 2
    WHEN COALESCE(total_bets, 0) < 1000000 THEN 3
    WHEN COALESCE(total_bets, 0) < 5000000 THEN 4
    WHEN COALESCE(total_bets, 0) < 10000000 THEN 5
    WHEN COALESCE(total_bets, 0) < 50000000 THEN 6
    WHEN COALESCE(total_bets, 0) < 100000000 THEN 7
    WHEN COALESCE(total_bets, 0) < 500000000 THEN 8
    WHEN COALESCE(total_bets, 0) < 1000000000 THEN 9
    ELSE 10
  END as calculated_vip_level
FROM public.users 
WHERE total_bets >= 60000  -- Show users near the 62,500 threshold
ORDER BY total_bets 
LIMIT 10;

-- 5. Verify Agent Functions Exist
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_platform_past_24h_deposits_complete',
    'get_agent_team_today_deposits',
    'get_agent_invited_members_complete',
    'calculate_deposit_commission',
    'generate_numeric_uid_9digit'
  )
ORDER BY routine_name;

-- 6. Check Today's Deposits for a Specific Agent (Replace AGENT_UUID)
-- SELECT * FROM public.get_agent_team_today_deposits('AGENT_UUID_HERE');

-- 7. Check Invited Members for a Specific Agent (Replace AGENT_UUID)
-- SELECT * FROM public.get_agent_invited_members_complete('AGENT_UUID_HERE');

-- 8. Verify Direct vs Team Invites Stats (Replace AGENT_UUID)
-- SELECT * FROM public.get_agent_direct_invites_stats('AGENT_UUID_HERE');
-- SELECT * FROM public.get_agent_team_invites_stats('AGENT_UUID_HERE');

-- 9. Check Trigger Exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_set_numeric_uid_9digit', 'trg_update_vip_on_bet', 'trg_deposit_approved_fixed');

-- 10. Sample Data for Testing Commission
-- Find an agent with invited members who have made deposits
SELECT 
  u.id as agent_id,
  u.referral_code as agent_uid,
  u.vip_level as agent_vip,
  COUNT(DISTINCT m.id) as invited_member_count,
  COUNT(DISTINCT dh.id) as member_deposit_count,
  COALESCE(SUM(dh.amount), 0) as total_member_deposits
FROM public.users u
LEFT JOIN public.users m ON m.referred_by = u.id
LEFT JOIN public.deposit_history dh ON dh.user_id = m.id AND dh.status = 'completed'
WHERE u.is_agent = true
  AND m.id IS NOT NULL
GROUP BY u.id, u.referral_code, u.vip_level
HAVING COUNT(DISTINCT m.id) > 0
LIMIT 5;