-- ════════════════════════════════════════════════════════════════════════════════
-- AGENT MEMBER TRANSACTION ANALYSIS
-- Get real deposit data for each agent's direct members
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Get all direct members with their deposit summary
CREATE OR REPLACE FUNCTION public.get_agent_members_deposits(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  member_uid TEXT,
  member_phone TEXT,
  total_deposits NUMERIC,
  today_deposits NUMERIC,
  deposit_count BIGINT,
  first_deposit_date TIMESTAMPTZ,
  last_deposit_date TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  SELECT
    u.id AS member_id,
    SUBSTRING(u.id::TEXT, 1, 8) AS member_uid,
    u.phone_number AS member_phone,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_deposits,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposits,
    COUNT(CASE WHEN dh.status = 'completed' THEN 1 END)::BIGINT AS deposit_count,
    MIN(CASE WHEN dh.status = 'completed' THEN dh.created_at END) AS first_deposit_date,
    MAX(CASE WHEN dh.status = 'completed' THEN dh.created_at END) AS last_deposit_date,
    CASE 
      WHEN COUNT(CASE WHEN dh.status = 'completed' THEN 1 END) > 0 THEN 'active'
      WHEN COUNT(CASE WHEN dh.status = 'pending' THEN 1 END) > 0 THEN 'pending'
      ELSE 'inactive'
    END AS status
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.phone_number
  ORDER BY total_deposits DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_members_deposits(UUID) TO authenticated;

-- 2. Get agent team summary (all direct members)
CREATE OR REPLACE FUNCTION public.get_agent_team_summary(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  active_members BIGINT,
  total_team_deposits NUMERIC,
  today_team_deposits NUMERIC,
  average_deposit NUMERIC,
  members_with_deposits BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  SELECT
    COUNT(DISTINCT u.id)::BIGINT AS total_members,
    COUNT(DISTINCT CASE WHEN bh.id IS NOT NULL THEN u.id END)::BIGINT AS active_members,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_team_deposits,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_team_deposits,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN u.id END) > 0 
      THEN ROUND(COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0) / COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN u.id END), 2)
      ELSE 0
    END::NUMERIC AS average_deposit,
    COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN u.id END)::BIGINT AS members_with_deposits
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id AND bh.status = 'completed'
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_summary(UUID) TO authenticated;

-- 3. Get member transaction history (deposits + withdrawals + bets)
CREATE OR REPLACE FUNCTION public.get_member_transactions(p_member_id UUID)
RETURNS TABLE(
  transaction_id UUID,
  transaction_type TEXT,
  amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  remarks TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    dh.id::UUID AS transaction_id,
    'deposit'::TEXT AS transaction_type,
    dh.amount,
    dh.status,
    dh.created_at,
    dh.remarks
  FROM public.deposit_history dh
  WHERE dh.user_id = p_member_id
  
  UNION ALL
  
  SELECT
    wh.id::UUID AS transaction_id,
    'withdrawal'::TEXT AS transaction_type,
    wh.amount,
    wh.status,
    wh.created_at,
    wh.remarks
  FROM public.withdrawal_history wh
  WHERE wh.user_id = p_member_id
  
  ORDER BY created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_transactions(UUID) TO authenticated;

-- 4. Get member betting statistics
CREATE OR REPLACE FUNCTION public.get_member_betting_stats(p_member_id UUID)
RETURNS TABLE(
  total_bets BIGINT,
  total_bet_amount NUMERIC,
  total_winnings NUMERIC,
  win_rate NUMERIC,
  last_bet_date TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_bets,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_bet_amount,
    COALESCE(SUM(CASE WHEN bh.is_win THEN bh.win_amount ELSE 0 END), 0)::NUMERIC AS total_winnings,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(COUNT(CASE WHEN bh.is_win THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
      ELSE 0
    END::NUMERIC AS win_rate,
    MAX(bh.created_at) AS last_bet_date
  FROM public.betting_history bh
  WHERE bh.user_id = p_member_id AND bh.status = 'completed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_betting_stats(UUID) TO authenticated;

-- 5. Get agent dashboard complete data (all stats in one call)
CREATE OR REPLACE FUNCTION public.get_agent_dashboard_data(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  active_members BIGINT,
  total_team_deposits NUMERIC,
  today_team_deposits NUMERIC,
  total_team_withdrawals NUMERIC,
  today_team_withdrawals NUMERIC,
  total_team_bets NUMERIC,
  members_with_deposits BIGINT,
  average_deposit NUMERIC,
  total_commission NUMERIC,
  today_commission NUMERIC,
  pending_commission NUMERIC
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
  WITH team_members AS (
    SELECT id FROM public.users WHERE referred_by = p_agent_id
  )
  SELECT
    COUNT(DISTINCT tm.id)::BIGINT AS total_members,
    COUNT(DISTINCT CASE WHEN bh.id IS NOT NULL THEN tm.id END)::BIGINT AS active_members,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_team_deposits,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_team_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS total_team_withdrawals,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_team_withdrawals,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_team_bets,
    COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN tm.id END)::BIGINT AS members_with_deposits,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN tm.id END) > 0 
      THEN ROUND(COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0) / COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN tm.id END), 2)
      ELSE 0
    END::NUMERIC AS average_deposit,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC AS total_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' AND t.created_at >= v_today_start THEN t.amount ELSE 0 END), 0)::NUMERIC AS today_commission,
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'pending' THEN t.amount ELSE 0 END), 0)::NUMERIC AS pending_commission
  FROM team_members tm
  LEFT JOIN public.deposit_history dh ON tm.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON tm.id = wh.user_id
  LEFT JOIN public.betting_history bh ON tm.id = bh.user_id AND bh.status = 'completed'
  LEFT JOIN public.transactions t ON p_agent_id = t.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_dashboard_data(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF AGENT MEMBER TRANSACTION ANALYSIS
-- ════════════════════════════════════════════════════════════════════════════════
