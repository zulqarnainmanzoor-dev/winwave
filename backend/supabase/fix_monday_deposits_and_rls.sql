-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix Monday Deposits and RLS for Invitees
-- Purpose: 1. Add RLS policy for users to see their direct referrals
--          2. Create RPC for custom date range stats (Monday deposits)
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICY: Allow users to see their direct referrals
-- This fixes NewInviteesView.tsx and other components using regular supabase client
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_select_referrals" ON public.users;

CREATE POLICY "users_select_referrals"
  ON public.users FOR SELECT
  USING (auth.uid() = referred_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Custom Date Range Subordinate Statistics
-- Use this for Monday deposits or any custom date range
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_custom_date_subordinate_stats(
  p_agent_id UUID,
  p_date_start TIMESTAMPTZ,
  p_date_end TIMESTAMPTZ
)
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
    -- Successful deposits count in date range
    COUNT(DISTINCT dh.id)::BIGINT AS deposit_number,
    
    -- Count of unique users who deposited in date range
    COUNT(DISTINCT dh.user_id)::BIGINT AS deposit_users,
    
    -- Sum of successful deposits in date range
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS deposit_amount,
    
    -- Total bets in date range
    COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0)::NUMERIC AS total_bet,
    
    -- Count of users whose FIRST EVER deposit was in this date range
    COUNT(DISTINCT CASE 
      WHEN dh.status = 'completed' 
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < p_date_start
      )
      THEN dh.user_id 
    END)::BIGINT AS first_deposit_users,
    
    -- Sum of first deposits in date range
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < p_date_start
      )
      THEN dh.amount 
      ELSE 0 
    END), 0)::NUMERIC AS first_deposit_amount
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.created_at >= p_date_start 
    AND dh.created_at < p_date_end
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id 
    AND bh.created_at >= p_date_start 
    AND bh.created_at < p_date_end
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_custom_date_subordinate_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Monday Subordinate Statistics (specific for Monday)
-- This is a convenience wrapper for Monday deposits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_monday_subordinate_stats(p_agent_id UUID)
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
  v_monday_start TIMESTAMPTZ;
  v_monday_end   TIMESTAMPTZ;
BEGIN
  -- Calculate Monday of current week (Monday 00:00 to Tuesday 00:00)
  v_monday_start := DATE_TRUNC('week', NOW())::TIMESTAMPTZ;
  v_monday_end   := v_monday_start + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT * FROM public.get_custom_date_subordinate_stats(
    p_agent_id,
    v_monday_start,
    v_monday_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monday_subordinate_stats(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Fix analyze_agent_network_fraud (remove cross-join bug)
-- This fixes the Agent Fraud Analysis popup showing zeros
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.analyze_agent_network_fraud(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  total_network_accounts BIGINT,
  unique_genuine_profiles BIGINT,
  today_deposits NUMERIC,
  today_withdrawals NUMERIC,
  lifetime_deposits NUMERIC,
  lifetime_withdrawals NUMERIC,
  flagged_accounts JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start        TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end          TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
  v_all_members        UUID[];
  v_current_level      UUID[];
  v_i                  INT := 0;
  v_total_accounts     BIGINT;
  v_genuine_profiles   BIGINT;
  v_today_dep          NUMERIC;
  v_today_with         NUMERIC;
  v_lifetime_dep       NUMERIC;
  v_lifetime_with      NUMERIC;
BEGIN
  -- Build full recursive team (direct + all downstream levels)
  v_all_members   := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];

  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users WHERE referred_by = ANY(v_current_level);
    IF v_current_level IS NOT NULL THEN
      v_all_members := v_all_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Exclude the agent themselves from member counts
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE total_deposit > 0)::BIGINT
  INTO v_total_accounts, v_genuine_profiles
  FROM public.users
  WHERE id = ANY(v_all_members) AND id <> p_agent_id;

  -- Deposits (separate query — no cross-join)
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= v_today_start AND created_at < v_today_end THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_today_dep, v_lifetime_dep
  FROM public.deposit_history
  WHERE user_id = ANY(v_all_members) AND status = 'completed';

  -- Withdrawals (separate query — no cross-join)
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= v_today_start AND created_at < v_today_end THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_today_with, v_lifetime_with
  FROM public.withdrawal_history
  WHERE user_id = ANY(v_all_members) AND status = 'completed';

  RETURN QUERY SELECT
    v_total_accounts,
    v_genuine_profiles,
    v_today_dep,
    v_today_with,
    v_lifetime_dep,
    v_lifetime_with,
    '[]'::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_network_fraud(UUID, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════