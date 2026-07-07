-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Agent Dashboard RPC Functions
-- Purpose: Provide real production data for Agent Management Dashboard
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Dashboard Stats (Today + Total)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_dashboard_stats(p_agent_id UUID)
RETURNS TABLE(
  today_deposits NUMERIC,
  today_withdrawals NUMERIC,
  today_bets NUMERIC,
  today_commission NUMERIC,
  total_deposits NUMERIC,
  total_withdrawals NUMERIC,
  total_bets NUMERIC,
  total_commission NUMERIC,
  total_members BIGINT,
  active_members BIGINT,
  inactive_members BIGINT,
  pending_deposits BIGINT,
  pending_withdrawals BIGINT
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
    -- Today's stats
    COALESCE(SUM(CASE WHEN dh.created_at >= v_today_start AND dh.created_at < v_today_end AND dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposits,
    COALESCE(SUM(CASE WHEN wh.created_at >= v_today_start AND wh.created_at < v_today_end AND wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdrawals,
    COALESCE(SUM(CASE WHEN bh.created_at >= v_today_start AND bh.created_at < v_today_end AND bh.status = 'completed' THEN bh.amount ELSE 0 END), 0)::NUMERIC AS today_bets,
    COALESCE(SUM(CASE WHEN t.created_at >= v_today_start AND t.created_at < v_today_end AND t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS today_commission,
    
    -- Total stats
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS total_withdrawals,
    COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0)::NUMERIC AS total_bets,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS total_commission,
    
    -- Member counts
    COUNT(DISTINCT u.id)::BIGINT AS total_members,
    COUNT(DISTINCT CASE WHEN u.total_bets > 0 THEN u.id END)::BIGINT AS active_members,
    COUNT(DISTINCT CASE WHEN u.total_bets = 0 THEN u.id END)::BIGINT AS inactive_members,
    COUNT(DISTINCT CASE WHEN dh.status = 'pending' THEN dh.id END)::BIGINT AS pending_deposits,
    COUNT(DISTINCT CASE WHEN wh.status = 'pending' THEN wh.id END)::BIGINT AS pending_withdrawals
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON u.id = wh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_dashboard_stats(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Team Deposits (Recursive Hierarchy)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_team_deposits(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  personal_deposit NUMERIC,
  team_deposit NUMERIC,
  today_deposit NUMERIC,
  total_deposit NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all_subordinates UUID[] := ARRAY[p_agent_id];
  v_current_level UUID[];
  v_i INT := 0;
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
BEGIN
  -- Build hierarchy: collect all subordinates up to p_max_level
  v_current_level := ARRAY[p_agent_id];
  
  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users
    WHERE referred_by = ANY(v_current_level);
    
    IF v_current_level IS NOT NULL THEN
      v_all_subordinates := v_all_subordinates || v_current_level;
    ELSE
      v_current_level := ARRAY[]::UUID[];
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    -- Personal deposit (agent's own deposits)
    COALESCE(SUM(CASE WHEN dh.user_id = p_agent_id AND dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS personal_deposit,
    
    -- Team deposit (all subordinates' successful deposits)
    COALESCE(SUM(CASE WHEN dh.user_id != p_agent_id AND dh.user_id = ANY(v_all_subordinates) AND dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS team_deposit,
    
    -- Today's deposit (agent + team)
    COALESCE(SUM(CASE WHEN dh.user_id = ANY(v_all_subordinates) AND dh.status = 'completed' AND dh.created_at >= v_today_start AND dh.created_at < v_today_end THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposit,
    
    -- Total deposit (agent + team)
    COALESCE(SUM(CASE WHEN dh.user_id = ANY(v_all_subordinates) AND dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_deposit
  FROM public.deposit_history dh;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_deposits(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Commission History
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_commission_history(p_agent_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE(
  id UUID,
  member_uid TEXT,
  member_phone TEXT,
  deposit_amount NUMERIC,
  commission_amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    u.referral_code::TEXT,
    u.phone_number::TEXT,
    dh.amount,
    t.amount,
    t.status,
    t.created_at
  FROM public.transactions t
  JOIN public.users u ON t.user_id = u.id
  LEFT JOIN public.deposit_history dh ON dh.user_id = u.id AND dh.status = 'completed'
  WHERE t.user_id = p_agent_id
    AND t.type = 'commission'
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_commission_history(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Member Details (with real UID)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_members(p_agent_id UUID, p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_withdrawal NUMERIC,
  total_bets NUMERIC,
  commission_earned NUMERIC,
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
    COALESCE(u.referral_code, u.invite_code)::TEXT,
    u.phone_number,
    u.total_deposit,
    u.total_withdrawal,
    u.total_bet_amount,
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE user_id = u.id AND type = 'commission' AND status = 'completed'), 0)::NUMERIC,
    u.created_at
  FROM public.users u
  WHERE u.referred_by = p_agent_id
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_members(UUID, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Search Agent Members by UID or Phone
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_agent_members(p_agent_id UUID, p_search_term TEXT, p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_withdrawal NUMERIC,
  total_bets NUMERIC,
  commission_earned NUMERIC,
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
    COALESCE(u.referral_code, u.invite_code)::TEXT,
    u.phone_number,
    u.total_deposit,
    u.total_withdrawal,
    u.total_bet_amount,
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE user_id = u.id AND type = 'commission' AND status = 'completed'), 0)::NUMERIC,
    u.created_at
  FROM public.users u
  WHERE u.referred_by = p_agent_id
    AND (
      u.referral_code ILIKE '%' || p_search_term || '%'
      OR u.phone_number ILIKE '%' || p_search_term || '%'
      OR u.invite_code ILIKE '%' || p_search_term || '%'
    )
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_agent_members(UUID, TEXT, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
