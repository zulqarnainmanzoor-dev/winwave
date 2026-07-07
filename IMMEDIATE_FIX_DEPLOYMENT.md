# IMMEDIATE FIX DEPLOYMENT GUIDE
# Fix: Agent Management UID not showing, Deposits showing 0

## PROBLEM
1. Agent Management shows "UID:" (empty) instead of numeric UID
2. Deposits show "Rs 0" instead of actual deposit amounts
3. SQL error: `function public.generate_numeric_uid_9digit(text) does not exist`

## SOLUTION
Simple, immediate fix that will work RIGHT NOW.

## STEP 1: DEPLOY SQL FIXES
Run this SQL in Supabase SQL Editor:

```sql
-- 1. Create the missing function
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

-- 2. Update existing users with numeric UID
UPDATE public.users 
SET referral_code = public.generate_numeric_uid(phone_number)
WHERE referral_code IS NULL OR referral_code = '' OR referral_code ~ '[A-Za-z]';

-- 3. Create SIMPLE function for agent invited members
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

-- 4. Create SIMPLE function for agent dashboard
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
    COUNT(DISTINCT u.id)::BIGINT as total_members,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposits,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      THEN dh.amount 
      ELSE 0 
    END), 0) as total_deposits,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as today_commission,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as total_commission,
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
```

## STEP 2: TEST THE FIXES
Run these test queries:

```sql
-- Test 1: Find agent with UID 146695130
SELECT id, phone_number, referral_code, is_agent 
FROM public.users 
WHERE referral_code = '146695130' 
   OR phone_number LIKE '%146695130%'
LIMIT 5;

-- Test 2: Get agent's invited members (SHOULD SHOW UID AND DEPOSITS)
SELECT * FROM public.get_agent_invited_members_simple(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 3: Get agent dashboard
SELECT * FROM public.get_agent_dashboard_simple(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 4: Check deposits for agent's invited members
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
```

## STEP 3: FRONTEND IS ALREADY UPDATED
The following files have been updated:

1. `src/admin/pages/AgentManagement.tsx` - Now uses `get_agent_invited_members_simple()`
2. `src/admin/pages/AgentManagement.tsx` - Now uses `get_agent_dashboard_simple()`

## STEP 4: DEPLOY FRONTEND
1. Build and deploy the updated frontend
2. Clear browser cache
3. Test Agent Management with UID 146695130

## EXPECTED RESULTS AFTER FIX

1. **UID WILL SHOW**: Instead of "UID:" (empty), it will show "UID: 146695130"
2. **DEPOSITS WILL SHOW**: Instead of "Deposit: Rs 0", it will show actual deposit amounts
3. **NO SQL ERRORS**: The `generate_numeric_uid` function will exist
4. **AGENT DATA WILL LOAD**: Agent dashboard will show correct member counts and deposits

## TROUBLESHOOTING

### If UID still not showing:
```sql
-- Check if agent exists
SELECT id, referral_code, phone_number FROM public.users WHERE referral_code = '146695130';

-- Check if agent has invited members
SELECT COUNT(*) FROM public.users WHERE referred_by = 'AGENT_UUID_HERE';

-- Check deposit_history for those members
SELECT COUNT(*) FROM public.deposit_history 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE referred_by = 'AGENT_UUID_HERE'
) AND status = 'completed';
```

### If deposits still 0:
1. Check if `deposit_history` has records for agent's members
2. Check if deposits have `status = 'completed'`
3. Check if `total_deposit` field in `users` table is populated

### If functions don't exist:
1. Run the SQL again
2. Check Supabase logs for errors
3. Make sure you're in the correct database

## VERIFICATION CHECKLIST

- [ ] `generate_numeric_uid` function exists
- [ ] `get_agent_invited_members_simple` function exists
- [ ] `get_agent_dashboard_simple` function exists
- [ ] Agent UID 146695130 shows in Agent Management
- [ ] Deposits show actual amounts (not Rs 0)
- [ ] No errors in browser console
- [ ] No errors in Supabase SQL Editor

## SUPPORT
If issues persist after deployment:
1. Check browser console for errors
2. Check Supabase logs for SQL errors
3. Verify the agent UUID is correct
4. Verify deposit_history has completed deposits