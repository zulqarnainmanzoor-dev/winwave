-- ════════════════════════════════════════════════════════════════════════════════
-- FIX: Platform-wide 24h stats + Multi-level team hierarchy + Numeric UID
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Platform Past 24h Stats (ENTIRE PLATFORM)
-- Shows deposits from last 24 hours for all users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_platform_past_24h_stats()
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
  v_24h_start TIMESTAMPTZ;
BEGIN
  -- Last 24 hours (not yesterday, but rolling 24h)
  v_24h_start := NOW() - INTERVAL '24 hours';

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
        AND dh2.created_at < v_24h_start
      ) THEN dh.user_id 
    END)::BIGINT as first_deposit_users,
    COALESCE(SUM(CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < v_24h_start
      ) THEN dh.amount ELSE 0 
    END), 0) as first_deposit_amount,
    COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0) as total_bet
  FROM public.deposit_history dh
  LEFT JOIN public.betting_history bh ON dh.user_id = bh.user_id 
    AND bh.created_at >= v_24h_start
  WHERE dh.status = 'completed'
  AND dh.created_at >= v_24h_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_past_24h_stats() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Team Past 24h Stats (MULTI-LEVEL HIERARCHY)
-- Shows deposits from agent's direct invites + their invites (team hierarchy)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_team_past_24h_stats(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  deposit_count BIGINT,
  deposit_amount NUMERIC,
  deposit_users BIGINT,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC,
  total_bet NUMERIC,
  direct_deposit_amount NUMERIC,
  team_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
  v_all_team_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
BEGIN
  -- Last 24 hours
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  -- Build full team hierarchy (agent + all levels)
  v_all_team_members := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];

  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users WHERE referred_by = ANY(v_current_level);
    
    IF v_current_level IS NOT NULL THEN
      v_all_team_members := v_all_team_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

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
        AND dh2.created_at < v_24h_start
      ) THEN dh.user_id 
    END)::BIGINT as first_deposit_users,
    COALESCE(SUM(CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < v_24h_start
      ) THEN dh.amount ELSE 0 
    END), 0) as first_deposit_amount,
    COALESCE(SUM(CASE WHEN bh.status = 'completed' THEN bh.amount ELSE 0 END), 0) as total_bet,
    -- Direct deposits (level 1 only)
    COALESCE(SUM(CASE WHEN u.referred_by = p_agent_id THEN dh.amount ELSE 0 END), 0) as direct_deposit_amount,
    -- Team deposits (level 2+)
    COALESCE(SUM(CASE WHEN u.referred_by != p_agent_id AND u.id != p_agent_id THEN dh.amount ELSE 0 END), 0) as team_deposit_amount
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  LEFT JOIN public.betting_history bh ON dh.user_id = bh.user_id 
    AND bh.created_at >= v_24h_start
  WHERE dh.status = 'completed'
  AND dh.created_at >= v_24h_start
  AND u.id = ANY(v_all_team_members)
  AND u.id != p_agent_id; -- Exclude agent's own deposits
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_past_24h_stats(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Numeric UID for users
-- Converts invite_code to numeric format (extracts numbers only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_numeric_uid(p_invite_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_invite_code IS NULL THEN RETURN '000000'; END IF;
  -- Extract only digits from invite_code
  RETURN COALESCE(
    (SELECT STRING_AGG(ch, '') 
     FROM (SELECT UNNEST(REGEXP_SPLIT_TO_ARRAY(p_invite_code, '')) AS ch) t
     WHERE ch ~ '^[0-9]$'),
    SUBSTRING(REPLACE(MD5(p_invite_code), '-', '') FROM 1 FOR 6)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: Users with Numeric UID
-- Shows users with their numeric UID for display
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_users_with_numeric_uid AS
SELECT 
  u.id,
  u.phone_number,
  u.invite_code,
  u.referral_code,
  u.referred_by,
  u.total_deposit,
  u.total_bets,
  u.created_at,
  -- Generate numeric UID: use digits from invite_code, fallback to hash
  CASE 
    WHEN u.invite_code ~ '^[0-9]+$' THEN u.invite_code
    ELSE public.get_numeric_uid(u.invite_code)
  END as numeric_uid,
  -- Also show original alphanumeric for reference
  u.invite_code as original_uid
FROM public.users u;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: Get Agent Team Members with Deposits (Past 24h)
-- Shows team members with their deposit amounts in last 24h
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_team_members_24h(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  id UUID,
  numeric_uid TEXT,
  phone_number TEXT,
  level INT,
  today_deposit NUMERIC,
  total_deposit NUMERIC,
  registration_date TIMESTAMPTZ,
  is_direct_member BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
  v_all_team_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
  v_level_map JSONB := '{}'::JSONB;
BEGIN
  -- Last 24 hours
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  -- Build hierarchy with level tracking
  v_all_team_members := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];
  v_level_map := jsonb_set(v_level_map, ARRAY[p_agent_id::text], '0');

  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    
    WITH next_level AS (
      SELECT id, referred_by
      FROM public.users 
      WHERE referred_by = ANY(v_current_level)
    )
    SELECT 
      ARRAY_AGG(id),
      jsonb_set(v_level_map, ARRAY_AGG(id::text), ARRAY_AGG(v_i::text)::jsonb)
    INTO v_current_level, v_level_map
    FROM next_level;
    
    IF v_current_level IS NOT NULL THEN
      v_all_team_members := v_all_team_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    u.id,
    CASE 
      WHEN u.invite_code ~ '^[0-9]+$' THEN u.invite_code
      ELSE public.get_numeric_uid(u.invite_code)
    END as numeric_uid,
    u.phone_number,
    COALESCE((v_level_map->>u.id::text)::INT, 0) as level,
    COALESCE(SUM(CASE WHEN dh.created_at >= v_24h_start THEN dh.amount ELSE 0 END), 0) as today_deposit,
    u.total_deposit,
    u.created_at as registration_date,
    (u.referred_by = p_agent_id) as is_direct_member
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.status = 'completed'
  WHERE u.id = ANY(v_all_team_members)
  AND u.id != p_agent_id
  GROUP BY u.id, u.invite_code, u.phone_number, u.total_deposit, u.created_at, u.referred_by, v_level_map
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_members_24h(UUID, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST: Verify functions work correctly
-- ════════════════════════════════════════════════════════════════════════════════

-- Test platform stats
SELECT * FROM public.get_platform_past_24h_stats();

-- Test agent team stats (replace with actual agent UUID)
-- SELECT * FROM public.get_agent_team_past_24h_stats('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- Test numeric UID function
SELECT 
  invite_code,
  public.get_numeric_uid(invite_code) as numeric_uid
FROM public.users 
WHERE invite_code IS NOT NULL 
LIMIT 10;

-- Test team members view
-- SELECT * FROM public.get_agent_team_members_24h('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid) LIMIT 10;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF FIX
-- ════════════════════════════════════════════════════════════════════════════════