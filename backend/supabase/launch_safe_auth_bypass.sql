-- Temporary launch-safe bypass for auth signup failures.
-- This disables the custom trigger-driven profile creation path for auth.users
-- while preserving Supabase Auth signup and frontend referral validation.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Keep the function stubbed so the database stays consistent and no custom
-- registration logic runs during auth signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- No trigger attached; Supabase Auth signup will not invoke the custom profile insert path.
