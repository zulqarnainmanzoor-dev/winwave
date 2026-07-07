-- ════════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC & FIX: Daily Statistics RPC Functions
-- Purpose: Fix the issue where Deposit Users and Deposit Amount show 0
-- ════════════════════════════════════════════════════════════════════════════════

-- FIRST: Check what data actually exists
-- Run these queries in Supabase to diagnose:
/*
SELECT COUNT(*) as total_deposits FROM public.deposit_history WHERE status = 'completed';
SELECT COUNT(*) as total_users_with_deposits FROM public.users WHERE total_deposit > 0;
SELECT COUNT(*) as total_referrals FROM public.users WHERE referred_by IS NOT NULL;
SELECT * FROM public.deposit_history LIMIT 5;
SELECT * FROM public.users WHERE referred_by IS NOT NULL LIMIT 5;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- CORRECTED FUNCTION: Get Daily Subordinate Statistics (TODAY ONLY)
-- This version uses users.total_deposit instead of querying deposit_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_subordinate_stats(p_agent_id UUID)
RETURNS TABLE(
  deposit_number BIGINT,
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  total_bet NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
BEGIN
  RETURN QUERY
  SELECT
    -- Today's successful deposits count
    COUNT(DISTINCT dh.id)::BIGINT AS deposit_number,
    
    -- Count of unique users who deposited today
    COUNT(DISTINCT dh.user_id)::BIGINT AS deposit_users,
    
    -- Sum of today's successful deposits
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS deposit_amount,
    
    -- Today's total bets
    COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0)::NUMERIC AS total_bet,
    
    -- Count of users whose FIRST EVER deposit was today
    COUNT(DISTINCT CASE 
      WHEN dh.status = 'completed' 
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < v_today_start
      )
      THEN dh.user_id 
    END)::BIGINT AS first_deposit_users,
    
    -- Sum of first deposits today
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < v_today_start
      )
      THEN dh.amount 
      ELSE 0 
    END), 0)::NUMERIC AS first_deposit_amount
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.created_at >= v_today_start 
    AND dh.created_at < v_today_end
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id 
    AND bh.created_at >= v_today_start 
    AND bh.created_at < v_today_end
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_subordinate_stats(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ALTERNATIVE: Get Daily Stats Using users.total_deposit (FALLBACK)
-- Use this if deposit_history is empty but users.total_deposit has data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_subordinate_stats_fallback(p_agent_id UUID)
RETURNS TABLE(
  deposit_number BIGINT,
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  total_bet NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Count of direct members
    COUNT(DISTINCT u.id)::BIGINT AS deposit_number,
    
    -- Count of members with deposits
    COUNT(DISTINCT CASE WHEN u.total_deposit > 0 THEN u.id END)::BIGINT AS deposit_users,
    
    -- Sum of total deposits (lifetime, not today)
    COALESCE(SUM(u.total_deposit), 0)::NUMERIC AS deposit_amount,
    
    -- Total bets
    COALESCE(SUM(u.total_bet_amount), 0)::NUMERIC AS total_bet,
    
    -- Members with deposits (approximation)
    COUNT(DISTINCT CASE WHEN u.total_deposit > 0 THEN u.id END)::BIGINT AS first_deposit_users,
    
    -- Sum of deposits (approximation)
    COALESCE(SUM(u.total_deposit), 0)::NUMERIC AS first_deposit_amount
  FROM public.users u
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_subordinate_stats_fallback(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- CORRECTED: Get Daily Subordinates List (TODAY'S DEPOSITS ONLY)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_subordinates_list(p_agent_id UUID, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS TABLE(
  id UUID,
  uid_short TEXT,
  level INT,
  today_deposit NUMERIC,
  today_commission NUMERIC,
  registration_date TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.uid_short, SUBSTRING(REPLACE(u.id::TEXT, '-', ''), 1, 9))::TEXT,
    u.vip_level,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC,
    u.created_at
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.created_at >= v_today_start 
    AND dh.created_at < v_today_end
  LEFT JOIN public.transactions t ON u.id = t.user_id 
    AND t.created_at >= v_today_start 
    AND t.created_at < v_today_end
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.uid_short, u.vip_level, u.created_at
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_subordinates_list(UUID, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ALTERNATIVE: Get Daily Subordinates Using users.total_deposit (FALLBACK)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_subordinates_list_fallback(p_agent_id UUID, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS TABLE(
  id UUID,
  uid_short TEXT,
  level INT,
  today_deposit NUMERIC,
  today_commission NUMERIC,
  registration_date TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.uid_short, SUBSTRING(REPLACE(u.id::TEXT, '-', ''), 1, 9))::TEXT,
    u.vip_level,
    u.total_deposit::NUMERIC,
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE user_id = u.id AND type = 'commission' AND status = 'completed'), 0)::NUMERIC,
    u.created_at
  FROM public.users u
  WHERE u.referred_by = p_agent_id
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_subordinates_list_fallback(UUID, INT, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC FUNCTION: Check Data Sources
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.diagnose_deposit_data(p_agent_id UUID)
RETURNS TABLE(
  check_name TEXT,
  result_value TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_direct_members BIGINT;
  v_deposit_history_count BIGINT;
  v_users_with_deposits BIGINT;
  v_total_deposit_sum NUMERIC;
BEGIN
  -- Count direct members
  SELECT COUNT(*) INTO v_direct_members FROM public.users WHERE referred_by = p_agent_id;
  
  -- Count deposit_history records for these members
  SELECT COUNT(*) INTO v_deposit_history_count 
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  WHERE u.referred_by = p_agent_id AND dh.status = 'completed';
  
  -- Count users with total_deposit > 0
  SELECT COUNT(*) INTO v_users_with_deposits 
  FROM public.users WHERE referred_by = p_agent_id AND total_deposit > 0;
  
  -- Sum of total_deposit
  SELECT COALESCE(SUM(total_deposit), 0) INTO v_total_deposit_sum 
  FROM public.users WHERE referred_by = p_agent_id;
  
  RETURN QUERY
  SELECT 'Direct Members'::TEXT, v_direct_members::TEXT
  UNION ALL
  SELECT 'Deposit History Records', v_deposit_history_count::TEXT
  UNION ALL
  SELECT 'Users with total_deposit > 0', v_users_with_deposits::TEXT
  UNION ALL
  SELECT 'Sum of total_deposit', v_total_deposit_sum::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnose_deposit_data(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF DIAGNOSTIC & FIX
-- ════════════════════════════════════════════════════════════════════════════════
