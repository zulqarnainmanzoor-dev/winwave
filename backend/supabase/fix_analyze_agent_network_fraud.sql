-- ════════════════════════════════════════════════════════════════════════════════
-- ANALYZE_AGENT_NETWORK_FRAUD - REAL DATA FROM DATABASE
-- Shows agent's total deposits, today's deposits, withdrawals
-- Shows all members linked to this agent (referred_by = agent_id)
-- Shows each member's deposits, withdrawals, bets
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
  flagged_accounts JSONB,
  members_detail JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  RETURN QUERY
  WITH agent_members AS (
    -- Get all direct members of this agent (referred_by = agent_id)
    SELECT 
      u.id,
      u.phone_number,
      u.referral_code,
      u.invite_code,
      u.total_bets,
      u.main_balance,
      u.created_at
    FROM public.users u
    WHERE u.referred_by = p_agent_id
  ),
  member_deposits AS (
    -- Get deposit data for each member
    SELECT 
      am.id,
      am.phone_number,
      am.referral_code,
      am.invite_code,
      COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0)::NUMERIC AS lifetime_deposit,
      COALESCE(SUM(CASE WHEN dh.status = 'completed' AND dh.created_at >= v_today_start THEN dh.amount ELSE 0 END), 0)::NUMERIC AS today_deposit,
      COUNT(CASE WHEN dh.status = 'completed' THEN 1 END)::BIGINT AS deposit_count
    FROM agent_members am
    LEFT JOIN public.deposit_history dh ON am.id = dh.user_id
    GROUP BY am.id, am.phone_number, am.referral_code, am.invite_code
  ),
  member_withdrawals AS (
    -- Get withdrawal data for each member
    SELECT 
      am.id,
      COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0)::NUMERIC AS lifetime_withdrawal,
      COALESCE(SUM(CASE WHEN wh.status = 'completed' AND wh.created_at >= v_today_start THEN wh.amount ELSE 0 END), 0)::NUMERIC AS today_withdrawal,
      COUNT(CASE WHEN wh.status = 'completed' THEN 1 END)::BIGINT AS withdrawal_count
    FROM agent_members am
    LEFT JOIN public.withdrawal_history wh ON am.id = wh.user_id
    GROUP BY am.id
  ),
  member_bets AS (
    -- Get betting data for each member
    SELECT 
      am.id,
      COUNT(CASE WHEN bh.status = 'completed' THEN 1 END)::BIGINT AS total_bets,
      COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0)::NUMERIC AS total_bet_amount,
      COALESCE(SUM(CASE WHEN bh.status = 'completed' AND bh.is_win THEN bh.win_amount ELSE 0 END), 0)::NUMERIC AS total_winnings
    FROM agent_members am
    LEFT JOIN public.betting_history bh ON am.id = bh.user_id
    GROUP BY am.id
  ),
  member_summary AS (
    -- Combine all member data
    SELECT 
      md.id,
      md.phone_number,
      md.referral_code,
      md.invite_code,
      md.lifetime_deposit,
      md.today_deposit,
      md.deposit_count,
      mw.lifetime_withdrawal,
      mw.today_withdrawal,
      mw.withdrawal_count,
      mb.total_bets,
      mb.total_bet_amount,
      mb.total_winnings,
      CASE WHEN mb.total_bets > 0 THEN 'active' ELSE 'inactive' END AS status
    FROM member_deposits md
    LEFT JOIN member_withdrawals mw ON md.id = mw.id
    LEFT JOIN member_bets mb ON md.id = mb.id
  ),
  agent_totals AS (
    -- Calculate agent's total statistics
    SELECT
      COUNT(DISTINCT ms.id)::BIGINT AS total_members,
      COUNT(DISTINCT CASE WHEN ms.total_bets > 0 THEN ms.id END)::BIGINT AS genuine_members,
      COALESCE(SUM(ms.today_deposit), 0)::NUMERIC AS agent_today_deposits,
      COALESCE(SUM(ms.today_withdrawal), 0)::NUMERIC AS agent_today_withdrawals,
      COALESCE(SUM(ms.lifetime_deposit), 0)::NUMERIC AS agent_lifetime_deposits,
      COALESCE(SUM(ms.lifetime_withdrawal), 0)::NUMERIC AS agent_lifetime_withdrawals,
      COUNT(DISTINCT CASE WHEN ms.total_bets > 0 THEN ms.id END)::BIGINT AS agent_active_bettors,
      COALESCE(SUM(ms.total_bet_amount), 0)::NUMERIC AS agent_total_bets
    FROM member_summary ms
  ),
  flagged_members AS (
    -- Identify suspicious members
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'phone', ms.phone_number,
        'uid', ms.referral_code,
        'invite_code', ms.invite_code,
        'lifetime_deposit', ms.lifetime_deposit,
        'lifetime_withdrawal', ms.lifetime_withdrawal,
        'total_bets', ms.total_bets,
        'reason', CASE
          WHEN ms.total_bets = 0 AND ms.lifetime_deposit > 0 THEN 'No betting activity'
          WHEN ms.lifetime_withdrawal > ms.lifetime_deposit * 1.5 THEN 'Withdrawal > 150% of deposits'
          WHEN ms.lifetime_withdrawal > ms.lifetime_deposit AND ms.lifetime_deposit > 0 THEN 'Withdrawal > deposits'
          ELSE NULL
        END
      ) ORDER BY ms.lifetime_deposit DESC
    ) FILTER (WHERE CASE
      WHEN ms.total_bets = 0 AND ms.lifetime_deposit > 0 THEN TRUE
      WHEN ms.lifetime_withdrawal > ms.lifetime_deposit * 1.5 THEN TRUE
      WHEN ms.lifetime_withdrawal > ms.lifetime_deposit AND ms.lifetime_deposit > 0 THEN TRUE
      ELSE FALSE
    END) AS flagged_list
    FROM member_summary ms
  ),
  members_detail_json AS (
    -- Create detailed JSON for all members
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'member_id', ms.id,
        'phone', ms.phone_number,
        'uid', ms.referral_code,
        'invite_code', ms.invite_code,
        'status', ms.status,
        'lifetime_deposit', ms.lifetime_deposit,
        'today_deposit', ms.today_deposit,
        'deposit_count', ms.deposit_count,
        'lifetime_withdrawal', ms.lifetime_withdrawal,
        'today_withdrawal', ms.today_withdrawal,
        'withdrawal_count', ms.withdrawal_count,
        'total_bets', ms.total_bets,
        'total_bet_amount', ms.total_bet_amount,
        'total_winnings', ms.total_winnings
      ) ORDER BY ms.lifetime_deposit DESC
    ) AS members_list
    FROM member_summary ms
  )
  SELECT
    at.total_members,
    at.genuine_members,
    at.agent_today_deposits,
    at.agent_today_withdrawals,
    at.agent_lifetime_deposits,
    at.agent_lifetime_withdrawals,
    1::INT AS network_depth,
    at.agent_active_bettors,
    at.agent_total_bets,
    -- Fraud risk score: 0-100
    CASE
      WHEN at.total_members = 0 THEN 0
      WHEN (at.genuine_members::NUMERIC / at.total_members::NUMERIC) < 0.3 THEN 85
      WHEN (at.genuine_members::NUMERIC / at.total_members::NUMERIC) < 0.5 THEN 65
      WHEN at.agent_lifetime_withdrawals > at.agent_lifetime_deposits * 1.5 THEN 70
      WHEN at.agent_lifetime_withdrawals > at.agent_lifetime_deposits THEN 40
      ELSE 20
    END::NUMERIC AS fraud_risk_score,
    COALESCE(fm.flagged_list, '[]'::JSONB) AS flagged_accounts,
    COALESCE(mdj.members_list, '[]'::JSONB) AS members_detail
  FROM agent_totals at, flagged_members fm, members_detail_json mdj;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_network_fraud(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF FUNCTION
-- ════════════════════════════════════════════════════════════════════════════════
