-- ══════════════════════════════════════════════════════════════════════════════
-- PATCH: Fix Referral Registration Bug
-- Run this in Supabase SQL Editor (postgres / service_role)
-- ══════════════════════════════════════════════════════════════════════════════
-- Root cause: handle_new_user trigger looked up invite_code (6-char internal)
-- but frontend sends inviter_code = referral_code (9-digit user-facing).
-- Result: referred_by was always NULL or set to child's own UUID.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create validate_referral_code RPC
-- SECURITY DEFINER so anon users can call it before signup (bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT id, phone_number
    FROM public.users
    WHERE UPPER(referral_code) = UPPER(TRIM(p_code))
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix handle_new_user trigger
-- Priority 1: referrer_uuid from auth metadata (set by frontend after RPC)
-- Priority 2: referral_code lookup (9-digit user-facing code)
-- Guard: self-referral is always cleared
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone          TEXT;
  v_inviter_code   TEXT;
  v_referrer_uuid  TEXT;
  v_referred_by    UUID := NULL;
  v_invite_code    TEXT;
  v_taken          BOOLEAN;
BEGIN
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone_number', '');
  v_inviter_code  := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'inviter_code', '')), '');
  v_referrer_uuid := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referrer_uuid', '')), '');

  -- Priority 1: use referrer_uuid passed directly from frontend
  IF v_referrer_uuid IS NOT NULL THEN
    BEGIN
      v_referred_by := v_referrer_uuid::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      v_referred_by := NULL;
    END;
  END IF;

  -- Priority 2: resolve via referral_code (9-digit user-facing code)
  IF v_referred_by IS NULL AND v_inviter_code IS NOT NULL THEN
    SELECT id INTO v_referred_by
    FROM public.users
    WHERE UPPER(referral_code) = UPPER(v_inviter_code)
    LIMIT 1;
  END IF;

  -- Safety: never allow self-referral
  IF v_referred_by = NEW.id THEN
    v_referred_by := NULL;
  END IF;

  -- Generate unique 6-char alphanumeric invite_code
  LOOP
    v_invite_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE invite_code = v_invite_code) INTO v_taken;
    EXIT WHEN NOT v_taken;
  END LOOP;

  INSERT INTO public.users (
    id, phone_number, invite_code, inviter_code, referred_by,
    vip_level, total_bets, is_agent, main_balance, game_balance,
    wagering_required, wagering_completed, created_at, updated_at
  ) VALUES (
    NEW.id, NULLIF(v_phone, ''), v_invite_code, v_inviter_code, v_referred_by,
    0, 0, FALSE, 0, 0, 0, 0, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Data migration — fix existing self-referral records
-- Finds users where referred_by = id, resolves correct parent via inviter_code
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  v_parent_id UUID;
BEGIN
  FOR r IN
    SELECT id, inviter_code
    FROM public.users
    WHERE referred_by = id
      AND inviter_code IS NOT NULL
  LOOP
    SELECT id INTO v_parent_id
    FROM public.users
    WHERE UPPER(referral_code) = UPPER(r.inviter_code)
      AND id <> r.id
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
      UPDATE public.users SET referred_by = v_parent_id WHERE id = r.id;
      RAISE NOTICE 'Fixed user %: referred_by set to %', r.id, v_parent_id;
    ELSE
      -- Parent not found: clear self-referral rather than leave it broken
      UPDATE public.users SET referred_by = NULL WHERE id = r.id;
      RAISE NOTICE 'Cleared self-referral for user % (inviter_code % not found)', r.id, r.inviter_code;
    END IF;
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment and run after patch)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Confirm no self-referrals remain:
-- SELECT id, referred_by FROM public.users WHERE referred_by = id;

-- 2. Confirm validate_referral_code works (replace with a real code):
-- SELECT * FROM public.validate_referral_code('329554612');

-- 3. Confirm the known broken child record is fixed:
-- SELECT id, inviter_code, referred_by FROM public.users WHERE id = 'a59803e0-a42d-47d7-87d8-c7f6ae7f4816';
