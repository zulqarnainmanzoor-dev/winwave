-- ════════════════════════════════════════════════════════════════════════════════
-- ANALYZE_AGENT_NETWORK_FRAUD - FIXED VERSION
-- Properly fetches real deposit/withdrawal data for agent's members
-- ════════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.analyze_agent_network_fraud(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.analyze_agent_network_fraud(p_agent_id UUID)
RETURNS TABLE(
  total_network_accounts BIGINT,
  unique_genuine_profiles BIGINT,
  today_deposits NUMERIC,
  today_withdrawals NUMERIC,
  lifetime_deposits NUMERIC,
  lifetime_withdrawals NUMERIC,
  network_depth INT,
  active_bettors BIGINT,
  total_bet_volume NUMERIC,
  fraud_risk_score NUMERIC,
  flagged_accounts JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  WITH RECURSIVE network AS (
    -- Level 0: Agent themselves
    SELECT id, 0 AS depth FROM public.users WHERE id = p_agent_id
    
    UNION ALL
    
    -- Level 1-7: All subordinates recursively (members referred by agent or agent's members)
    SELECT u.id, n.depth + 1
    FROM public.users u
    INNER JOIN network n ON u.referred_by = n.id
    WHERE n.depth < 7  -- 7-level limit
  ),
  network_members AS (
    -- Get all members in network (excluding agent)
    SELECT DISTINCT n.id, u.phone_number, u.referral_code, u.total_bets, u.main_balance
    FROM network n
    LEFT JOIN public.users u ON n.id = u.id
    WHERE n.id != p_agent_id  -- Exclude agent themselves
  ),
  deposits_data AS (
    -- Get all deposits for network members
    SELECT 
      nm.id,
      dh.amount,
      dh.created_at,
      dh.status
    FROM network_members nm
    LEFT JOIN public.deposit_history dh ON nm.id = dh.user_id
  ),
  withdrawals_data AS (
    -- Get all withdrawals for network members
    SELECT 
      nm.id,
      wh.amount,
      wh.created_at,
      wh.status
    FROM network_members nm
    LEFT JOIN public.withdrawal_history wh ON nm.id = wh.user_id
  ),
  bets_data AS (
    -- Get all bets for network members
    SELECT 
      nm.id,
      bh.amount,
      bh.is_win,
      bh.win_amount
    FROM network_members nm
    LEFT JOIN public.betting_history bh ON nm.id = bh.user_id AND bh.status = 'completed'
  ),
  network_stats AS (
    SELECT
      COUNT(DISTINCT nm.id)::BIGINT AS total_accounts,
      COUNT(DISTINCT CASE WHEN nm.total_bets > 0 THEN nm.id END)::BIGINT AS genuine_count,
      COALESCE(SUM(CASE WHEN d.status = 'completed' AND d.created_at >= v_today_start THEN d.amount ELSE 0 END), 0)::NUMERIC AS today_dep,
      COALESCE(SUM(CASE WHEN w.status = 'completed' AND w.created_at >= v_today_start THEN w.amount ELSE 0 END), 0)::NUMERIC AS today_with,
      COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0)::NUMERIC AS lifetime_dep,
      COALESCE(SUM(CASE WHEN w.status = 'completed' THEN w.amount ELSE 0 END), 0)::NUMERIC AS lifetime_with,
      COUNT(DISTINCT CASE WHEN b.id IS NOT NULL THEN nm.id END)::BIGINT AS active_bet_count,
      COALESCE(SUM(b.amount), 0)::NUMERIC AS total_bets
    FROM network_members nm
    LEFT JOIN deposits_data d ON nm.id = d.id
    LEFT JOIN withdrawals_data w ON nm.id = w.id
    LEFT JOIN bets_data b ON nm.id = b.id
  ),
  flagged AS (
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'phone', nm.phone_number,
        'invite_code', nm.referral_code,
        'total_deposit', COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0),
        'total_withdrawal', COALESCE(SUM(CASE WHEN w.status = 'completed' THEN w.amount ELSE 0 END), 0),
        'reason', CASE
          WHEN nm.total_bets = 0 AND COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0) > 0 THEN 'No betting activity'
          WHEN COALESCE(SUM(CASE WHEN w.status = 'completed' THEN w.amount ELSE 0 END), 0) > COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0) * 1.5 THEN 'Withdrawal > 150% of deposits'
          WHEN nm.main_balance < 0 THEN 'Negative balance'
          ELSE NULL
        END
      )
    ) FILTER (WHERE CASE
      WHEN nm.total_bets = 0 AND COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0) > 0 THEN TRUE
      WHEN COALESCE(SUM(CASE WHEN w.status = 'completed' THEN w.amount ELSE 0 END), 0) > COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.amount ELSE 0 END), 0) * 1.5 THEN TRUE
      WHEN nm.main_balance < 0 THEN TRUE
      ELSE FALSE
    END) AS flagged_list
    FROM network_members nm
    LEFT JOIN deposits_data d ON nm.id = d.id
    LEFT JOIN withdrawals_data w ON nm.id = w.id
    GROUP BY nm.id, nm.phone_number, nm.referral_code, nm.total_bets, nm.main_balance
  )
  SELECT
    ns.total_accounts,
    ns.genuine_count,
    ns.today_dep,
    ns.today_with,
    ns.lifetime_dep,
    ns.lifetime_with,
    7::INT AS network_depth,
    ns.active_bet_count,
    ns.total_bets,
    -- Fraud risk score: 0-100
    CASE
      WHEN ns.total_accounts = 0 THEN 0
      WHEN (ns.genuine_count::NUMERIC / NULLIF(ns.total_accounts::NUMERIC, 0)) < 0.3 THEN 85
      WHEN (ns.genuine_count::NUMERIC / NULLIF(ns.total_accounts::NUMERIC, 0)) < 0.5 THEN 65
      WHEN ns.lifetime_with > ns.lifetime_dep * 1.5 THEN 70
      WHEN ns.lifetime_with > ns.lifetime_dep THEN 40
      ELSE 20
    END::NUMERIC AS fraud_risk_score,
    COALESCE(f.flagged_list, '[]'::JSONB) AS flagged_accounts
  FROM network_stats ns, flagged f;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_network_fraud(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST QUERY - Run this to verify function works
-- ════════════════════════════════════════════════════════════════════════════════

-- SELECT * FROM analyze_agent_network_fraud('AGENT_UUID_HERE');

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF FUNCTION
-- ════════════════════════════════════════════════════════════════════════════════
