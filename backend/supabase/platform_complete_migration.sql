-- ================================================================
-- platform_complete_migration.sql
-- Run in Supabase SQL Editor (service_role / postgres)
-- Covers: Timer sync · RTP engine · Commission · Referral ·
--         History tables · Wagering · Webhook support
-- ================================================================

-- ── 1. TIMER SYNC: Fix fn_tick_game_rounds to use UTC strictly ───
-- Period formula (matches client JS exactly):
--   utc_secs = EXTRACT(EPOCH FROM NOW() AT TIME ZONE 'UTC') % 86400
--   round_num = floor(utc_secs / interval) + 1
--   period    = YYYYMMDD_UTC || prefix || LPAD(round_num, 5, '0')
-- This guarantees 30s never overlaps 1m/3m/5m.

CREATE OR REPLACE FUNCTION public.fn_tick_game_rounds()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_mode      TEXT;
  v_interval  INT;
  v_prefix    TEXT;
  v_now       TIMESTAMPTZ := NOW();
  v_utc_date  TEXT        := TO_CHAR(v_now AT TIME ZONE 'UTC', 'YYYYMMDD');
  -- Seconds since UTC midnight (integer division, no fractional seconds)
  v_utc_secs  INT         := (
    EXTRACT(HOUR   FROM v_now AT TIME ZONE 'UTC')::INT * 3600 +
    EXTRACT(MINUTE FROM v_now AT TIME ZONE 'UTC')::INT * 60  +
    EXTRACT(SECOND FROM v_now AT TIME ZONE 'UTC')::INT
  );
  v_round_num INT;
  v_period    TEXT;
  v_ends_at   TIMESTAMPTZ;
  v_round     RECORD;
  v_num       INT;
  v_size      TEXT;
  v_color     TEXT;
  v_forced    TEXT;
  v_hash      BIGINT;
  v_t         BIGINT;
  v_rand      FLOAT8;
  v_i         INT;
  v_char      INT;
BEGIN
  FOREACH v_mode IN ARRAY ARRAY['30s','1m','3m','5m'] LOOP

    v_interval := CASE v_mode WHEN '30s' THEN 30 WHEN '1m' THEN 60
                               WHEN '3m' THEN 180 ELSE 300 END;
    v_prefix   := CASE v_mode WHEN '30s' THEN '1000' WHEN '1m' THEN '2000'
                               WHEN '3m' THEN '3000' ELSE '4000' END;

    -- a) Resolve expired active rounds
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode
        AND status = 'active' AND ends_at <= v_now
    LOOP
      v_forced := v_round.target_result;

      -- Deterministic RNG (mirrors client JS)
      v_hash := 0;
      FOR v_i IN 1..LENGTH(v_round.period) LOOP
        v_char := ASCII(SUBSTRING(v_round.period, v_i, 1));
        v_hash := ((31 * v_hash + v_char) & x'FFFFFFFF'::BIGINT);
        IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
      END LOOP;
      v_t := (v_hash + 1834730485) & x'FFFFFFFF'::BIGINT;
      v_t := ((v_t # (v_t >> 15)) * ((v_t | 1) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t := (v_t # (v_t + ((v_t # (v_t >> 7)) * ((v_t | 61) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t    := (v_t # (v_t >> 14)) & x'FFFFFFFF'::BIGINT;
      v_rand := v_t::FLOAT8 / 4294967296.0;
      v_num  := FLOOR(v_rand * 10)::INT;
      v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
      v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                      WHEN v_num % 2 = 0  THEN 'red' ELSE 'green' END;

      -- Admin override
      IF v_forced = 'BIG' AND v_size <> 'Big' THEN
        v_num := 5 + (v_num % 5); v_size := 'Big';
        v_color := CASE WHEN v_num=5 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size <> 'Small' THEN
        v_num := v_num % 5; v_size := 'Small';
        v_color := CASE WHEN v_num=0 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced LIKE 'NUM:%' THEN
        v_num := SUBSTRING(v_forced FROM 5)::INT;
        v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
        v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                        WHEN v_num % 2 = 0  THEN 'red' ELSE 'green' END;
      END IF;

      UPDATE public.game_rounds
      SET status='completed', result_number=v_num, result_size=v_size, result_color=v_color
      WHERE id = v_round.id;
    END LOOP;

    -- b) Create next round if none active — using strict UTC math
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type='wingo' AND mode=v_mode AND status='active'
    ) THEN
      v_round_num := (v_utc_secs / v_interval) + 1;
      v_period    := v_utc_date || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      -- ends_at = start of UTC day + round_num * interval seconds
      v_ends_at   := DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                   + (v_round_num * v_interval || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, v_now, v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- Seed immediately
SELECT public.fn_tick_game_rounds();

-- ── 2. RTP / DYNAMIC HOUSE EDGE ENGINE ───────────────────────────
-- Track per-user stats needed for RTP decisions
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_deposit    NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawal NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bet_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_win_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bet_count        INT           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rtp_phase        TEXT          NOT NULL DEFAULT 'honeymoon';
  -- rtp_phase: 'honeymoon' (new user, higher wins) | 'normal' | 'controlled_loss'

-- RTP phase update trigger: runs after every bet resolution
CREATE OR REPLACE FUNCTION public.fn_update_rtp_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_deposit    NUMERIC;
  v_win        NUMERIC;
  v_bet_count  INT;
  v_phase      TEXT;
BEGIN
  SELECT total_deposit, total_win_amount, bet_count
  INTO   v_deposit, v_win, v_bet_count
  FROM   public.users WHERE id = NEW.user_id;

  -- Phase logic:
  -- honeymoon : first 20 bets OR win < 60% of deposit  → 40-60% win rate
  -- normal    : win between 60-100% of deposit          → house edge ~4%
  -- controlled_loss: win > deposit (user is profitable) → force losses
  v_phase := CASE
    WHEN v_bet_count <= 20 OR v_win < v_deposit * 0.6 THEN 'honeymoon'
    WHEN v_win < v_deposit                             THEN 'normal'
    ELSE                                                    'controlled_loss'
  END;

  UPDATE public.users
  SET rtp_phase        = v_phase,
      total_bet_amount = total_bet_amount + NEW.amount,
      bet_count        = bet_count + 1,
      total_win_amount = total_win_amount + NEW.win_amount
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rtp_phase ON public.betting_history;
CREATE TRIGGER trg_update_rtp_phase
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_rtp_phase();

-- RPC: get_user_rtp_phase — called by WinGoView before resolving result
CREATE OR REPLACE FUNCTION public.get_user_rtp_phase(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_phase TEXT;
BEGIN
  SELECT rtp_phase INTO v_phase FROM public.users WHERE id = p_user_id;
  RETURN COALESCE(v_phase, 'normal');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rtp_phase(UUID) TO authenticated;

-- ── 3. COMMISSION ENGINE FIX ──────────────────────────────────────
-- Commission = bet_amount * rate (never flat sum)
-- Level 1 agent = 0.6%, Level 2 = 0.4%, Level 3 = 0.2%
CREATE OR REPLACE FUNCTION public.fn_calculate_commission(
  p_bet_amount NUMERIC,
  p_agent_level INT DEFAULT 1
)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER AS $$
DECLARE
  v_rate NUMERIC := CASE p_agent_level
    WHEN 1 THEN 0.006   -- 0.6%
    WHEN 2 THEN 0.004   -- 0.4%
    WHEN 3 THEN 0.002   -- 0.2%
    ELSE        0.001   -- 0.1% fallback
  END;
BEGIN
  RETURN ROUND(p_bet_amount * v_rate, 2);
END;
$$;

-- Trigger: auto-credit agent commission on every bet insert
CREATE OR REPLACE FUNCTION public.fn_credit_agent_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_referrer_id   UUID;
  v_agent_level   INT := 1;
  v_commission    NUMERIC;
BEGIN
  -- Find who referred this user
  SELECT referred_by INTO v_referrer_id
  FROM public.users WHERE id = NEW.user_id;

  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  v_commission := public.fn_calculate_commission(NEW.amount, v_agent_level);
  IF v_commission <= 0 THEN RETURN NEW; END IF;

  -- Credit commission to referrer's main_balance
  UPDATE public.users
  SET main_balance = main_balance + v_commission
  WHERE id = v_referrer_id;

  -- Log it
  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref)
  VALUES (v_referrer_id, 'commission', v_commission, 'completed',
          'Bet commission from user ' || NEW.user_id::TEXT)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_agent_commission ON public.betting_history;
CREATE TRIGGER trg_credit_agent_commission
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_credit_agent_commission();

-- ── 4. REFERRAL STRUCTURE FIX ─────────────────────────────────────
-- users table already has invite_code and referred_by from earlier migrations.
-- Ensure columns exist and are correctly typed.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invite_code  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by  UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index for fast referral count queries
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users (referred_by);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON public.users (invite_code);

-- RPC: validate_invite_code — used during registration
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT id, phone_number
    FROM public.users
    WHERE invite_code = UPPER(TRIM(p_code))
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO authenticated, anon;

-- RPC: get_referral_stats — used by Promotion dashboard
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS TABLE(
  total_invitees    BIGINT,
  active_invitees   BIGINT,
  total_commission  NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_commission NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_commission
  FROM public.transactions
  WHERE user_id = p_user_id AND type = 'commission' AND status = 'completed';

  RETURN QUERY
    SELECT
      COUNT(*)::BIGINT                                 AS total_invitees,
      COUNT(*) FILTER (WHERE bet_count > 0)::BIGINT    AS active_invitees,
      v_commission                                     AS total_commission
    FROM public.users
    WHERE referred_by = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;

-- ── 5. DEPOSIT & WITHDRAWAL HISTORY TABLES ────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_history (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(18,2) NOT NULL,
  method     TEXT          NOT NULL DEFAULT 'manual',
  order_id   TEXT          UNIQUE,
  status     TEXT          NOT NULL DEFAULT 'pending',
  gateway_ref TEXT         NULL,
  remarks    TEXT          NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_history (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       NUMERIC(18,2) NOT NULL,
  method       TEXT          NOT NULL DEFAULT 'manual',
  order_id     TEXT          UNIQUE,
  account_name TEXT          NULL,
  account_no   TEXT          NULL,
  status       TEXT          NOT NULL DEFAULT 'pending',
  remarks      TEXT          NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dh_user_id ON public.deposit_history    (user_id);
CREATE INDEX IF NOT EXISTS idx_wh_user_id ON public.withdrawal_history (user_id);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dh_updated_at ON public.deposit_history;
CREATE TRIGGER trg_dh_updated_at
  BEFORE UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_wh_updated_at ON public.withdrawal_history;
CREATE TRIGGER trg_wh_updated_at
  BEFORE UPDATE ON public.withdrawal_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger: when deposit approved → credit main_balance + update total_deposit
CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.users
    SET main_balance  = main_balance  + NEW.amount,
        total_deposit = total_deposit + NEW.amount,
        wagering_required = wagering_required + NEW.amount
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposit_approved ON public.deposit_history;
CREATE TRIGGER trg_deposit_approved
  AFTER UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_deposit_approved();

-- Trigger: when withdrawal approved → update total_withdrawal
CREATE OR REPLACE FUNCTION public.fn_on_withdrawal_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
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

-- ── 6. RLS for new tables ─────────────────────────────────────────
ALTER TABLE public.deposit_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own deposits"     ON public.deposit_history;
DROP POLICY IF EXISTS "Users insert own deposits"   ON public.deposit_history;
DROP POLICY IF EXISTS "Service role all deposits"   ON public.deposit_history;
CREATE POLICY "Users read own deposits"   ON public.deposit_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own deposits" ON public.deposit_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role all deposits" ON public.deposit_history FOR ALL    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own withdrawals"     ON public.withdrawal_history;
DROP POLICY IF EXISTS "Users insert own withdrawals"   ON public.withdrawal_history;
DROP POLICY IF EXISTS "Service role all withdrawals"   ON public.withdrawal_history;
CREATE POLICY "Users read own withdrawals"   ON public.withdrawal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own withdrawals" ON public.withdrawal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role all withdrawals" ON public.withdrawal_history FOR ALL    USING (auth.role() = 'service_role');

-- Enable Realtime on history tables (for admin live approval)
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_history;

-- ── 7. pg_cron: reschedule with correct UTC tick ──────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('wingo-tick-a','wingo-tick-b','cleanup-bh','cleanup-gr');

    PERFORM cron.schedule('wingo-tick-a','* * * * *',
      'SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('wingo-tick-b','* * * * *',
      'SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('cleanup-bh','0 3 * * *',
      'DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL ''7 days'';');
    PERFORM cron.schedule('cleanup-gr','0 4 * * *',
      'DELETE FROM public.game_rounds WHERE status=''completed'' AND created_at < NOW() - INTERVAL ''30 days'';');
  END IF;
END $$;

-- ── VERIFY ────────────────────────────────────────────────────────
SELECT game_type, mode, period, status,
       TO_CHAR(ends_at AT TIME ZONE 'UTC', 'HH24:MI:SS') AS ends_utc
FROM public.game_rounds
WHERE status = 'active'
ORDER BY mode;
