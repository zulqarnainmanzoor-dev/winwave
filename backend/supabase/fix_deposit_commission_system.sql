-- ════════════════════════════════════════════════════════════════════════════════
-- FIX: DEPOSIT COMMISSION SYSTEM
-- When a member deposits, automatically credit agent with commission
-- ════════════════════════════════════════════════════════════════════════════════

-- STEP 1: Update the deposit approval trigger to also credit agent commission
-- This replaces the existing fn_on_deposit_approved function
DROP TRIGGER IF EXISTS trg_deposit_approved ON public.deposit_history;
DROP FUNCTION IF EXISTS public.fn_on_deposit_approved();

CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id UUID;
  v_commission NUMERIC;
  v_agent_vip_level INT;
  v_commission_rate NUMERIC := 0.006; -- 0.6% default (Level 1)
BEGIN
  -- Only process when deposit transitions to completed
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    
    -- Credit user's main balance + bonus
    UPDATE public.users
    SET main_balance      = main_balance      + NEW.amount,
        total_deposit     = total_deposit     + NEW.amount,
        wagering_required = wagering_required + NEW.amount,
        total_winning     = total_winning     + (NEW.amount * 0.02)  -- 2% initial bonus
    WHERE id = NEW.user_id;

    -- CRITICAL: Credit agent commission
    -- Get the agent (referrer) for this user
    SELECT referred_by INTO v_agent_id
    FROM public.users
    WHERE id = NEW.user_id;

    IF v_agent_id IS NOT NULL THEN
      -- Get agent's VIP level for commission rate calculation
      SELECT vip_level INTO v_agent_vip_level
      FROM public.users
      WHERE id = v_agent_id;

      -- Calculate commission based on VIP level
      -- L0: 0.3%, L1: 0.35%, L2: 0.375%, L3: 0.4%, L4: 0.425%, L5: 0.45%, L6: 0.5%
      v_commission_rate := CASE
        WHEN v_agent_vip_level >= 6 THEN 0.005   -- 0.5%
        WHEN v_agent_vip_level >= 5 THEN 0.0045  -- 0.45%
        WHEN v_agent_vip_level >= 4 THEN 0.00425 -- 0.425%
        WHEN v_agent_vip_level >= 3 THEN 0.004   -- 0.4%
        WHEN v_agent_vip_level >= 2 THEN 0.00375 -- 0.375%
        WHEN v_agent_vip_level >= 1 THEN 0.0035  -- 0.35%
        ELSE 0.003                                -- 0.3% (L0)
      END;

      v_commission := ROUND(NEW.amount * v_commission_rate, 2);

      -- Credit agent's main balance with commission
      UPDATE public.users
      SET main_balance = main_balance + v_commission
      WHERE id = v_agent_id;

      -- Record commission transaction for agent
      INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        status,
        gateway_ref,
        remarks
      ) VALUES (
        v_agent_id,
        'commission',
        v_commission,
        'completed',
        'Deposit commission from member ' || NEW.user_id::TEXT,
        'Member deposit: Rs ' || NEW.amount || ' → Commission: Rs ' || v_commission
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_deposit_approved
  AFTER UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_deposit_approved();

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create RPC function to get agent's member deposits (for dashboard)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_agent_member_deposits(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  member_phone TEXT,
  member_name TEXT,
  lifetime_deposit NUMERIC,
  today_deposit NUMERIC,
  lifetime_withdrawal NUMERIC,
  today_withdrawal NUMERIC,
  total_bets BIGINT,
  total_commission NUMERIC,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.phone_number,
    COALESCE(u.phone_number, 'User ' || u.id::TEXT),
    COALESCE(u.total_deposit, 0),
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND DATE(dh.created_at AT TIME ZONE 'UTC') = CURRENT_DATE AT TIME ZONE 'UTC'
      THEN dh.amount 
      ELSE 0 
    END), 0),
    COALESCE(u.total_withdrawal, 0),
    COALESCE(SUM(CASE 
      WHEN wh.status = 'completed' 
        AND DATE(wh.created_at AT TIME ZONE 'UTC') = CURRENT_DATE AT TIME ZONE 'UTC'
      THEN wh.amount 
      ELSE 0 
    END), 0),
    COUNT(DISTINCT bh.id),
    COALESCE(SUM(CASE WHEN t.type = 'commission' THEN t.amount ELSE 0 END), 0),
    u.created_at
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.withdrawal_history wh ON u.id = wh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id AND t.type = 'commission'
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.phone_number, u.total_deposit, u.total_withdrawal, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_member_deposits(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create RPC function to get agent's total commission earned
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_agent_total_commission(p_agent_id UUID)
RETURNS TABLE(
  total_commission NUMERIC,
  today_commission NUMERIC,
  member_count BIGINT,
  active_members BIGINT,
  total_member_deposits NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'commission' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' 
        AND DATE(t.created_at AT TIME ZONE 'UTC') = CURRENT_DATE AT TIME ZONE 'UTC'
      THEN t.amount 
      ELSE 0 
    END), 0),
    COUNT(DISTINCT u.id),
    COUNT(DISTINCT CASE WHEN u.total_bets > 0 THEN u.id END),
    COALESCE(SUM(u.total_deposit), 0)
  FROM public.users u
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_total_commission(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 4: Backfill commission for existing deposits (one-time fix)
-- This credits agents for deposits that were already completed but commission wasn't added
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_agent_id UUID;
  v_commission NUMERIC;
  v_agent_vip_level INT;
  v_commission_rate NUMERIC;
  v_existing_commission NUMERIC;
BEGIN
  -- Find all completed deposits where agent commission wasn't recorded
  FOR r IN
    SELECT dh.id, dh.user_id, dh.amount, u.referred_by
    FROM public.deposit_history dh
    JOIN public.users u ON dh.user_id = u.id
    WHERE dh.status = 'completed'
      AND u.referred_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.user_id = u.referred_by
          AND t.type = 'commission'
          AND t.gateway_ref LIKE 'Deposit commission from member ' || dh.user_id::TEXT || '%'
      )
  LOOP
    v_agent_id := r.referred_by;
    
    -- Get agent's VIP level
    SELECT vip_level INTO v_agent_vip_level
    FROM public.users
    WHERE id = v_agent_id;

    -- Calculate commission rate based on VIP level
    v_commission_rate := CASE
      WHEN v_agent_vip_level >= 6 THEN 0.005
      WHEN v_agent_vip_level >= 5 THEN 0.0045
      WHEN v_agent_vip_level >= 4 THEN 0.00425
      WHEN v_agent_vip_level >= 3 THEN 0.004
      WHEN v_agent_vip_level >= 2 THEN 0.00375
      WHEN v_agent_vip_level >= 1 THEN 0.0035
      ELSE 0.003
    END;

    v_commission := ROUND(r.amount * v_commission_rate, 2);

    -- Check if commission was already credited to agent balance
    SELECT COALESCE(SUM(amount), 0) INTO v_existing_commission
    FROM public.transactions
    WHERE user_id = v_agent_id
      AND type = 'commission'
      AND gateway_ref LIKE 'Deposit commission from member ' || r.user_id::TEXT || '%';

    -- Only add if not already recorded
    IF v_existing_commission = 0 THEN
      -- Credit agent's balance
      UPDATE public.users
      SET main_balance = main_balance + v_commission
      WHERE id = v_agent_id;

      -- Record transaction
      INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        status,
        gateway_ref,
        remarks
      ) VALUES (
        v_agent_id,
        'commission',
        v_commission,
        'completed',
        'Deposit commission from member ' || r.user_id::TEXT,
        'Backfill: Member deposit Rs ' || r.amount || ' → Commission Rs ' || v_commission
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: Commission credited for existing deposits';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Check agent's total commission earned
-- SELECT * FROM public.get_agent_total_commission('AGENT_UUID_HERE');

-- Check agent's member deposits
-- SELECT * FROM public.get_agent_member_deposits('AGENT_UUID_HERE');

-- Check if commission was credited to agent
-- SELECT user_id, type, amount, gateway_ref, created_at 
-- FROM public.transactions 
-- WHERE type = 'commission' 
-- ORDER BY created_at DESC LIMIT 10;
