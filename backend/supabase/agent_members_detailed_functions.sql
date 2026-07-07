-- ════════════════════════════════════════════════════════════════════════════════
-- GET_AGENT_MEMBERS_DETAILED - Show agent's members with real deposit/withdrawal data
-- ════════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_agent_members_detailed(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_agent_members_detailed(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  member_uid TEXT,
  member_phone TEXT,
  registration_date TIMESTAMPTZ,
  total_lifetime_deposits NUMERIC,
  today_deposits NUMERIC,
  total_lifetime_withdrawals NUMERIC,
  today_withdrawals NUMERIC,
  total_bets NUMERIC,
  number_of_bets BIGINT,
  member_status TEXT,
  main_balance NUMERIC
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
    u.created_at AS registration_date,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_lifetime_deposits,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS total_lifetime_withdrawals,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdrawals,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_bets,
    COUNT(CASE WHEN bh.id IS NOT NULL THEN 1 END)::BIGINT AS number_of_bets,
    CASE
      WHEN COUNT(CASE WHEN bh.id IS NOT NULL THEN 1 END) > 0 THEN 'Active'
      WHEN COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0) > 0 THEN 'Deposited'
      ELSE 'Inactive'
    END AS member_status,
    u.main_balance AS main_balance
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON u.id = wh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id AND bh.status = 'completed'
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.phone_number, u.created_at, u.main_balance
  ORDER BY total_lifetime_deposits DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_members_detailed(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- GET_AGENT_SUMMARY_STATS - Quick summary for agent dashboard
-- ════════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_agent_summary_stats(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_agent_summary_stats(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  active_members BIGINT,
  total_lifetime_deposits NUMERIC,
  today_deposits NUMERIC,
  total_lifetime_withdrawals NUMERIC,
  today_withdrawals NUMERIC,
  total_team_bets NUMERIC,
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
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS total_lifetime_deposits,
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposits,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS total_lifetime_withdrawals,
    COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdrawals,
    COALESCE(SUM(bh.amount), 0)::NUMERIC AS total_team_bets,
    COUNT(DISTINCT CASE WHEN dh.status = 'completed' THEN u.id END)::BIGINT AS members_with_deposits
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON u.id = wh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id AND bh.status = 'completed'
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_summary_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Get agent summary
-- SELECT * FROM get_agent_summary_stats('AGENT_UUID_HERE');

-- Get detailed member list
-- SELECT * FROM get_agent_members_detailed('AGENT_UUID_HERE');

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════
