-- ================================================================
-- vip_system.sql
-- VIP Leveling & Reward System
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 0. Schema additions ──────────────────────────────────────────

-- transaction_history: unified ledger for all balance credits
CREATE TABLE IF NOT EXISTS public.transaction_history (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(18,2) NOT NULL,
  label       TEXT          NOT NULL,   -- e.g. 'VIP Level up reward', 'VIP Weekly reward'
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_th_user_id    ON public.transaction_history (user_id);
CREATE INDEX IF NOT EXISTS idx_th_created_at ON public.transaction_history (created_at DESC);

ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transactions"   ON public.transaction_history;
DROP POLICY IF EXISTS "Service role all transactions" ON public.transaction_history;
CREATE POLICY "Users read own transactions"
  ON public.transaction_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role all transactions"
  ON public.transaction_history FOR ALL USING (auth.role() = 'service_role');

-- Add VIP tracking columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vip_level              INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bets             NUMERIC(18,2) NOT NULL DEFAULT 0,  -- cumulative wagered (EXP source)
  ADD COLUMN IF NOT EXISTS vip_levelup_claimed    INTEGER[]     NOT NULL DEFAULT '{}'; -- levels already claimed

-- ── 1. VIP tier thresholds (mirrors UserContext.tsx VIP_TIERS) ───
-- Stored as a helper function so SQL logic stays in sync with the frontend.
CREATE OR REPLACE FUNCTION public.fn_vip_level_from_wager(p_wager NUMERIC)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_wager <        125000 THEN 0
    WHEN p_wager <        250000 THEN 1
    WHEN p_wager <        500000 THEN 2
    WHEN p_wager <       1000000 THEN 3
    WHEN p_wager <       5000000 THEN 4
    WHEN p_wager <      10000000 THEN 5
    WHEN p_wager <      50000000 THEN 6
    WHEN p_wager <     100000000 THEN 7
    WHEN p_wager <     500000000 THEN 8
    WHEN p_wager <    1000000000 THEN 9
    ELSE 10
  END;
$$;

-- Level-up reward amounts (mirrors VIP_TIERS.levelUpReward)
CREATE OR REPLACE FUNCTION public.fn_vip_levelup_reward(p_level INTEGER)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 1  THEN 150
    WHEN 2  THEN 150
    WHEN 3  THEN 300
    WHEN 4  THEN 3000
    WHEN 5  THEN 30000
    WHEN 6  THEN 90000
    WHEN 7  THEN 180000
    WHEN 8  THEN 1800000
    WHEN 9  THEN 9000000
    WHEN 10 THEN 18000000
    ELSE 0
  END;
$$;

-- Weekly reward amounts
CREATE OR REPLACE FUNCTION public.fn_vip_weekly_reward(p_level INTEGER)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 1  THEN 10
    WHEN 2  THEN 20
    WHEN 3  THEN 30
    WHEN 4  THEN 100
    WHEN 5  THEN 300
    WHEN 6  THEN 1000
    WHEN 7  THEN 3000
    WHEN 8  THEN 10000
    WHEN 9  THEN 30000
    WHEN 10 THEN 50000
    ELSE 0
  END;
$$;

-- Monthly reward amounts
CREATE OR REPLACE FUNCTION public.fn_vip_monthly_reward(p_level INTEGER)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 1  THEN 150
    WHEN 2  THEN 350
    WHEN 3  THEN 750
    WHEN 4  THEN 7500
    WHEN 5  THEN 75000
    WHEN 6  THEN 150000
    WHEN 7  THEN 300000
    WHEN 8  THEN 750000
    WHEN 9  THEN 4500000
    WHEN 10 THEN 15000000
    ELSE 0
  END;
$$;

-- ── 2. EXP Gain trigger ──────────────────────────────────────────
-- Fires on every INSERT into betting_history (WinGo bets).
-- Adds bet_amount as EXP to total_bets, recomputes vip_level.
-- If level increased, does NOT auto-grant reward — user must claim via RPC.
CREATE OR REPLACE FUNCTION public.fn_vip_add_exp()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_new_wager NUMERIC;
BEGIN
  -- Lock user row, read current state
  SELECT vip_level, total_bets + NEW.bet_amount
  INTO   v_old_level, v_new_wager
  FROM   public.users
  WHERE  id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_level := public.fn_vip_level_from_wager(v_new_wager);

  -- Update EXP and level atomically
  UPDATE public.users
  SET    total_bets = v_new_wager,
         vip_level  = v_new_level
  WHERE  id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_add_exp ON public.betting_history;
CREATE TRIGGER trg_vip_add_exp
  AFTER INSERT ON public.betting_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_vip_add_exp();

-- ── 3. RPC: claim_vip_levelup_reward ────────────────────────────
-- Called by the frontend "Receive" button.
-- Idempotent: each level can only be claimed once per user.
CREATE OR REPLACE FUNCTION public.claim_vip_levelup_reward(
  p_user_id UUID,
  p_level   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_level INTEGER;
  v_claimed       INTEGER[];
  v_reward        NUMERIC;
BEGIN
  SELECT vip_level, vip_levelup_claimed
  INTO   v_current_level, v_claimed
  FROM   public.users
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_current_level < p_level THEN
    RETURN jsonb_build_object('success', false, 'error', 'Level not reached');
  END IF;

  IF p_level = ANY(v_claimed) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  v_reward := public.fn_vip_levelup_reward(p_level);

  IF v_reward <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reward for this level');
  END IF;

  -- Credit balance
  UPDATE public.users
  SET    main_balance        = main_balance + v_reward,
         vip_levelup_claimed = vip_levelup_claimed || ARRAY[p_level]
  WHERE  id = p_user_id;

  -- Audit trail
  INSERT INTO public.transaction_history (user_id, amount, label)
  VALUES (p_user_id, v_reward, 'VIP Level up reward VIP' || p_level);

  RETURN jsonb_build_object('success', true, 'credited', v_reward);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vip_levelup_reward(UUID, INTEGER) TO authenticated;

-- ── 4. Internal helper: fn_grant_vip_reward ──────────────────────
-- Used by cron jobs to credit weekly/monthly rewards.
CREATE OR REPLACE FUNCTION public.fn_grant_vip_reward(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_label   TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  UPDATE public.users
  SET    main_balance = main_balance + p_amount
  WHERE  id = p_user_id;

  INSERT INTO public.transaction_history (user_id, amount, label)
  VALUES (p_user_id, p_amount, p_label);
END;
$$;

-- ── 5. RPC: distribute_weekly_vip_rewards ────────────────────────
-- Runs every Monday via pg_cron. Grants weekly reward to all VIP ≥ 1 users.
CREATE OR REPLACE FUNCTION public.distribute_weekly_vip_rewards()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, vip_level
    FROM   public.users
    WHERE  vip_level >= 1
  LOOP
    PERFORM public.fn_grant_vip_reward(
      r.id,
      public.fn_vip_weekly_reward(r.vip_level),
      'VIP Weekly reward VIP' || r.vip_level
    );
  END LOOP;
END;
$$;

-- ── 6. RPC: distribute_monthly_vip_rewards ───────────────────────
-- Runs on the 1st of every month via pg_cron.
CREATE OR REPLACE FUNCTION public.distribute_monthly_vip_rewards()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, vip_level
    FROM   public.users
    WHERE  vip_level >= 1
  LOOP
    PERFORM public.fn_grant_vip_reward(
      r.id,
      public.fn_vip_monthly_reward(r.vip_level),
      'VIP Monthly reward VIP' || r.vip_level
    );
  END LOOP;
END;
$$;

-- ── 7. pg_cron jobs ──────────────────────────────────────────────
-- Requires pg_cron extension enabled in Supabase (Database → Extensions).

SELECT cron.schedule(
  'vip-weekly-rewards',
  '0 9 * * 1',   -- Every Monday at 09:00 UTC
  $$SELECT public.distribute_weekly_vip_rewards();$$
);

SELECT cron.schedule(
  'vip-monthly-rewards',
  '0 9 1 * *',   -- 1st of every month at 09:00 UTC
  $$SELECT public.distribute_monthly_vip_rewards();$$
);

-- ── 8. Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.distribute_weekly_vip_rewards()  TO service_role;
GRANT EXECUTE ON FUNCTION public.distribute_monthly_vip_rewards() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_grant_vip_reward(UUID, NUMERIC, TEXT) TO service_role;
