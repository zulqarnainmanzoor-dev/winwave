-- ════════════════════════════════════════════════════════════════════════════════
-- CREATE TEST DATA - Insert test members and deposits
-- ════════════════════════════════════════════════════════════════════════════════

-- IMPORTANT: Replace these UUIDs with YOUR actual agent IDs from the previous query
-- Agent 1 ID: 01fc7792-9b68-4dfd-9422-a1fb3706ba03
-- Agent 2 ID: 6e8f78a6-d098-42dc-be11-897781f6b624

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create test members for Agent 1
-- ════════════════════════════════════════════════════════════════════════════════

-- Create test member 1
INSERT INTO public.users (
  id,
  phone_number,
  referred_by,
  main_balance,
  game_balance,
  total_deposit,
  vip_level,
  is_agent,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '3001111111',
  '01fc7792-9b68-4dfd-9422-a1fb3706ba03',
  0,
  0,
  5000,
  0,
  FALSE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create test member 2
INSERT INTO public.users (
  id,
  phone_number,
  referred_by,
  main_balance,
  game_balance,
  total_deposit,
  vip_level,
  is_agent,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '3001111112',
  '01fc7792-9b68-4dfd-9422-a1fb3706ba03',
  0,
  0,
  2500,
  0,
  FALSE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create test member 3
INSERT INTO public.users (
  id,
  phone_number,
  referred_by,
  main_balance,
  game_balance,
  total_deposit,
  vip_level,
  is_agent,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '3001111113',
  '01fc7792-9b68-4dfd-9422-a1fb3706ba03',
  0,
  0,
  1000,
  0,
  FALSE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create test deposits for these members
-- ════════════════════════════════════════════════════════════════════════════════

-- Get the member IDs we just created and insert deposits
INSERT INTO public.deposit_history (
  user_id,
  amount,
  method,
  status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  5000,
  'PKPAY',
  'completed',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
FROM public.users u
WHERE u.phone_number = '3001111111'
AND u.referred_by = '01fc7792-9b68-4dfd-9422-a1fb3706ba03'
LIMIT 1;

INSERT INTO public.deposit_history (
  user_id,
  amount,
  method,
  status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  2500,
  'PKPAY',
  'completed',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour'
FROM public.users u
WHERE u.phone_number = '3001111112'
AND u.referred_by = '01fc7792-9b68-4dfd-9422-a1fb3706ba03'
LIMIT 1;

INSERT INTO public.deposit_history (
  user_id,
  amount,
  method,
  status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  1000,
  'PKPAY',
  'completed',
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '30 minutes'
FROM public.users u
WHERE u.phone_number = '3001111113'
AND u.referred_by = '01fc7792-9b68-4dfd-9422-a1fb3706ba03'
LIMIT 1;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY: Check if test data was created
-- ════════════════════════════════════════════════════════════════════════════════

-- Check members created
SELECT COUNT(*) as member_count
FROM public.users
WHERE referred_by = '01fc7792-9b68-4dfd-9422-a1fb3706ba03';

-- Check deposits created
SELECT COUNT(*) as deposit_count, SUM(amount) as total_amount
FROM public.deposit_history
WHERE status = 'completed'
AND created_at >= NOW() - INTERVAL '24 hours';

-- Test the RPC function
SELECT * FROM public.get_subordinate_past_24h_stats('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- ════════════════════════════════════════════════════════════════════════════════
