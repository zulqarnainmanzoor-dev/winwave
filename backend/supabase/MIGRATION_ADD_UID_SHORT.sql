-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add uid_short column to users table
-- Purpose: Store production numeric UID for search and display
-- ════════════════════════════════════════════════════════════════════════════════

-- Step 1: Add uid_short column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS uid_short TEXT UNIQUE;

-- Step 2: Create index for fast UID lookups
CREATE INDEX IF NOT EXISTS idx_users_uid_short ON public.users(uid_short);

-- Step 3: Generate uid_short for existing users (first 9 digits of UUID without hyphens)
UPDATE public.users
SET uid_short = SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 9)
WHERE uid_short IS NULL;

-- Step 4: Add NOT NULL constraint after populating
ALTER TABLE public.users
ALTER COLUMN uid_short SET NOT NULL;

-- Step 5: Create trigger to auto-generate uid_short for new users
CREATE OR REPLACE FUNCTION public.fn_generate_uid_short()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.uid_short IS NULL THEN
    NEW.uid_short := SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 9);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_uid_short ON public.users;
CREATE TRIGGER trg_generate_uid_short
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_generate_uid_short();

-- ════════════════════════════════════════════════════════════════════════════════
-- Verification queries
-- ════════════════════════════════════════════════════════════════════════════════

-- Check that uid_short is populated
-- SELECT id, uid_short, phone_number FROM public.users LIMIT 10;

-- Check for any NULL uid_short values
-- SELECT COUNT(*) as null_count FROM public.users WHERE uid_short IS NULL;

-- Check for duplicate uid_short values
-- SELECT uid_short, COUNT(*) as count FROM public.users GROUP BY uid_short HAVING COUNT(*) > 1;
