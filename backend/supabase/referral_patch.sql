-- ================================================================
-- referral_patch.sql
-- Run in Supabase SQL Editor
-- ================================================================

-- 1. Add referred_by column (UUID → points to the agent who referred this user)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index for fast agent member lookups
CREATE INDEX IF NOT EXISTS idx_referred_by ON public.users(referred_by);

-- 3. RPC: get_agent_members — returns all users referred by a given agent UUID
CREATE OR REPLACE FUNCTION public.get_agent_members(agent_uid UUID)
RETURNS TABLE (
  id           UUID,
  phone_number TEXT,
  invite_code  TEXT,
  main_balance NUMERIC,
  game_balance NUMERIC,
  created_at   TIMESTAMPTZ,
  status       TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      u.id,
      u.phone_number,
      u.invite_code,
      u.main_balance,
      u.game_balance,
      u.created_at,
      COALESCE(u.status, 'active') AS status
    FROM public.users u
    WHERE u.referred_by = agent_uid
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_members(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_agent_members(UUID) TO authenticated;
