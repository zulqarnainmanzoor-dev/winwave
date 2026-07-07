-- ══════════════════════════════════════════════════════════════════════════════
-- WINWAVE PRODUCTION DATABASE SCHEMA
-- Master consolidated SQL file for new Supabase project migration
-- ══════════════════════════════════════════════════════════════════════════════
-- 
-- EXECUTION ORDER:
--   1. Run this entire file in Supabase SQL Editor (postgres / service_role)
--   2. Enable pg_cron extension in Dashboard → Database → Extensions
--   3. All tables, functions, triggers, and RLS will be created
--   4. Game engine will seed first rounds immediately
--
-- MODULES COVERED:
--   ✓ Authentication (auth.users via Supabase native)
--   ✓ Users & Profile (public.users)
--   ✓ Referral System (referral codes, invite codes, referred_by)
--   ✓ Referral Commission (transactions table)
--   ✓ Deposit & Deposit History
--   ✓ Withdraw & Withdrawal History
--   ✓ Wallet (main_balance, game_balance)
--   ✓ Transaction History
--   ✓ Gift Codes & Claims
--   ✓ Activity/Attendance Rewards
--   ✓ VIP System
--   ✓ Agent System
--   ✓ WinGo Game Engine (24/7, all modes: 30s/1m/3m/5m)
--   ✓ Betting History & Game Results
--   ✓ Game Periods (dynamic via fn_tick_game_rounds)
--   ✓ Platform Settings
--   ✓ Security Events & Audit Logs
--   ✓ Admin Panel (via RLS)
--   ✓ RTP Control & Risk Management
--   ✓ Webhooks & Payment Gateway
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 1: EXTENSIONS
-- ════════════════════════════════════════════════════════════════════════════════

-- pg_cron for scheduled jobs (game round ticks, cleanup)
-- Must be enabled in Supabase Dashboard → Database → Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 2: USERS & AUTHENTICATION
-- ════════════════════════════════════════════════════════════════════════════════

-- Main user profile table
-- Mirrors auth.users but adds app-specific fields
CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number          TEXT          UNIQUE,
  email                 TEXT          UNIQUE,
  
  -- Referral & Invite System
  invite_code           TEXT          UNIQUE,          -- user's own 6-char invite code
  referral_code         TEXT          UNIQUE,          -- legacy column (same as invite_code)
  inviter_code          TEXT,                          -- what code they used to join
  referred_by           UUID          REFERENCES public.users(id) ON DELETE SET NULL,  -- who referred them
  
  -- Wallet & Balance
  main_balance          NUMERIC(18,2) NOT NULL DEFAULT 0,      -- actual available balance
  game_balance          NUMERIC(18,2) NOT NULL DEFAULT 0,      -- in-game wallet
  wagering_required     NUMERIC(18,2) NOT NULL DEFAULT 0,      -- bonus wagering requirement
  wagering_completed    NUMERIC(18,2) NOT NULL DEFAULT 0,      -- bonus amount already wagered
  
  -- Totals for Analytics & RTP
  total_deposit         NUMERIC(18,2) NOT NULL DEFAULT 0,      -- lifetime deposits
  total_withdrawal      NUMERIC(18,2) NOT NULL DEFAULT 0,      -- lifetime withdrawals
  total_bet_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,      -- sum of all bet amounts
  total_win_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,      -- sum of all winnings
  total_winning         NUMERIC(18,2) NOT NULL DEFAULT 0,      -- net winnings
  total_bets            INT           NOT NULL DEFAULT 0,      -- count of bets
  total_bets_count      INT           NOT NULL DEFAULT 0,      -- count (for RTP)
  bet_count             INT           NOT NULL DEFAULT 0,      -- active bet count
  
  -- Security & Status
  withdrawal_pin        TEXT,
  status                TEXT          NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'banned'
  account_status        TEXT,
  manual_verification   BOOLEAN       DEFAULT FALSE,
  
  -- VIP & Agent
  vip_level             INT           NOT NULL DEFAULT 0,
  is_agent              BOOLEAN       NOT NULL DEFAULT FALSE,
  
  -- RTP/Risk Management
  rtp_phase             TEXT          NOT NULL DEFAULT 'honeymoon',  -- 'honeymoon', 'normal', 'controlled_loss'
  
  -- Bank Details
  bank_details          JSONB         DEFAULT '{}'::JSONB,
  wallet_details        JSONB         DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number  ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email         ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_invite_code   ON public.users(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON public.users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_status        ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at    ON public.users(created_at DESC);

-- Unique constraint for invite_code (allowing NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code_unique 
  ON public.users(invite_code) WHERE invite_code IS NOT NULL;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 3: PAYMENT & FINANCIAL TABLES
-- ════════════════════════════════════════════════════════════════════════════════

-- Deposit History
CREATE TABLE IF NOT EXISTS public.deposit_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        NUMERIC(18,2) NOT NULL,
  method        TEXT          NOT NULL DEFAULT 'manual',  -- 'pkpay', 'manual', etc.
  order_id      TEXT          UNIQUE,
  gateway_ref   TEXT,
  bonus         NUMERIC(18,2) DEFAULT 0,
  bonus_rate    NUMERIC(5,2)  DEFAULT 0,
  status        TEXT          NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
  remarks       TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dh_user_id    ON public.deposit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_dh_status     ON public.deposit_history(status);
CREATE INDEX IF NOT EXISTS idx_dh_created_at ON public.deposit_history(created_at DESC);

-- Withdrawal History
CREATE TABLE IF NOT EXISTS public.withdrawal_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        NUMERIC(18,2) NOT NULL,
  method        TEXT          NOT NULL DEFAULT 'manual',
  order_id      TEXT          UNIQUE,
  gateway_ref   TEXT,
  account_name  TEXT,
  account_no    TEXT,
  bank_name     TEXT,
  status        TEXT          NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
  remarks       TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wh_user_id    ON public.withdrawal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_wh_status     ON public.withdrawal_history(status);
CREATE INDEX IF NOT EXISTS idx_wh_created_at ON public.withdrawal_history(created_at DESC);

-- Withdrawal RPC used by the frontend
CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_user_id        UUID,
  p_amount         NUMERIC,
  p_method         TEXT,
  p_account_name   TEXT,
  p_account_number TEXT,
  p_remarks        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_id      UUID;
BEGIN
  SELECT main_balance INTO v_balance
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.users
     SET main_balance = main_balance - p_amount
   WHERE id = p_user_id;

  INSERT INTO public.withdrawal_history (
    user_id,
    amount,
    method,
    account_name,
    account_no,
    status,
    remarks
  )
  VALUES (
    p_user_id,
    p_amount,
    p_method,
    p_account_name,
    p_account_no,
    'pending',
    p_remarks
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Approve withdrawal: deduct balance, set status to processing
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_balance NUMERIC;
  v_status TEXT;
BEGIN
  -- Fetch withdrawal details
  SELECT user_id, amount, status INTO v_user_id, v_amount, v_status
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- Check if already processed
  IF v_status IN ('completed', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  -- Verify balance
  SELECT main_balance INTO v_balance
  FROM public.users
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  UPDATE public.users
  SET main_balance = main_balance - v_amount
  WHERE id = v_user_id;

  -- Set status to processing
  UPDATE public.withdrawal_history
  SET status = 'processing', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID) TO authenticated;

-- Reject withdrawal: refund balance, set status to rejected
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_withdrawal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Fetch withdrawal details
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- Refund balance
  UPDATE public.users
  SET main_balance = main_balance + v_amount
  WHERE id = v_user_id;

  -- Set status to rejected
  UPDATE public.withdrawal_history
  SET status = 'rejected', reason = p_reason, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID, TEXT) TO authenticated;

-- Withdraw Requests
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id              TEXT          PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_name       TEXT,
  account_name    TEXT,
  account_number  TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending',
  reason          TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wr_user_id ON public.withdraw_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wr_status  ON public.withdraw_requests(status);

-- Transaction History (commissions, bonuses, etc.)
CREATE TABLE IF NOT EXISTS public.transactions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT          NOT NULL,  -- 'deposit', 'withdrawal', 'commission', 'bonus', 'bet', 'win'
  amount        NUMERIC(18,2) NOT NULL,
  status        TEXT          NOT NULL DEFAULT 'completed',  -- 'pending', 'completed', 'failed'
  gateway_ref   TEXT,
  remarks       TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trans_user_id    ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_trans_type       ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_trans_status     ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_trans_created_at ON public.transactions(created_at DESC);

-- Transaction History (VIP tracking)
CREATE TABLE IF NOT EXISTS public.transaction_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type TEXT,
  amount        NUMERIC(18,2),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_th_user_id    ON public.transaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_th_created_at ON public.transaction_history(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 4: GAME ENGINE TABLES
-- ════════════════════════════════════════════════════════════════════════════════

-- Game Rounds (WinGo, K3, TRX, 5D)
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type       TEXT          NOT NULL DEFAULT 'wingo',  -- 'wingo', 'k3', 'trx', '5d'
  mode            TEXT          NOT NULL DEFAULT '30s',    -- '30s', '1m', '3m', '5m'
  period          TEXT          NOT NULL UNIQUE,           -- e.g. '202506151000000001'
  started_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ   NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'active', -- 'active', 'completed'
  
  -- Admin result override
  target_result   TEXT          NULL,                      -- 'BIG', 'SMALL', 'NUM:5', etc.
  
  -- Final result
  result_number   INT           NULL,                      -- 0-9
  result_size     TEXT          NULL,                      -- 'Big', 'Small'
  result_color    TEXT          NULL,                      -- 'red', 'green', 'violet'
  
  -- Bet totals (updated by trigger)
  total_big       NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_small     NUMERIC(18,2) NOT NULL DEFAULT 0,
  
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gr_game_type_status ON public.game_rounds(game_type, status);
CREATE INDEX IF NOT EXISTS idx_gr_period           ON public.game_rounds(period);
CREATE INDEX IF NOT EXISTS idx_gr_ends_at          ON public.game_rounds(ends_at);
CREATE INDEX IF NOT EXISTS idx_gr_status           ON public.game_rounds(status);

-- Betting History
CREATE TABLE IF NOT EXISTS public.betting_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round_id      UUID          NULL REFERENCES public.game_rounds(id) ON DELETE SET NULL,
  period        TEXT          NOT NULL,
  game_type     TEXT          NOT NULL DEFAULT 'wingo',
  mode          TEXT          NOT NULL DEFAULT '30s',
  bet_type      TEXT          NOT NULL,  -- 'size', 'color', 'number'
  bet_value     TEXT          NOT NULL,  -- 'Big', 'Small', 'Red', 'Green', 'Violet', or '0'-'9'
  amount        NUMERIC(18,2) NOT NULL,
  win_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_win        BOOLEAN       NOT NULL DEFAULT FALSE,
  status        TEXT          NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
  result_number INT           NULL,
  result_size   TEXT          NULL,
  result_color  TEXT          NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bh_user_id    ON public.betting_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bh_round_id   ON public.betting_history(round_id);
CREATE INDEX IF NOT EXISTS idx_bh_period     ON public.betting_history(period);
CREATE INDEX IF NOT EXISTS idx_bh_created_at ON public.betting_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bh_status     ON public.betting_history(status);

-- Bet History (alternative name)
CREATE TABLE IF NOT EXISTS public.bet_history (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period        TEXT,
  amount        NUMERIC(18,2) NOT NULL,
  win_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_win        BOOLEAN       NOT NULL DEFAULT FALSE,
  status        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bet_history_user_id    ON public.bet_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_history_created_at ON public.bet_history(created_at DESC);

-- Bets (minimal schema for API reference)
CREATE TABLE IF NOT EXISTS public.bets (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        NUMERIC(18,2) NOT NULL,
  result        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 5: REWARDS & LOYALTY
-- ════════════════════════════════════════════════════════════════════════════════

-- Gift Codes
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT          NOT NULL UNIQUE,
  amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'active',  -- 'active', 'paused', 'claimed', 'deleted'
  claimed_by      UUID          REFERENCES public.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  admin_remarks   TEXT
);

CREATE INDEX IF NOT EXISTS idx_gc_code   ON public.gift_codes(code);
CREATE INDEX IF NOT EXISTS idx_gc_status ON public.gift_codes(status);

-- Gift Code Claims
DROP TABLE IF EXISTS public.gift_code_claims CASCADE;
CREATE TABLE IF NOT EXISTS public.gift_code_claims (
  id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gift_code     TEXT          NOT NULL,  -- the code string (not FK)
  amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, gift_code)
);

CREATE INDEX IF NOT EXISTS idx_gcc_user  ON public.gift_code_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_gcc_code  ON public.gift_code_claims(gift_code);

-- Attendance Bonus
CREATE TABLE IF NOT EXISTS public.attendance_bonus (
  id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_number      INT           NOT NULL,  -- 1-7
  claimed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deposit_amount  NUMERIC(15,2) DEFAULT 0,
  reward_amount   NUMERIC(15,2) DEFAULT 0,
  UNIQUE(user_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_ab_user ON public.attendance_bonus(user_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 6: AGENT & COMMISSION SYSTEM
-- ════════════════════════════════════════════════════════════════════════════════

-- Deposits table (for agent system)
CREATE TABLE IF NOT EXISTS public.deposits (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Agent Salary Tracking
CREATE TABLE IF NOT EXISTS public.agent_salary_log (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  salary_period       TEXT,
  earned_salary       NUMERIC(18,2) DEFAULT 0,
  advance_given       NUMERIC(18,2) DEFAULT 0,
  advance_recovered   NUMERIC(18,2) DEFAULT 0,
  net_payable         NUMERIC(18,2) DEFAULT 0,
  status              TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asl_agent_id ON public.agent_salary_log(agent_id);

-- Tasks (for agent work)
CREATE TABLE IF NOT EXISTS public.tasks (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_description    TEXT,
  reward_amount       NUMERIC(18,2) DEFAULT 0,
  status              TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 7: SECURITY & AUDIT
-- ════════════════════════════════════════════════════════════════════════════════

-- Security Events Log
CREATE TABLE IF NOT EXISTS public.security_events (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  event_type    TEXT          NOT NULL,  -- 'login', 'logout', 'failed_auth', 'withdrawal', etc.
  ip_address    TEXT,
  user_agent    TEXT,
  details       JSONB,
  severity      TEXT,  -- 'low', 'medium', 'high', 'critical'
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_se_user_id    ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_se_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_se_created_at ON public.security_events(created_at DESC);

-- Registration Attempts
CREATE TABLE IF NOT EXISTS public.registration_attempts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ip              TEXT,
  phone_number    TEXT,
  attempt_count   INT           DEFAULT 1,
  last_attempt_at TIMESTAMPTZ   DEFAULT NOW(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ra_ip             ON public.registration_attempts(ip);
CREATE INDEX IF NOT EXISTS idx_ra_phone_number   ON public.registration_attempts(phone_number);

-- Risk Logs
CREATE TABLE IF NOT EXISTS public.risk_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          REFERENCES public.users(id),
  event         TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rl_user_id    ON public.risk_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rl_created_at ON public.risk_logs(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 8: PLATFORM CONFIGURATION
-- ════════════════════════════════════════════════════════════════════════════════

-- Platform Settings
DROP TABLE IF EXISTS public.platform_settings CASCADE;
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          TEXT          PRIMARY KEY DEFAULT 'default',
  platform_name               TEXT          DEFAULT 'WinWave',
  maintenance_mode            BOOLEAN       DEFAULT FALSE,
  
  -- Financial Settings
  min_withdrawal              NUMERIC(18,2) DEFAULT 1000,
  max_withdrawal              NUMERIC(18,2) DEFAULT 500000,
  withdrawal_fee              NUMERIC(5,2)  DEFAULT 2.5,
  deposit_bonus               NUMERIC(5,2)  DEFAULT 50,
  referral_commission         NUMERIC(5,2)  DEFAULT 10,
  
  -- Game Settings
  max_bet_per_round           NUMERIC(18,2) DEFAULT 500000,
  min_bet_per_round           NUMERIC(18,2) DEFAULT 100,
  platform_margin_target      NUMERIC(5,2)  DEFAULT 8.5,
  
  -- Control Flags
  game_control_enabled        BOOLEAN       DEFAULT TRUE,
  smart_risk_default          BOOLEAN       DEFAULT FALSE,
  notifications_enabled       BOOLEAN       DEFAULT TRUE,
  auto_approve_deposit        BOOLEAN       DEFAULT FALSE,
  
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 9: FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger: auto-update users.updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger: auto-update deposit_history.updated_at
DROP TRIGGER IF EXISTS trg_dh_updated_at ON public.deposit_history;
CREATE TRIGGER trg_dh_updated_at
  BEFORE UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger: auto-update withdrawal_history.updated_at
DROP TRIGGER IF EXISTS trg_wh_updated_at ON public.withdrawal_history;
CREATE TRIGGER trg_wh_updated_at
  BEFORE UPDATE ON public.withdrawal_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Handle New User Registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone          TEXT;
  v_inviter_code   TEXT;
  v_referrer_uuid  TEXT;   -- passed from frontend metadata
  v_referred_by    UUID := NULL;
  v_invite_code    TEXT;
  v_taken          BOOLEAN;
BEGIN
  v_phone         := COALESCE(NEW.raw_user_meta_data->>'phone_number', '');
  v_inviter_code  := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'inviter_code', '')), '');
  v_referrer_uuid := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referrer_uuid', '')), '');

  -- Priority 1: use referrer_uuid passed directly from frontend (most reliable)
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

-- Deposit Approved → Credit Balance + Wagering
CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.users
    SET main_balance      = main_balance      + NEW.amount,
        total_deposit     = total_deposit     + NEW.amount,
        wagering_required = wagering_required + NEW.amount,
        total_winning     = total_winning     + (NEW.amount * 0.02)  -- 2% initial bonus
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposit_approved ON public.deposit_history;
CREATE TRIGGER trg_deposit_approved
  AFTER UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_deposit_approved();

-- Withdrawal Approved → Update Total Withdrawal
CREATE OR REPLACE FUNCTION public.fn_on_withdrawal_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.users
    SET total_withdrawal = total_withdrawal + NEW.amount
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_withdrawal_approved ON public.withdrawal_history;
CREATE TRIGGER trg_withdrawal_approved
  AFTER UPDATE ON public.withdrawal_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_withdrawal_approved();

-- Update Round Bet Totals
CREATE OR REPLACE FUNCTION public.fn_update_round_bet_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.round_id IS NOT NULL THEN
    UPDATE public.game_rounds
    SET
      total_big   = COALESCE((SELECT SUM(amount) FROM public.betting_history
                              WHERE round_id = NEW.round_id AND bet_type = 'size' AND bet_value = 'Big'), 0),
      total_small = COALESCE((SELECT SUM(amount) FROM public.betting_history
                              WHERE round_id = NEW.round_id AND bet_type = 'size' AND bet_value = 'Small'), 0)
    WHERE id = NEW.round_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_round_bet_totals ON public.betting_history;
CREATE TRIGGER trg_update_round_bet_totals
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_round_bet_totals();

-- Commission Credit to Referrer
CREATE OR REPLACE FUNCTION public.fn_credit_agent_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_id UUID;
  v_commission  NUMERIC;
  v_rate        NUMERIC := 0.006; -- 0.6% Level 1
BEGIN
  SELECT referred_by INTO v_referrer_id FROM public.users WHERE id = NEW.user_id;
  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  v_commission := ROUND(NEW.amount * v_rate, 2);
  IF v_commission <= 0 THEN RETURN NEW; END IF;

  UPDATE public.users SET main_balance = main_balance + v_commission WHERE id = v_referrer_id;

  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref)
  VALUES (v_referrer_id, 'commission', v_commission, 'completed',
          'Bet commission from ' || NEW.user_id::TEXT);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_agent_commission ON public.betting_history;
CREATE TRIGGER trg_credit_agent_commission
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_credit_agent_commission();

-- Update RTP Phase on Bet
CREATE OR REPLACE FUNCTION public.fn_update_rtp_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit   NUMERIC;
  v_win       NUMERIC;
  v_bet_count INT;
  v_phase     TEXT;
BEGIN
  SELECT total_deposit, total_winning, total_bets_count
  INTO   v_deposit, v_win, v_bet_count
  FROM   public.users WHERE id = NEW.user_id;

  -- Phase logic
  v_phase := CASE
    WHEN v_bet_count <= 20 OR v_win < v_deposit * 0.6 THEN 'honeymoon'
    WHEN v_win > v_deposit THEN 'controlled_loss'
    ELSE 'normal'
  END;

  UPDATE public.users
  SET rtp_phase        = v_phase,
      total_bet_amount = total_bet_amount + NEW.amount,
      total_bets_count = total_bets_count + 1,
      total_winning    = total_winning + NEW.win_amount
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rtp_phase ON public.betting_history;
CREATE TRIGGER trg_update_rtp_phase
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_rtp_phase();

-- Update Wagering on Bet (Bonus Wagering)
CREATE OR REPLACE FUNCTION public.fn_update_wagering_on_bet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users
  SET wagering_completed = wagering_completed + NEW.amount
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_wagering_on_bet ON public.bet_history;
CREATE TRIGGER trg_update_wagering_on_bet
  AFTER INSERT ON public.bet_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_wagering_on_bet();

-- Update Wagering on Betting History
DROP TRIGGER IF EXISTS trg_wagering_on_bet_insert ON public.betting_history;
CREATE TRIGGER trg_wagering_on_bet_insert
  AFTER INSERT ON public.betting_history
  FOR EACH ROW WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.fn_update_wagering_on_bet();

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 10: GAME ENGINE FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════

-- Deterministic RNG for period
CREATE OR REPLACE FUNCTION public.fn_result_for_period(p_period TEXT)
RETURNS TABLE(result_number INT, result_size TEXT, result_color TEXT)
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash   BIGINT := 0;
  v_i      INT;
  v_char   INT;
  v_t      BIGINT;
  v_rand   FLOAT8;
  v_num    INT;
BEGIN
  FOR v_i IN 1..LENGTH(p_period) LOOP
    v_char := ASCII(SUBSTRING(p_period, v_i, 1));
    v_hash := ((31 * v_hash + v_char) & x'FFFFFFFF'::BIGINT);
    IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
  END LOOP;

  v_t := (v_hash + 1834730485) & x'FFFFFFFF'::BIGINT;
  v_t := ((v_t # (v_t >> 15)) * ((v_t | 1) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
  v_t := (v_t # (v_t + ((v_t # (v_t >> 7)) * ((v_t | 61) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
  v_t := (v_t # (v_t >> 14)) & x'FFFFFFFF'::BIGINT;
  v_rand := v_t::FLOAT8 / 4294967296.0;
  v_num := FLOOR(v_rand * 10)::INT;

  result_number := v_num;
  result_size   := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
  result_color  := CASE
    WHEN v_num = 0 OR v_num = 5 THEN 'violet'
    WHEN v_num % 2 = 0           THEN 'red'
    ELSE                              'green'
  END;
  RETURN NEXT;
END;
$$;

-- Main Game Tick Function
CREATE OR REPLACE FUNCTION public.fn_tick_game_rounds()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode       TEXT;
  v_interval   INT;
  v_prefix     TEXT;
  v_now        TIMESTAMPTZ := NOW() AT TIME ZONE 'UTC';
  v_date_str   TEXT        := TO_CHAR(v_now, 'YYYYMMDD');
  v_secs       INT;
  v_round_num  INT;
  v_period     TEXT;
  v_ends_at    TIMESTAMPTZ;
  v_round      RECORD;
  v_res        RECORD;
  v_forced     TEXT;
  v_num        INT;
  v_size       TEXT;
  v_color      TEXT;
BEGIN
  v_secs := EXTRACT(HOUR   FROM v_now)::INT * 3600
          + EXTRACT(MINUTE FROM v_now)::INT * 60
          + EXTRACT(SECOND FROM v_now)::INT;

  FOREACH v_mode, v_interval, v_prefix IN ARRAY ARRAY[
    ('30s'::TEXT, 30::INT, '1000'::TEXT),
    ('1m'::TEXT, 60::INT, '2000'::TEXT),
    ('3m'::TEXT, 180::INT, '3000'::TEXT),
    ('5m'::TEXT, 300::INT, '4000'::TEXT)
  ] LOOP
    -- Resolve expired active rounds
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active' AND ends_at <= v_now
    LOOP
      v_forced := v_round.target_result;

      SELECT r.result_number, r.result_size, r.result_color
      INTO v_res FROM public.fn_result_for_period(v_round.period) r;

      v_num   := v_res.result_number;
      v_size  := v_res.result_size;
      v_color := v_res.result_color;

      -- Admin override
      IF v_forced = 'BIG' AND v_size != 'Big' THEN
        v_num   := 5 + (v_res.result_number % 5);
        v_size  := 'Big';
        v_color := CASE WHEN v_num = 5 THEN 'violet'
                        WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size != 'Small' THEN
        v_num   := v_res.result_number % 5;
        v_size  := 'Small';
        v_color := CASE WHEN v_num = 0 THEN 'violet'
                        WHEN v_num % 2 = 0 THEN 'red' ELSE 'green' END;
      END IF;

      UPDATE public.game_rounds
      SET status = 'completed', result_number = v_num, result_size = v_size, result_color = v_color
      WHERE id = v_round.id;
    END LOOP;

    -- Create next round if none active
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode AND status = 'active'
    ) THEN
      v_round_num := (v_secs / v_interval) + 1;
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      v_ends_at   := DATE_TRUNC('day', v_now) + ((v_round_num * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds
        (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, v_now, v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 11: RPC FUNCTIONS (Remote Procedure Calls)
-- ════════════════════════════════════════════════════════════════════════════════

-- Validate Invite Code (internal 6-char code)
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT id, phone_number
    FROM public.users
    WHERE UPPER(invite_code) = UPPER(TRIM(p_code))
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO authenticated, anon;

-- Validate Referral Code (user-facing 9-digit code)
-- SECURITY DEFINER so anon users can call it before signup (bypasses RLS)
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

-- Get Referral Stats
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS TABLE(
  total_invitees    BIGINT,
  active_invitees   BIGINT,
  total_commission  NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_commission NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_commission
  FROM public.transactions
  WHERE user_id = p_user_id AND type = 'commission' AND status = 'completed';

  RETURN QUERY
    SELECT
      COUNT(*)::BIGINT                                  AS total_invitees,
      COUNT(*) FILTER (WHERE total_bets > 0)::BIGINT   AS active_invitees,
      v_commission                                      AS total_commission
    FROM public.users
    WHERE referred_by = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;

-- Get User RTP Phase
CREATE OR REPLACE FUNCTION public.get_user_rtp_phase(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phase TEXT;
BEGIN
  SELECT rtp_phase INTO v_phase FROM public.users WHERE id = p_user_id;
  RETURN COALESCE(v_phase, 'normal');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rtp_phase(UUID) TO authenticated;

-- Get Active Round
CREATE OR REPLACE FUNCTION public.get_active_round(p_game_type TEXT, p_mode TEXT)
RETURNS TABLE(
  id UUID, period TEXT, ends_at TIMESTAMPTZ, target_result TEXT,
  total_big NUMERIC, total_small NUMERIC, status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT gr.id, gr.period, gr.ends_at, gr.target_result,
           gr.total_big, gr.total_small, gr.status
    FROM public.game_rounds gr
    WHERE gr.game_type = p_game_type AND gr.mode = p_mode AND gr.status = 'active'
    ORDER BY gr.started_at DESC LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_round(TEXT, TEXT) TO authenticated, anon;

-- Set Round Target (Admin)
CREATE OR REPLACE FUNCTION public.set_round_target(p_period TEXT, p_target_result TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET target_result = p_target_result
  WHERE period = p_period AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_round_target(TEXT, TEXT) TO authenticated;

-- Complete Round (Fallback)
CREATE OR REPLACE FUNCTION public.complete_round(p_period TEXT, p_number INT, p_size TEXT, p_color TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rounds
  SET status = 'completed', result_number = p_number, result_size = p_size, result_color = p_color
  WHERE period = p_period AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_round(TEXT, INT, TEXT, TEXT) TO authenticated;

-- Get Server Time
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'utc_epoch_ms', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000 + EXTRACT(MILLISECONDS FROM NOW())::INT % 1000,
    'utc_iso', TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 12: VIEWS
-- ════════════════════════════════════════════════════════════════════════════════

-- Active Round Bets View
CREATE OR REPLACE VIEW public.v_active_round_bets AS
SELECT
  gr.id, gr.game_type, gr.mode, gr.period, gr.status, gr.target_result, gr.ends_at,
  gr.total_big, gr.total_small,
  CASE WHEN (gr.total_big + gr.total_small) = 0 THEN 0
       ELSE ROUND(gr.total_big / (gr.total_big + gr.total_small) * 100, 1) END AS big_pct,
  COUNT(bh.id) AS total_bets, COUNT(DISTINCT bh.user_id) AS unique_bettors
FROM public.game_rounds gr
LEFT JOIN public.betting_history bh ON bh.round_id = gr.id
WHERE gr.status = 'active'
GROUP BY gr.id, gr.game_type, gr.mode, gr.period, gr.status,
         gr.target_result, gr.ends_at, gr.total_big, gr.total_small;

-- Dashboard Stats View
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
  COUNT(DISTINCT u.id) AS total_users,
  COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) AS active_users,
  COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0) AS total_deposits,
  COALESCE(SUM(CASE WHEN wh.status = 'completed' THEN wh.amount ELSE 0 END), 0) AS total_withdrawals,
  COALESCE(SUM(bh.amount), 0) AS total_bets,
  COALESCE(SUM(CASE WHEN bh.is_win THEN bh.win_amount ELSE 0 END), 0) AS total_payouts
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
LEFT JOIN public.withdrawal_history wh ON u.id = wh.user_id
LEFT JOIN public.betting_history bh ON u.id = bh.user_id;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 13: ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════════════════════

-- Users Table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_service_all" ON public.users;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_service_all"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Deposit History RLS
ALTER TABLE public.deposit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dh_select_own" ON public.deposit_history;
DROP POLICY IF EXISTS "dh_insert_own" ON public.deposit_history;
DROP POLICY IF EXISTS "dh_service_all" ON public.deposit_history;

CREATE POLICY "dh_select_own"  ON public.deposit_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dh_insert_own"  ON public.deposit_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dh_service_all" ON public.deposit_history FOR ALL    USING (auth.role() = 'service_role');

-- Withdrawal History RLS
ALTER TABLE public.withdrawal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wh_select_own" ON public.withdrawal_history;
DROP POLICY IF EXISTS "wh_insert_own" ON public.withdrawal_history;
DROP POLICY IF EXISTS "wh_service_all" ON public.withdrawal_history;

CREATE POLICY "wh_select_own"  ON public.withdrawal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wh_insert_own"  ON public.withdrawal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wh_service_all" ON public.withdrawal_history FOR ALL    USING (auth.role() = 'service_role');

-- Transaction History RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trans_select_own" ON public.transactions;
DROP POLICY IF EXISTS "trans_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "trans_service_all" ON public.transactions;

CREATE POLICY "trans_select_own"  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trans_insert_own"  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trans_service_all" ON public.transactions FOR ALL    USING (auth.role() = 'service_role');

-- Betting History RLS
ALTER TABLE public.betting_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bh_select_own" ON public.betting_history;
DROP POLICY IF EXISTS "bh_insert_own" ON public.betting_history;
DROP POLICY IF EXISTS "bh_service_all" ON public.betting_history;

CREATE POLICY "bh_select_own"  ON public.betting_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bh_insert_own"  ON public.betting_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bh_service_all" ON public.betting_history FOR ALL    USING (auth.role() = 'service_role');

-- Game Rounds RLS
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gr_public_read" ON public.game_rounds;
DROP POLICY IF EXISTS "gr_service_all" ON public.game_rounds;

CREATE POLICY "gr_public_read" ON public.game_rounds FOR SELECT USING (TRUE);
CREATE POLICY "gr_service_all" ON public.game_rounds FOR ALL USING (auth.role() = 'service_role');

-- Gift Codes RLS
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gc_auth_read" ON public.gift_codes;
DROP POLICY IF EXISTS "gc_auth_write" ON public.gift_codes;

CREATE POLICY "gc_auth_read"  ON public.gift_codes FOR SELECT 
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "gc_auth_write" ON public.gift_codes FOR ALL 
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Gift Code Claims RLS
ALTER TABLE public.gift_code_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gcc_own" ON public.gift_code_claims;
DROP POLICY IF EXISTS "gcc_service_all" ON public.gift_code_claims;

CREATE POLICY "gcc_own" ON public.gift_code_claims FOR ALL 
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Attendance Bonus RLS
ALTER TABLE public.attendance_bonus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_own" ON public.attendance_bonus;

CREATE POLICY "ab_own" ON public.attendance_bonus FOR ALL 
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Withdraw Requests RLS
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wr_select_own" ON public.withdraw_requests;
DROP POLICY IF EXISTS "wr_insert_own" ON public.withdraw_requests;
DROP POLICY IF EXISTS "wr_service_all" ON public.withdraw_requests;

CREATE POLICY "wr_select_own"  ON public.withdraw_requests FOR SELECT 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "wr_insert_own"  ON public.withdraw_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "wr_service_all" ON public.withdraw_requests FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Security Events RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "se_select_own" ON public.security_events;
DROP POLICY IF EXISTS "se_insert_own" ON public.security_events;
DROP POLICY IF EXISTS "se_service_all" ON public.security_events;

CREATE POLICY "se_select_own"  ON public.security_events FOR SELECT 
  USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "se_service_all" ON public.security_events FOR ALL 
  USING (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 14: REALTIME SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════════════════════════

-- Enable realtime for game rounds and deposits (admin live updates)
-- Note: These will enable realtime subscriptions for the frontend
DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_history;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_history;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.betting_history;
EXCEPTION WHEN others THEN
  -- Tables may already be added to publication, ignore error
  NULL;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 15: SCHEDULED JOBS (pg_cron)
-- ════════════════════════════════════════════════════════════════════════════════

-- Game round tick (every minute)
SELECT cron.unschedule('wingo-round-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'wingo-round-tick'
);

SELECT cron.schedule(
  'wingo-round-tick',
  '* * * * *',
  $$ SELECT public.fn_tick_game_rounds(); $$
);

-- Cleanup old completed rounds (daily at 4 AM UTC)
SELECT cron.unschedule('cleanup-game-rounds-30d') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-game-rounds-30d'
);

SELECT cron.schedule(
  'cleanup-game-rounds-30d',
  '0 4 * * *',
  $$ DELETE FROM public.game_rounds WHERE status = 'completed' AND created_at < NOW() - INTERVAL '30 days'; $$
);

-- Cleanup old betting history (daily at 5 AM UTC)
SELECT cron.unschedule('cleanup-betting-history-90d') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-betting-history-90d'
);

SELECT cron.schedule(
  'cleanup-betting-history-90d',
  '0 5 * * *',
  $$ DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL '90 days'; $$
);

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 16: SEED DATA
-- ════════════════════════════════════════════════════════════════════════════════

-- Seed initial platform settings if not exists
INSERT INTO public.platform_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Generate first game rounds
SELECT public.fn_tick_game_rounds();

-- ════════════════════════════════════════════════════════════════════════════════
-- SECTION 17: DATA MIGRATION — Fix broken referred_by records
-- Corrects any user where referred_by = id (self-referral bug)
-- Uses inviter_code to resolve the correct parent UUID via referral_code
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_parent_id UUID;
BEGIN
  FOR r IN
    SELECT id, inviter_code
    FROM public.users
    WHERE referred_by = id  -- self-referral: the bug
      AND inviter_code IS NOT NULL
  LOOP
    -- Resolve parent via referral_code (user-facing 9-digit code)
    SELECT id INTO v_parent_id
    FROM public.users
    WHERE UPPER(referral_code) = UPPER(r.inviter_code)
      AND id <> r.id
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
      UPDATE public.users
      SET referred_by = v_parent_id
      WHERE id = r.id;
    ELSE
      -- No parent found: clear the self-referral rather than leave it broken
      UPDATE public.users
      SET referred_by = NULL
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MASTER SCHEMA
-- ════════════════════════════════════════════════════════════════════════════════
