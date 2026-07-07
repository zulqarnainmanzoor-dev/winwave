-- ════════════════════════════════════════════════════════════════════════════════
-- AGENT STATISTICS RPC FUNCTIONS
-- Add these to MASTER_PRODUCTION_SCHEMA.sql or run separately
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Get Agent Team Statistics (Direct + Recursive)
CREATE OR REPLACE FUNCTION public.get_agent_team_stats(p_agent_id UUID)
RETURNS TABLE(
  total_deposit NUMERIC,
  today_deposit NUMERIC,
  total_withdraw NUMERIC,
  today_withdraw NUMERIC,
  active_members BIGINT,
  total_members BIGINT,
  first_deposit_users BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  WITH RECURSIVE team AS (
    -- Base: the agent themselves
    SELECT id FROM public.users WHERE id = p_agent_id
    UNION ALL
    -- Recursive: all users referred by team members
    SELECT u.id FROM public.users u
    INNER JOIN team t ON u.referred_by = t.id
  )
  SELECT
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_deposit,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposit,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS total_withdraw,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdraw,
    COUNT(DISTINCT CASE WHEN bh.id IS NOT NULL THEN team_users.id END)::BIGINT AS active_members,
    COUNT(DISTINCT team_users.id)::BIGINT AS total_members,
    COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN team_users.id END)::BIGINT AS first_deposit_users
  FROM team team_users
  LEFT JOIN public.deposit_history dh ON team_users.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON team_users.id = wh.user_id
  LEFT JOIN public.betting_history bh ON team_users.id = bh.user_id AND bh.status = 'completed'
  WHERE team_users.id != p_agent_id; -- Exclude agent themselves
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_stats(UUID) TO authenticated;

-- 2. Get Agent Commission Statistics
CREATE OR REPLACE FUNCTION public.get_agent_commission_stats(p_agent_id UUID)
RETURNS TABLE(
  total_commission NUMERIC,
  today_commission NUMERIC,
  yesterday_commission NUMERIC,
  pending_commission NUMERIC,
  claimed_commission NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_yesterday_start := v_today_start - INTERVAL '1 day';
  v_yesterday_end := v_today_start;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS total_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' AND t.created_at >= v_today_start THEN t.amount ELSE 0 END), 0)::NUMERIC AS today_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' AND t.created_at >= v_yesterday_start AND t.created_at < v_yesterday_end THEN t.amount ELSE 0 END), 0)::NUMERIC AS yesterday_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'pending' THEN t.amount ELSE 0 END), 0)::NUMERIC AS pending_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS claimed_commission
  FROM public.transactions t
  WHERE t.user_id = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_commission_stats(UUID) TO authenticated;

-- 3. Get Invitees Statistics
CREATE OR REPLACE FUNCTION public.get_invitees_stats(p_agent_id UUID)
RETURNS TABLE(
  total_deposit_amount NUMERIC,
  number_of_bettors BIGINT,
  first_deposit_users BIGINT,
  total_bet_amount NUMERIC,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH direct_invitees AS (
    SELECT id FROM public.users WHERE referred_by = p_agent_id
  ),
  first_deposits AS (
    SELECT DISTINCT ON (dh.user_id) dh.user_id, dh.amount, dh.created_at
    FROM public.deposit_history dh
    WHERE dh.user_id IN (SELECT id FROM direct_invitees)
      AND dh.status = 'completed'
    ORDER BY dh.user_id, dh.created_at ASC
  )
  SELECT
    COALESCE(SUM(dh.amount), 0)::NUMERIC AS total_deposit_amount,
    COUNT(DISTINCT bh.user_id)::BIGINT AS number_of_bettors,
    COUNT(DISTINCT fd.user_id)::BIGINT AS first_deposit_users,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_bet_amount,
    COALESCE(SUM(fd.amount), 0)::NUMERIC AS first_deposit_amount
  FROM direct_invitees di
  LEFT JOIN public.deposit_history dh ON di.id = dh.user_id AND dh.status = 'completed'
  LEFT JOIN public.betting_history bh ON di.id = bh.user_id AND bh.status = 'completed'
  LEFT JOIN first_deposits fd ON di.id = fd.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitees_stats(UUID) TO authenticated;

-- 4. Get Subordinate Individual Statistics
CREATE OR REPLACE FUNCTION public.get_subordinate_stats(p_subordinate_id UUID)
RETURNS TABLE(
  uid_short TEXT,
  registration_date TIMESTAMPTZ,
  today_deposit NUMERIC,
  lifetime_deposit NUMERIC,
  total_bet NUMERIC,
  commission NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  SELECT
    SUBSTRING(u.id::TEXT, 1, 8)::TEXT AS uid_short,
    u.created_at AS registration_date,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposit,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS lifetime_deposit,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_bet,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS commission
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id AND bh.status = 'completed'
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.id = p_subordinate_id
  GROUP BY u.id, u.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subordinate_stats(UUID) TO authenticated;

-- 5. Get Network Analysis
CREATE OR REPLACE FUNCTION public.get_network_analysis(p_agent_id UUID)
RETURNS TABLE(
  total_network_accounts BIGINT,
  genuine_profiles BIGINT,
  today_deposits NUMERIC,
  today_withdrawals NUMERIC,
  lifetime_deposits NUMERIC,
  lifetime_withdrawals NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  WITH RECURSIVE team AS (
    SELECT id FROM public.users WHERE id = p_agent_id
    UNION ALL
    SELECT u.id FROM public.users u
    INNER JOIN team t ON u.referred_by = t.id
  )
  SELECT
    COUNT(DISTINCT team.id)::BIGINT AS total_network_accounts,
    COUNT(DISTINCT CASE WHEN u.total_bets > 0 THEN u.id END)::BIGINT AS genuine_profiles,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdrawals,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS lifetime_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS lifetime_withdrawals
  FROM team
  LEFT JOIN public.users u ON team.id = u.id
  LEFT JOIN public.deposit_history dh ON team.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON team.id = wh.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_network_analysis(UUID) TO authenticated;

-- 6. Get Betting Statistics
CREATE OR REPLACE FUNCTION public.get_betting_stats(p_agent_id UUID)
RETURNS TABLE(
  number_of_bettors BIGINT,
  total_bet NUMERIC,
  deposit_amount NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team AS (
    SELECT id FROM public.users WHERE id = p_agent_id
    UNION ALL
    SELECT u.id FROM public.users u
    INNER JOIN team t ON u.referred_by = t.id
  ),
  first_deposits AS (
    SELECT DISTINCT ON (dh.user_id) dh.user_id, dh.amount
    FROM public.deposit_history dh
    WHERE dh.user_id IN (SELECT id FROM team WHERE id != p_agent_id)
      AND dh.status = 'completed'
    ORDER BY dh.user_id, dh.created_at ASC
  )
  SELECT
    COUNT(DISTINCT bh.user_id)::BIGINT AS number_of_bettors,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_bet,
    COALESCE(SUM(dh.amount), 0)::NUMERIC AS deposit_amount,
    COUNT(DISTINCT fd.user_id)::BIGINT AS first_deposit_users,
    COALESCE(SUM(fd.amount), 0)::NUMERIC AS first_deposit_amount
  FROM team t
  LEFT JOIN public.betting_history bh ON t.id = bh.user_id AND bh.status = 'completed'
  LEFT JOIN public.deposit_history dh ON t.id = dh.user_id AND dh.status = 'completed'
  LEFT JOIN first_deposits fd ON t.id = fd.user_id
  WHERE t.id != p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_betting_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF AGENT STATISTICS FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════
