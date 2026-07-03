-- ================================================================
-- referral_network.sql
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. Ensure referred_by references public.users (not auth.users) ──
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_referred_by_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users (referred_by);

-- ── 2. Hardened handle_new_user trigger ─────────────────────────
-- Resolves inviter_code → referred_by UUID atomically inside the trigger.
-- This is the single source of truth — the React client also resolves it
-- and passes referrer_uuid in metadata as a fallback.
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta         JSONB;
  v_phone        TEXT;
  v_inviter_code TEXT;
  v_referrer_id  UUID := NULL;
  v_invite_code  TEXT;
  v_taken        BOOLEAN;
BEGIN
  v_meta         := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_phone        := NULLIF(TRIM(COALESCE(v_meta->>'phone_number', v_meta->>'phone', '')), '');
  v_inviter_code := NULLIF(TRIM(UPPER(COALESCE(v_meta->>'inviter_code', ''))), '');

  -- Priority 1: referrer_uuid passed directly from client (most reliable)
  IF (v_meta->>'referrer_uuid') IS NOT NULL THEN
    v_referrer_id := (v_meta->>'referrer_uuid')::UUID;
    -- Verify it actually exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_referrer_id) THEN
      v_referrer_id := NULL;
    END IF;
  END IF;

  -- Priority 2: resolve from invite_code text
  IF v_referrer_id IS NULL AND v_inviter_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM   public.users
    WHERE  invite_code = v_inviter_code
    LIMIT  1;
  END IF;

  -- Generate unique 6-char alphanumeric invite_code for new user
  LOOP
    v_invite_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE invite_code = v_invite_code) INTO v_taken;
    EXIT WHEN NOT v_taken;
  END LOOP;

  INSERT INTO public.users (
    id, phone_number, invite_code, inviter_code, referred_by,
    vip_level, total_bets, main_balance, game_balance,
    wagering_required, wagering_completed, created_at, updated_at
  ) VALUES (
    NEW.id, v_phone, v_invite_code, v_inviter_code, v_referrer_id,
    0, 0, 0, 0, 0, 0, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET referred_by   = COALESCE(public.users.referred_by, EXCLUDED.referred_by),
        inviter_code  = COALESCE(public.users.inviter_code, EXCLUDED.inviter_code),
        updated_at    = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. get_network_stats RPC ─────────────────────────────────────
-- Returns 3-level hierarchy counts for a given user UUID.
-- Level 1 = Direct Invitees (referred_by = user_uuid)
-- Level 2 = Team B (referred_by IN level-1 ids)
-- Level 3 = Team C (referred_by IN level-2 ids)
CREATE OR REPLACE FUNCTION public.get_network_stats(user_uuid UUID)
RETURNS TABLE (
  direct_count  BIGINT,   -- Level 1
  team_count    BIGINT,   -- Level 2 + 3 combined
  level1_count  BIGINT,
  level2_count  BIGINT,
  level3_count  BIGINT,
  direct_deposit_users  BIGINT,
  team_deposit_users    BIGINT,
  direct_deposit_amount NUMERIC,
  team_deposit_amount   NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE network AS (
    -- Level 1: direct referrals
    SELECT id, 1 AS lvl
    FROM   public.users
    WHERE  referred_by = user_uuid

    UNION ALL

    -- Levels 2 and 3
    SELECT u.id, n.lvl + 1
    FROM   public.users u
    JOIN   network n ON u.referred_by = n.id
    WHERE  n.lvl < 3
  ),
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE lvl = 1) AS l1,
      COUNT(*) FILTER (WHERE lvl = 2) AS l2,
      COUNT(*) FILTER (WHERE lvl = 3) AS l3
    FROM network
  ),
  deposit_stats AS (
    SELECT
      n.lvl,
      COUNT(DISTINCT dh.user_id)  AS dep_users,
      COALESCE(SUM(dh.amount), 0) AS dep_amount
    FROM   network n
    JOIN   public.deposit_history dh ON dh.user_id = n.id AND dh.status = 'success'
    GROUP  BY n.lvl
  )
  SELECT
    c.l1                                                          AS direct_count,
    c.l2 + c.l3                                                   AS team_count,
    c.l1                                                          AS level1_count,
    c.l2                                                          AS level2_count,
    c.l3                                                          AS level3_count,
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 1), 0) AS direct_deposit_users,
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 2), 0) +
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 3), 0) AS team_deposit_users,
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 1), 0) AS direct_deposit_amount,
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 2), 0) +
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 3), 0) AS team_deposit_amount
  FROM counts c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_network_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_network_stats(UUID) TO service_role;
