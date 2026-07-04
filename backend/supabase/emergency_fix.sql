-- ================================================================
-- EMERGENCY FIX: Database Schema and Referral System
-- Run this in Supabase SQL Editor to fix all issues
-- ================================================================

-- ── 1. USERS TABLE: Add missing columns ───────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{"easypaisa": null, "jazzcash": null}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_invitees INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS inviter_code TEXT,
  ADD COLUMN IF NOT EXISTS total_commission_earned NUMERIC(18,2) DEFAULT 0;

-- Create unique index on referral_code
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

-- ── 2. FORCE POSTGREST CACHE RELOAD ───────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 3. WITHDRAWAL HISTORY: Add missing columns ────────────────────
ALTER TABLE public.withdrawal_history
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_ref TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ── 4. DEPOSIT HISTORY: Add missing columns ───────────────────────
ALTER TABLE public.deposit_history
  ADD COLUMN IF NOT EXISTS gateway_ref TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ── 5. Verify all tables exist ────────────────────────────────────
SELECT 'users' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL
SELECT 'withdrawal_history', COUNT(*) FROM public.withdrawal_history
UNION ALL
SELECT 'deposit_history', COUNT(*) FROM public.deposit_history;

-- ── 6. Verify columns exist ────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('bank_details', 'total_invitees', 'referral_code', 'inviter_code', 'total_commission_earned')
ORDER BY column_name;