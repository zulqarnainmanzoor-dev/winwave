-- Migration: Create validate_referral_code RPC
-- This replaces validate_invite_code which checked the wrong column
-- 
-- IMPORTANT: Run this AFTER confirming referral_code is the correct column
-- DO NOT run if invite_code is still needed for other purposes

-- Drop old RPC if it exists (it checked invite_code, which is wrong)
DROP FUNCTION IF EXISTS public.validate_invite_code(TEXT);

-- Create new RPC that checks referral_code (the user-facing code)
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT id, phone_number
    FROM public.users
    WHERE referral_code = UPPER(TRIM(p_code))
    LIMIT 1;
END;
$$;

-- Grant to anon so unauthenticated users (registration) can validate codes
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon;

-- Grant to authenticated for consistency
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Created validate_referral_code RPC. This checks public.users.referral_code (NOT invite_code).';
END;
$$;