-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Missing Indexes for Agent Dashboard Performance
-- Purpose: Ensure fast queries for agent statistics and member lookups
-- ════════════════════════════════════════════════════════════════════════════════

-- Index for deposit_history queries by user and status
CREATE INDEX IF NOT EXISTS idx_dh_user_status ON public.deposit_history(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dh_user_created ON public.deposit_history(user_id, created_at DESC);

-- Index for withdrawal_history queries by user and status
CREATE INDEX IF NOT EXISTS idx_wh_user_status ON public.withdrawal_history(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wh_user_created ON public.withdrawal_history(user_id, created_at DESC);

-- Index for betting_history queries by user and status
CREATE INDEX IF NOT EXISTS idx_bh_user_status ON public.betting_history(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bh_user_created ON public.betting_history(user_id, created_at DESC);

-- Index for transactions queries by user, type, and status
CREATE INDEX IF NOT EXISTS idx_trans_user_type_status ON public.transactions(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_trans_user_created ON public.transactions(user_id, created_at DESC);

-- Index for users referred_by (agent's direct members)
CREATE INDEX IF NOT EXISTS idx_users_referred_by_created ON public.users(referred_by, created_at DESC);

-- Index for fast referral code lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code_lower ON public.users(LOWER(referral_code)) WHERE referral_code IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
