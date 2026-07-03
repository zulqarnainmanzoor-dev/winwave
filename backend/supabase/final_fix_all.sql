-- ================================================================
-- final_fix_all.sql
-- Run ONCE in Supabase SQL Editor (postgres / service_role)
-- Fixes: referral columns · deposit_history · withdrawal_history
--        · handle_new_user trigger · RLS · pg_cron game tick
-- ================================================================

-- ── 1. USERS TABLE: ensure all required columns exist ────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invite_code       TEXT,
  ADD COLUMN IF NOT EXISTS referred_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_deposit     NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawal  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bet_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_win_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bet_count         INT           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rtp_phase         TEXT          NOT NULL DEFAULT 'honeymoon';

-- Unique index on invite_code (nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS users_invite_code_unique
  ON public.users (invite_code)
  WHERE invite_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by  ON public.users (referred_by);

-- ── 2. DEPOSIT HISTORY TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_history (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(18,2) NOT NULL,
  method      TEXT          NOT NULL DEFAULT 'manual',
  order_id    TEXT          UNIQUE,
  status      TEXT          NOT NULL DEFAULT 'pending',
  gateway_ref TEXT,
  remarks     TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dh_user_id    ON public.deposit_history (user_id);
CREATE INDEX IF NOT EXISTS idx_dh_created_at ON public.deposit_history (created_at DESC);

-- ── 3. WITHDRAWAL HISTORY TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_history (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       NUMERIC(18,2) NOT NULL,
  method       TEXT          NOT NULL DEFAULT 'manual',
  order_id     TEXT          UNIQUE,
  account_name TEXT,
  account_no   TEXT,
  status       TEXT          NOT NULL DEFAULT 'pending',
  remarks      TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wh_user_id    ON public.withdrawal_history (user_id);
CREATE INDEX IF NOT EXISTS idx_wh_created_at ON public.withdrawal_history (created_at DESC);

-- ── 4. AUTO updated_at TRIGGER ───────────────────────────────────
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

-- ── 5. DEPOSIT APPROVED → credit balance + total_deposit ─────────
CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.users
    SET main_balance      = main_balance      + NEW.amount,
        total_deposit     = total_deposit     + NEW.amount,
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

-- ── 6. WITHDRAWAL APPROVED → update total_withdrawal ─────────────
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

-- ── 7. HANDLE NEW USER TRIGGER (referral fix) ────────────────────
-- Reads inviter_code from auth metadata → resolves to referred_by UUID
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone        TEXT;
  v_inviter_code TEXT;
  v_referred_by  UUID := NULL;
  v_invite_code  TEXT;
  v_taken        BOOLEAN;
BEGIN
  v_phone        := COALESCE(NEW.raw_user_meta_data->>'phone_number', '');
  v_inviter_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'inviter_code', '')), '');

  -- Resolve inviter_code → referrer UUID
  IF v_inviter_code IS NOT NULL THEN
    SELECT id INTO v_referred_by
    FROM public.users
    WHERE invite_code = UPPER(v_inviter_code)
    LIMIT 1;
  END IF;

  -- Generate unique 6-char alphanumeric invite_code
  LOOP
    v_invite_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE invite_code = v_invite_code) INTO v_taken;
    EXIT WHEN NOT v_taken;
  END LOOP;

  INSERT INTO public.users (
    id, phone_number, invite_code, inviter_code, referred_by,
    vip_level, total_bets, is_agent,
    main_balance, game_balance,
    wagering_required, wagering_completed,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    NULLIF(v_phone, ''),
    v_invite_code,
    v_inviter_code,
    v_referred_by,
    0, 0, FALSE,
    0, 0, 0, 0,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 8. RPC: get_referral_stats ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS TABLE(
  total_invitees   BIGINT,
  active_invitees  BIGINT,
  total_commission NUMERIC
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
      COUNT(*)::BIGINT                              AS total_invitees,
      COUNT(*) FILTER (WHERE bet_count > 0)::BIGINT AS active_invitees,
      v_commission                                  AS total_commission
    FROM public.users
    WHERE referred_by = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;

-- ── 9. RPC: get_user_rtp_phase ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_rtp_phase(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phase TEXT;
BEGIN
  SELECT rtp_phase INTO v_phase FROM public.users WHERE id = p_user_id;
  RETURN COALESCE(v_phase, 'normal');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rtp_phase(UUID) TO authenticated;

-- ── 10. RLS for history tables ────────────────────────────────────
ALTER TABLE public.deposit_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dh_select_own"      ON public.deposit_history;
DROP POLICY IF EXISTS "dh_insert_own"      ON public.deposit_history;
DROP POLICY IF EXISTS "dh_service_all"     ON public.deposit_history;
CREATE POLICY "dh_select_own"  ON public.deposit_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dh_insert_own"  ON public.deposit_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dh_service_all" ON public.deposit_history FOR ALL    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wh_select_own"      ON public.withdrawal_history;
DROP POLICY IF EXISTS "wh_insert_own"      ON public.withdrawal_history;
DROP POLICY IF EXISTS "wh_service_all"     ON public.withdrawal_history;
CREATE POLICY "wh_select_own"  ON public.withdrawal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wh_insert_own"  ON public.withdrawal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wh_service_all" ON public.withdrawal_history FOR ALL    USING (auth.role() = 'service_role');

-- ── 11. Realtime for admin live approval ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'deposit_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_history;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'withdrawal_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_history;
  END IF;
END $$;

-- ── 12. COMMISSION ENGINE ─────────────────────────────────────────
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
          'Bet commission from ' || NEW.user_id::TEXT)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_agent_commission ON public.betting_history;
CREATE TRIGGER trg_credit_agent_commission
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_credit_agent_commission();

-- ── 13. RTP PHASE UPDATE TRIGGER ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_rtp_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposit   NUMERIC;
  v_win       NUMERIC;
  v_bet_count INT;
BEGIN
  SELECT total_deposit, total_win_amount, bet_count
  INTO   v_deposit, v_win, v_bet_count
  FROM   public.users WHERE id = NEW.user_id;

  UPDATE public.users
  SET rtp_phase        = CASE
                           WHEN v_bet_count <= 20 OR v_win < v_deposit * 0.6 THEN 'honeymoon'
                           WHEN v_win < v_deposit                             THEN 'normal'
                           ELSE                                                    'controlled_loss'
                         END,
      total_bet_amount = total_bet_amount + NEW.amount,
      bet_count        = bet_count + 1,
      total_win_amount = total_win_amount + COALESCE(NEW.win_amount, 0)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rtp_phase ON public.betting_history;
CREATE TRIGGER trg_update_rtp_phase
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_rtp_phase();

-- ── 14. pg_cron: 24/7 game tick (enable pg_cron extension first) ─
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('wingo-tick-a','wingo-tick-b','cleanup-bh','cleanup-gr');

    PERFORM cron.schedule('wingo-tick-a', '* * * * *',
      'SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('wingo-tick-b', '* * * * *',
      'SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('cleanup-bh', '0 3 * * *',
      'DELETE FROM public.betting_history WHERE created_at < NOW() - INTERVAL ''7 days'';');
    PERFORM cron.schedule('cleanup-gr', '0 4 * * *',
      'DELETE FROM public.game_rounds WHERE status=''completed'' AND created_at < NOW() - INTERVAL ''30 days'';');
  END IF;
END $$;

-- Seed active rounds immediately
SELECT public.fn_tick_game_rounds();

-- ── VERIFY ────────────────────────────────────────────────────────
SELECT 'deposit_history'    AS tbl, COUNT(*) FROM public.deposit_history
UNION ALL
SELECT 'withdrawal_history' AS tbl, COUNT(*) FROM public.withdrawal_history
UNION ALL
SELECT 'active_rounds'      AS tbl, COUNT(*) FROM public.game_rounds WHERE status='active';
