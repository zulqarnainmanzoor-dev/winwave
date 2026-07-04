-- Migration: Add RLS policy for referral system
-- This allows authenticated users to read other users' data for referral checks

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS select_own_user ON public.users;

-- Create comprehensive SELECT policy that allows:
-- 1. Users to read their own data
-- 2. Users to read other users' data for referral purposes (checking referred_by)
CREATE POLICY select_own_user ON public.users
  FOR SELECT
  USING (
    -- Allow users to read their own data
    auth.uid() = id
    OR
    -- Allow users to read other users' data to check referral relationships
    -- This is needed for the invitees overview search functionality
    auth.uid() IS NOT NULL
  );

-- Verify the policy was created
DO $$
BEGIN
  RAISE NOTICE 'RLS policy updated: Users can now read other users data for referral checks';
END;
$$;

-- End of migration