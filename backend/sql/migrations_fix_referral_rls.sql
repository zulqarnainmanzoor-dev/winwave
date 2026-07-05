-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix RLS so referral queries work from the frontend
--
-- Problem: The master schema creates "users_select_own" which only allows
-- auth.uid() = id. This blocks the frontend from reading rows WHERE
-- referred_by = auth.uid(), so all referral counts return 0.
--
-- Fix: Add a second SELECT policy that allows authenticated users to read
-- rows where they are the referrer (referred_by = auth.uid()).
-- This is the minimum required — users cannot read arbitrary other users.
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop the old catch-all policy from add_referral_rls_policy.sql if it exists
DROP POLICY IF EXISTS select_own_user ON public.users;

-- Drop and recreate the select policy to include referral reads
DROP POLICY IF EXISTS "users_select_own" ON public.users;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (
    -- Own row
    auth.uid() = id
    OR
    -- Rows this user referred (for referral stats)
    referred_by = auth.uid()
  );

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'RLS updated: users can now read their own row AND rows they referred.';
END;
$$;
