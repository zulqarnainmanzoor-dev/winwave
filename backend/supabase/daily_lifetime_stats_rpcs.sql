-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Daily & Lifetime Statistics RPC Functions
-- Purpose: Provide real production data for InviteesOverview (daily), Promotion (lifetime), Agent Management
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Daily Subordinate Statistics (TODAY ONLY)
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
-- FUNCTION: Get Daily Subordinates List (TODAY'S DEPOSITS ONLY)
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
-- FUNCTION: Get Lifetime Promotion Statistics (ALL TIME)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_lifetime_promotion_stats(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  direct_invites BIGINT,
  team_deposit NUMERIC,
  total_commission NUMERIC,
  team_members BIGINT,
  active_members BIGINT
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
    -- Direct invites (direct referrals only)
    COUNT(DISTINCT CASE WHEN u.referred_by = p_agent_id THEN u.id END)::BIGINT,
    
    -- Team deposit (all subordinates' successful deposits)
    COALESCE(SUM(CASE WHEN dh.status = 'completed' AND u.id != p_agent_id THEN dh.amount ELSE 0 END), 0)::NUMERIC,
    
    -- Total commission (lifetime)
    COALESCE(SUM(CASE WHEN t.type = 'commission' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::NUMERIC,
    
    -- Team members (all subordinates)
    COUNT(DISTINCT CASE WHEN u.id != p_agent_id AND u.id = ANY(v_all_subordinates) THEN u.id END)::BIGINT,
    
    -- Active members (with bets)
    COUNT(DISTINCT CASE WHEN u.id != p_agent_id AND u.id = ANY(v_all_subordinates) AND u.total_bets > 0 THEN u.id END)::BIGINT
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.id = ANY(v_all_subordinates);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lifetime_promotion_stats(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Management Dashboard Stats (REAL DATA)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_management_stats(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  direct_team_deposit NUMERIC,
  network_deposit NUMERIC,
  total_team_members BIGINT,
  today_deposits NUMERIC,
  lifetime_deposits NUMERIC,
  total_commission NUMERIC,
  active_members BIGINT,
  pending_deposits BIGINT
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
    -- Direct team deposit (direct referrals only)
    COALESCE(SUM(CASE 
      WHEN u.referred_by = p_agent_id AND dh.status = 'completed' 
      THEN dh.amount ELSE 0 
    END), 0)::NUMERIC,
    
    -- Network deposit (all levels)
    COALESCE(SUM(CASE 
      WHEN u.id != p_agent_id AND u.id = ANY(v_all_subordinates) AND dh.status = 'completed' 
      THEN dh.amount ELSE 0 
    END), 0)::NUMERIC,
    
    -- Total team members
    COUNT(DISTINCT CASE WHEN u.id != p_agent_id AND u.id = ANY(v_all_subordinates) THEN u.id END)::BIGINT,
    
    -- Today's deposits
    COALESCE(SUM(CASE 
      WHEN u.id = ANY(v_all_subordinates) AND dh.status = 'completed' 
      AND dh.created_at >= v_today_start AND dh.created_at < v_today_end
      THEN dh.amount ELSE 0 
    END), 0)::NUMERIC,
    
    -- Lifetime deposits
    COALESCE(SUM(CASE 
      WHEN u.id = ANY(v_all_subordinates) AND dh.status = 'completed' 
      THEN dh.amount ELSE 0 
    END), 0)::NUMERIC,
    
    -- Total commission
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' AND t.status = 'completed' 
      THEN t.amount ELSE 0 
    END), 0)::NUMERIC,
    
    -- Active members
    COUNT(DISTINCT CASE WHEN u.id != p_agent_id AND u.id = ANY(v_all_subordinates) AND u.total_bets > 0 THEN u.id END)::BIGINT,
    
    -- Pending deposits
    COUNT(DISTINCT CASE WHEN u.id = ANY(v_all_subordinates) AND dh.status = 'pending' THEN dh.id END)::BIGINT
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.id = ANY(v_all_subordinates);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_management_stats(UUID, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
