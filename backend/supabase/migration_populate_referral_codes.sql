-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Populate Missing referral_code Values
-- ════════════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE:
--   Ensure every user has a unique 9-digit numeric UID in referral_code column
--   This is the REAL production UID that must be displayed everywhere
--
-- EXECUTION:
--   Run this in Supabase SQL Editor with service_role access
--
-- ════════════════════════════════════════════════════════════════════════════════

-- Step 1: Check current state
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN referral_code IS NOT NULL THEN 1 END) as with_uid,
  COUNT(CASE WHEN referral_code IS NULL THEN 1 END) as without_uid
FROM public.users;

-- Step 2: Generate unique 9-digit UIDs for users without referral_code
-- Using a deterministic approach based on user ID to ensure consistency
UPDATE public.users
SET referral_code = LPAD(
  (
    (
      (CAST(SUBSTRING(id::TEXT, 1, 8) AS BIGINT) % 900000000) + 100000000
    ) % 1000000000
  )::TEXT,
  9,
  '0'
)
WHERE referral_code IS NULL;

-- Step 3: Verify all users now have referral_code
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN referral_code IS NOT NULL THEN 1 END) as with_uid,
  COUNT(CASE WHEN referral_code IS NULL THEN 1 END) as without_uid
FROM public.users;

-- Step 4: Check for any duplicates (should be 0)
SELECT referral_code, COUNT(*) as count
FROM public.users
WHERE referral_code IS NOT NULL
GROUP BY referral_code
HAVING COUNT(*) > 1;

-- Step 5: Verify format (all should be 9 digits)
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN referral_code ~ '^\d{9}$' THEN 1 END) as valid_format,
  COUNT(CASE WHEN referral_code !~ '^\d{9}$' THEN 1 END) as invalid_format
FROM public.users
WHERE referral_code IS NOT NULL;

-- Step 6: Sample check - show some users with their UIDs
SELECT id, phone_number, referral_code, created_at
FROM public.users
WHERE referral_code IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Check if a specific UID exists
-- SELECT * FROM public.users WHERE referral_code = '162334511';

-- Check all users with their UIDs
-- SELECT id, phone_number, referral_code FROM public.users ORDER BY created_at DESC;

-- Check for NULL referral_codes
-- SELECT COUNT(*) FROM public.users WHERE referral_code IS NULL;

-- ════════════════════════════════════════════════════════════════════════════════
