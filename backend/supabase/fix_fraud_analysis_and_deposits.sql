-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix Fraud Analysis and Deposit Stats
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Analyze Agent Network Fraud
-- FIX: Removed cross-join between dh and wh (was multiplying sums).
--      Now queries deposit_history and withdrawal_history separately.
--      Covers full recursive team (7 levels), not just direct members.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Dashboard Stats (FIXED - includes real deposit data)
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
-- FUNCTION: Get Agent Team Deposits (FIXED - real deposit data)
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
  -- Build hierarchy
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

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
