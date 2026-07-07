-- ════════════════════════════════════════════════════════════════════════════════
-- FIX: Correct past 24 hours deposit stats for Direct and Team Invites
-- ════════════════════════════════════════════════════════════════════════════════

-- DROP old functions
DROP FUNCTION IF EXISTS public.get_direct_invites_past_24h(UUID);
DROP FUNCTION IF EXISTS public.get_team_invites_past_24h(UUID);

-- ════════════════════════════════════════════════════════════════════════════════
-- FUNCTION 1: Get Direct Invites past 24 hours stats (FIXED)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_direct_invites_past_24h(p_agent_id UUID)
RETURNS TABLE(
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT dh.user_id)::BIGINT as first_deposit_users,
    COALESCE(SUM(dh.amount), 0) as first_deposit_amount
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  WHERE u.referred_by = p_agent_id
  AND dh.status = 'completed'
  AND dh.created_at >= NOW() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_direct_invites_past_24h(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- FUNCTION 2: Get Team Invites past 24 hours stats (FIXED)
-- This gets deposits from members 2+ levels down (not direct)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_team_invites_past_24h(p_agent_id UUID)
RETURNS TABLE(
  deposit_users BIGINT,
  deposit_amount NUMERIC,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_direct_ids UUID[];
BEGIN
  -- Get all DIRECT members (level 1)
  SELECT ARRAY_AGG(id) INTO v_direct_ids
  FROM public.users
  WHERE referred_by = p_agent_id;

  IF v_direct_ids IS NULL OR ARRAY_LENGTH(v_direct_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0::BIGINT, 0::NUMERIC, 0::BIGINT, 0::NUMERIC;
    RETURN;
  END IF;

  -- Get deposits from TEAM members (2+ levels down, NOT direct)
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Level 2+: Members of direct members (exclude direct members themselves)
    SELECT u.id 
    FROM public.users u
    WHERE u.referred_by = ANY(v_direct_ids)
    
    UNION ALL
    
    -- Level 3+: Recursive
    SELECT u.id 
    FROM public.users u
    JOIN team_tree t ON u.referred_by = t.id
  )
  SELECT
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT dh.user_id)::BIGINT as first_deposit_users,
    COALESCE(SUM(dh.amount), 0) as first_deposit_amount
  FROM public.deposit_history dh
  WHERE dh.user_id IN (SELECT id FROM team_tree)
  AND dh.status = 'completed'
  AND dh.created_at >= NOW() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_invites_past_24h(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Test the functions
-- ════════════════════════════════════════════════════════════════════════════════

-- Test Direct Invites (should show deposits from direct members only)
SELECT * FROM public.get_direct_invites_past_24h('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- Test Team Invites (should show deposits from 2+ level members only)
SELECT * FROM public.get_team_invites_past_24h('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- ════════════════════════════════════════════════════════════════════════════════
