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
-- inviter_code is stored for audit/logging only; all parent relationships
-- use referred_by (UUID → public.users.id). inviter_code is deprecated
-- and no active business logic depends on it.
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
  -- Uses MD5(RANDOM()) with a retry loop to guarantee uniqueness.
  -- Collisions are statistically negligible (1 in 16^6 = 16 million per guess,
  -- and the retry loop re-rolls until a free code is found).
  -- For stronger randomness, consider: GEN_RANDOM_UUID()::TEXT or
  -- ENCODE(GEN_RANDOM_BYTES(4), 'hex') which uses pgcrypto's secure RNG.
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
-- Returns 7-level hierarchy counts for a given user UUID.
-- Level 0 = Current user (for reference, not included in invitee counts)
-- Level 1 = Direct Invitees (referred_by = user_uuid)
-- Level 2 = Team (referred_by IN level-1 ids)
-- Level 3 = Team (referred_by IN level-2 ids)
-- Level 4 = Team (referred_by IN level-3 ids)
-- Level 5 = Team (referred_by IN level-4 ids)
-- Level 6 = Team (referred_by IN level-5 ids)
--
-- NOTE: The RPC reads deposit_history for deposit stats. If the production
-- deposit table is named differently (e.g. "deposits"), update the JOIN below.
-- Must DROP first because the return type (OUT parameters) has changed
-- (added level4_count, level5_count, level6_count).
DROP FUNCTION IF EXISTS public.get_network_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_network_stats(user_uuid UUID)
RETURNS TABLE (
  direct_count  BIGINT,   -- Level 1
  team_count    BIGINT,   -- Levels 2+3+4+5+6 combined
  level1_count  BIGINT,
  level2_count  BIGINT,
  level3_count  BIGINT,
  level4_count  BIGINT,
  level5_count  BIGINT,
  level6_count  BIGINT,
  direct_deposit_users  BIGINT,
  team_deposit_users    BIGINT,
  direct_deposit_amount NUMERIC,
  team_deposit_amount   NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE network AS (
    -- Level 1: direct referrals (referred_by = input user_uuid)
    SELECT id, referred_by, 1 AS lvl
    FROM   public.users
    WHERE  referred_by = user_uuid

    UNION ALL

    -- Levels 2 through 6: traverse down the referral tree
    SELECT u.id, u.referred_by, n.lvl + 1
    FROM   public.users u
    JOIN   network n ON u.referred_by = n.id
    WHERE  n.lvl < 6
  ),
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE lvl = 1) AS l1,
      COUNT(*) FILTER (WHERE lvl = 2) AS l2,
      COUNT(*) FILTER (WHERE lvl = 3) AS l3,
      COUNT(*) FILTER (WHERE lvl = 4) AS l4,
      COUNT(*) FILTER (WHERE lvl = 5) AS l5,
      COUNT(*) FILTER (WHERE lvl = 6) AS l6
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
    c.l1                                                                       AS direct_count,
    c.l2 + c.l3 + c.l4 + c.l5 + c.l6                                           AS team_count,
    c.l1                                                                       AS level1_count,
    c.l2                                                                       AS level2_count,
    c.l3                                                                       AS level3_count,
    c.l4                                                                       AS level4_count,
    c.l5                                                                       AS level5_count,
    c.l6                                                                       AS level6_count,
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 1), 0)          AS direct_deposit_users,
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 2), 0) +
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 3), 0) +
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 4), 0) +
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 5), 0) +
    COALESCE((SELECT dep_users  FROM deposit_stats WHERE lvl = 6), 0)          AS team_deposit_users,
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 1), 0)          AS direct_deposit_amount,
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 2), 0) +
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 3), 0) +
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 4), 0) +
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 5), 0) +
    COALESCE((SELECT dep_amount FROM deposit_stats WHERE lvl = 6), 0)          AS team_deposit_amount
  FROM counts c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_network_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_network_stats(UUID) TO service_role;