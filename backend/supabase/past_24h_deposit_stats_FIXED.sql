-- ════════════════════════════════════════════════════════════════════════════════
-- PAST 24 HOURS DEPOSIT STATS FOR PROMOTION VIEW - FIXED
-- Fetch Direct Invites and Team Invites deposit data for past 24 hours
-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION 1: Get Direct Invites past 24 hours stats
DROP FUNCTION IF EXISTS public.get_direct_invites_past_24h(UUID);

CREATE OR REPLACE FUNCTION public.get_direct_invites_past_24h(p_agent_id UUID)
RETURNS TABLE(
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_ago TIMESTAMPTZ;
BEGIN
  v_24h_ago := NOW() - INTERVAL '24 hours';

  RETURN QUERY
  SELECT
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.user_id
    END)::BIGINT as first_deposit_users,
    COALESCE(SUM(CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.amount
      ELSE 0
    END), 0) as first_deposit_amount
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  WHERE u.referred_by = p_agent_id
  AND dh.status = 'completed'
  AND dh.created_at >= v_24h_ago;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_direct_invites_past_24h(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION 2: Get Team Invites past 24 hours stats
DROP FUNCTION IF EXISTS public.get_team_invites_past_24h(UUID);

CREATE OR REPLACE FUNCTION public.get_team_invites_past_24h(p_agent_id UUID)
RETURNS TABLE(
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_ago TIMESTAMPTZ;
  v_direct_ids UUID[];
  v_result RECORD;
BEGIN
  v_24h_ago := NOW() - INTERVAL '24 hours';

  -- Get all direct members
  SELECT ARRAY_AGG(id) INTO v_direct_ids
  FROM public.users
  WHERE referred_by = p_agent_id;

  IF v_direct_ids IS NULL OR ARRAY_LENGTH(v_direct_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0::BIGINT, 0::NUMERIC, 0::BIGINT, 0::NUMERIC;
    RETURN;
  END IF;

  -- Recursively get all team members (2+ levels down) and their deposits
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    SELECT id FROM public.users WHERE referred_by = ANY(v_direct_ids)
    UNION ALL
    SELECT u.id FROM public.users u
    JOIN team_tree t ON u.referred_by = t.id
  )
  SELECT
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.user_id
    END)::BIGINT as first_deposit_users,
    COALESCE(SUM(CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.amount
      ELSE 0
    END), 0) as first_deposit_amount
  FROM public.deposit_history dh
  WHERE dh.user_id IN (SELECT id FROM team_tree)
  AND dh.status = 'completed'
  AND dh.created_at >= v_24h_ago;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_invites_past_24h(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION 3: Get Subordinate stats for past 24 hours (for agent dashboard)
DROP FUNCTION IF EXISTS public.get_subordinate_past_24h_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_subordinate_past_24h_stats(p_agent_id UUID)
RETURNS TABLE(
  deposit_count BIGINT,
  deposit_amount NUMERIC,
  deposit_users BIGINT,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC,
  total_bet NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_ago TIMESTAMPTZ;
BEGIN
  v_24h_ago := NOW() - INTERVAL '24 hours';

  RETURN QUERY
  SELECT
    COUNT(dh.id)::BIGINT as deposit_count,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COUNT(DISTINCT CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.user_id
    END)::BIGINT as first_deposit_users,
    COALESCE(SUM(CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2
        WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_ago
      ) THEN dh.amount
      ELSE 0
    END), 0) as first_deposit_amount,
    COALESCE(SUM(bh.amount), 0) as total_bet
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.status = 'completed' 
    AND dh.created_at >= v_24h_ago
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id 
    AND bh.created_at >= v_24h_ago
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subordinate_past_24h_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION 4: Get Invited Members with real deposit data for AgentManagement
DROP FUNCTION IF EXISTS public.get_agent_invited_members(UUID);

CREATE OR REPLACE FUNCTION public.get_agent_invited_members(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  member_phone TEXT,
  member_uid TEXT,
  lifetime_deposit NUMERIC,
  today_deposit NUMERIC,
  total_bets BIGINT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.phone_number,
    u.uid_short,
    COALESCE(u.total_deposit, 0),
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND DATE(dh.created_at AT TIME ZONE 'UTC') = CURRENT_DATE AT TIME ZONE 'UTC'
      THEN dh.amount 
      ELSE 0 
    END), 0),
    COUNT(DISTINCT bh.id),
    u.created_at
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.phone_number, u.uid_short, u.total_deposit, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_invited_members(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Test Direct Invites past 24h:
-- SELECT * FROM public.get_direct_invites_past_24h('AGENT_UUID_HERE');

-- Test Team Invites past 24h:
-- SELECT * FROM public.get_team_invites_past_24h('AGENT_UUID_HERE');

-- Test Subordinate stats past 24h:
-- SELECT * FROM public.get_subordinate_past_24h_stats('AGENT_UUID_HERE');

-- Test Invited Members:
-- SELECT * FROM public.get_agent_invited_members('AGENT_UUID_HERE');
