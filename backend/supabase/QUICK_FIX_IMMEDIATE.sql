-- ════════════════════════════════════════════════════════════════════════════════
-- QUICK IMMEDIATE FIX FOR AGENT MANAGEMENT
-- Fixes: UID not showing, Deposits showing 0, Agent data not displaying
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. FIRST: Create the missing function that's causing the error
CREATE OR REPLACE FUNCTION public.generate_numeric_uid(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_phone_digits TEXT;
  v_hash TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
  END IF;
  
  -- Extract only digits from phone
  v_phone_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  
  -- If phone has enough digits, use last 9 digits
  IF LENGTH(v_phone_digits) >= 9 THEN
    RETURN SUBSTRING(v_phone_digits FROM LENGTH(v_phone_digits) - 8 FOR 9);
  END IF;
  
  -- Fallback: hash the phone and take first 9 digits
  v_hash := MD5(p_phone);
  v_hash := REGEXP_REPLACE(v_hash, '[^0-9]', '', 'g');
  
  -- Ensure we have 9 digits
  WHILE LENGTH(v_hash) < 9 LOOP
    v_hash := v_hash || v_hash;
  END LOOP;
  
  RETURN SUBSTRING(v_hash FROM 1 FOR 9);
END;
$$;

-- 2. Update existing users with numeric UID (if needed)
UPDATE public.users 
SET referral_code = public.generate_numeric_uid(phone_number)
WHERE referral_code IS NULL OR referral_code = '' OR referral_code ~ '[A-Za-z]';

-- 3. SIMPLE FUNCTION: Get agent's invited members WITH DEPOSITS
CREATE OR REPLACE FUNCTION public.get_agent_invited_members_simple(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  member_uid TEXT,
  member_phone TEXT,
  lifetime_deposit NUMERIC,
  today_deposit NUMERIC,
  total_bets NUMERIC,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, public.generate_numeric_uid(u.phone_number)) as member_uid,
    u.phone_number,
    COALESCE(u.total_deposit, 0) as lifetime_deposit,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposit,
    COALESCE(u.total_bets, 0) as total_bets,
    u.created_at
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.referral_code, u.phone_number, u.total_deposit, u.total_bets, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_invited_members_simple(UUID) TO authenticated;

-- 4. SIMPLE FUNCTION: Get agent dashboard stats
CREATE OR REPLACE FUNCTION public.get_agent_dashboard_simple(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  today_deposits NUMERIC,
  total_deposits NUMERIC,
  today_commission NUMERIC,
  total_commission NUMERIC,
  agent_uid TEXT,
  agent_phone TEXT,
  agent_vip_level INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT
    -- Total members
    COUNT(DISTINCT u.id)::BIGINT as total_members,
    
    -- Today's deposits from members
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposits,
    
    -- Total deposits from members
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      THEN dh.amount 
      ELSE 0 
    END), 0) as total_deposits,
    
    -- Today's commission (0.3% of today's deposits)
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as today_commission,
    
    -- Total commission (0.3% of all deposits)
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as total_commission,
    
    -- Agent info
    a.referral_code as agent_uid,
    a.phone_number as agent_phone,
    COALESCE(a.vip_level, 0) as agent_vip_level
    
  FROM public.users a
  LEFT JOIN public.users u ON u.referred_by = a.id
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  WHERE a.id = p_agent_id
  GROUP BY a.id, a.referral_code, a.phone_number, a.vip_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_dashboard_simple(UUID) TO authenticated;

-- 5. Update frontend AgentManagement component to use SIMPLE functions
-- This is a note for the developer to update the frontend code

-- 6. TEST QUERIES - Run these to verify

-- Test 1: Find agent with UID 146695130
SELECT id, phone_number, referral_code, is_agent 
FROM public.users 
WHERE referral_code = '146695130' 
   OR phone_number LIKE '%146695130%'
   OR id::TEXT LIKE '%146695130%'
LIMIT 5;

-- Test 2: Get agent's invited members
SELECT * FROM public.get_agent_invited_members_simple(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 3: Get agent dashboard
SELECT * FROM public.get_agent_dashboard_simple(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 4: Check if agent has any invited members
SELECT COUNT(*) as invited_member_count
FROM public.users 
WHERE referred_by = (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1);

-- Test 5: Check deposits for agent's invited members
SELECT 
  u.id,
  u.referral_code as member_uid,
  u.phone_number,
  u.total_deposit,
  COUNT(dh.id) as deposit_count,
  COALESCE(SUM(dh.amount), 0) as total_deposit_amount
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed'
WHERE u.referred_by = (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
GROUP BY u.id, u.referral_code, u.phone_number, u.total_deposit
ORDER BY u.created_at DESC;

-- 7. FIX for frontend: Update AgentManagement.tsx to use simple functions
-- Replace the invited members query with:
-- const { data: invitedMembers, error: invitedError } = await (adminSupabase as any)
--   .rpc('get_agent_invited_members_simple', { p_agent_id: user.id });

-- 8. If still showing 0 deposits, check deposit_history table
SELECT 
  COUNT(*) as total_deposits,
  COUNT(DISTINCT user_id) as unique_users,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.deposit_history 
WHERE status = 'completed'
  AND user_id IN (
    SELECT id FROM public.users 
    WHERE referred_by = (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
  );