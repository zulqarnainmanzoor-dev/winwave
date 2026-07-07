-- ════════════════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE FIX FOR ALL ISSUES
-- 1. Numeric UID (9-10 digits) instead of alphanumeric
-- 2. Past 24h deposits for entire platform (not specific UID)
-- 3. All Members Today Deposit showing correct amounts
-- 4. Commission calculation (3,600 instead of 2,000)
-- 5. VIP level increase rules (62,500 for VIP 0 to VIP 1)
-- 6. Agent invited members deposits showing correctly
-- 7. Direct vs Team invites commission distribution
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: FIX NUMERIC UID SYSTEM (9-10 digits from phone number)
-- Generate 9-10 digit numeric UID from phone number
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_numeric_uid_9digit(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_phone_digits TEXT;
  v_hash TEXT;
  v_numeric_uid TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
  END IF;
  
  -- Extract only digits from phone
  v_phone_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  
  -- If phone has at least 9 digits, use last 9 digits
  IF LENGTH(v_phone_digits) >= 9 THEN
    v_numeric_uid := SUBSTRING(v_phone_digits FROM LENGTH(v_phone_digits) - 8 FOR 9);
  ELSE
    -- Generate from hash of phone
    v_hash := MD5(p_phone);
    v_numeric_uid := '';
    FOR i IN 1..LENGTH(v_hash) LOOP
      IF LENGTH(v_numeric_uid) >= 9 THEN EXIT; END IF;
      IF SUBSTRING(v_hash FROM i FOR 1) ~ '[0-9]' THEN
        v_numeric_uid := v_numeric_uid || SUBSTRING(v_hash FROM i FOR 1);
      END IF;
    END LOOP;
    
    -- Pad to 9 digits if needed
    WHILE LENGTH(v_numeric_uid) < 9 LOOP
      v_numeric_uid := v_numeric_uid || FLOOR(RANDOM() * 10)::TEXT;
    END LOOP;
    
    v_numeric_uid := SUBSTRING(v_numeric_uid FROM 1 FOR 9);
  END IF;
  
  RETURN v_numeric_uid;
END;
$$;

-- Update existing users with 9-digit numeric UID
UPDATE public.users 
SET referral_code = public.generate_numeric_uid_9digit(phone_number)
WHERE referral_code IS NULL OR referral_code ~ '[A-Za-z]';

-- Trigger for new users
CREATE OR REPLACE FUNCTION public.set_numeric_uid_9digit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_numeric_uid_9digit(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_numeric_uid_9digit ON public.users;
CREATE TRIGGER trg_set_numeric_uid_9digit
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_numeric_uid_9digit();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: FIX PAST 24H DEPOSITS FOR ENTIRE PLATFORM
-- Get deposits from last 24 hours for ALL users (not specific UID)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_platform_past_24h_deposits_complete()
RETURNS TABLE(
  total_deposit_count BIGINT,
  total_deposit_amount NUMERIC,
  total_deposit_users BIGINT,
  first_deposit_count BIGINT,
  first_deposit_amount NUMERIC,
  total_bet_amount NUMERIC,
  direct_deposit_amount NUMERIC,
  team_deposit_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
BEGIN
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  RETURN QUERY
  WITH all_deposits AS (
    SELECT 
      dh.id,
      dh.user_id,
      dh.amount,
      dh.created_at,
      u.referred_by
    FROM public.deposit_history dh
    JOIN public.users u ON dh.user_id = u.id
    WHERE dh.status = 'completed'
      AND dh.created_at >= v_24h_start
  ),
  first_deposits AS (
    SELECT 
      dh.user_id,
      dh.amount
    FROM all_deposits dh
    WHERE NOT EXISTS (
      SELECT 1 FROM public.deposit_history dh2
      WHERE dh2.user_id = dh.user_id
        AND dh2.status = 'completed'
        AND dh2.created_at < v_24h_start
    )
  ),
  bets_24h AS (
    SELECT 
      bh.user_id,
      SUM(bh.amount) as bet_amount
    FROM public.betting_history bh
    WHERE bh.status = 'completed'
      AND bh.created_at >= v_24h_start
    GROUP BY bh.user_id
  )
  SELECT
    COUNT(DISTINCT ad.id)::BIGINT as total_deposit_count,
    COALESCE(SUM(ad.amount), 0) as total_deposit_amount,
    COUNT(DISTINCT ad.user_id)::BIGINT as total_deposit_users,
    COUNT(DISTINCT fd.user_id)::BIGINT as first_deposit_count,
    COALESCE(SUM(fd.amount), 0) as first_deposit_amount,
    COALESCE(SUM(b.bet_amount), 0) as total_bet_amount,
    -- Direct deposits (users with no referrer or direct to platform)
    COALESCE(SUM(CASE WHEN ad.referred_by IS NULL THEN ad.amount ELSE 0 END), 0) as direct_deposit_amount,
    -- Team deposits (users with referrer)
    COALESCE(SUM(CASE WHEN ad.referred_by IS NOT NULL THEN ad.amount ELSE 0 END), 0) as team_deposit_amount
  FROM all_deposits ad
  LEFT JOIN first_deposits fd ON ad.user_id = fd.user_id
  LEFT JOIN bets_24h b ON ad.user_id = b.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_past_24h_deposits_complete() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: FIX ALL MEMBERS TODAY DEPOSIT CALCULATION
-- Get today's deposits for all team members (direct + indirect)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_team_today_deposits(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  numeric_uid TEXT,
  phone_number TEXT,
  level INT,
  today_deposit NUMERIC,
  total_deposit NUMERIC,
  today_bets NUMERIC,
  registration_date TIMESTAMPTZ,
  is_direct_member BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_all_team_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
  v_level_map JSONB := '{}'::JSONB;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  -- Build full team hierarchy (7 levels max)
  v_all_team_members := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];
  v_level_map := jsonb_set(v_level_map, ARRAY[p_agent_id::text], '0');

  WHILE v_i < 7 AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    
    WITH next_level AS (
      SELECT id, referred_by
      FROM public.users 
      WHERE referred_by = ANY(v_current_level)
    )
    SELECT 
      ARRAY_AGG(id),
      jsonb_set(v_level_map, ARRAY_AGG(id::text), ARRAY_AGG(v_i::text)::jsonb)
    INTO v_current_level, v_level_map
    FROM next_level;
    
    IF v_current_level IS NOT NULL THEN
      v_all_team_members := v_all_team_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, public.generate_numeric_uid_9digit(u.phone_number)) as numeric_uid,
    u.phone_number,
    COALESCE((v_level_map->>u.id::text)::INT, 0) as level,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposit,
    u.total_deposit,
    COALESCE(SUM(CASE 
      WHEN bh.status = 'completed'
        AND bh.created_at >= v_today_start
        AND bh.created_at < v_today_end
      THEN bh.amount
      ELSE 0
    END), 0) as today_bets,
    u.created_at as registration_date,
    (u.referred_by = p_agent_id) as is_direct_member
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.betting_history bh ON u.id = bh.user_id
  WHERE u.id = ANY(v_all_team_members)
    AND u.id != p_agent_id
  GROUP BY u.id, u.phone_number, u.referral_code, u.total_deposit, u.created_at, u.referred_by, v_level_map
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_today_deposits(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: FIX COMMISSION CALCULATION (0.3% for L0, 0.35% for L1, etc.)
-- Correct commission rates and ensure proper calculation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_deposit_commission(
  p_deposit_amount NUMERIC,
  p_agent_vip_level INT
)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_commission_rate NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Commission rates based on VIP level
  -- L0: 0.3%, L1: 0.35%, L2: 0.375%, L3: 0.4%, L4: 0.425%, L5: 0.45%, L6: 0.5%
  v_commission_rate := CASE
    WHEN p_agent_vip_level >= 6 THEN 0.005   -- 0.5%
    WHEN p_agent_vip_level >= 5 THEN 0.0045  -- 0.45%
    WHEN p_agent_vip_level >= 4 THEN 0.00425 -- 0.425%
    WHEN p_agent_vip_level >= 3 THEN 0.004   -- 0.4%
    WHEN p_agent_vip_level >= 2 THEN 0.00375 -- 0.375%
    WHEN p_agent_vip_level >= 1 THEN 0.0035  -- 0.35%
    ELSE 0.003                                -- 0.3% (L0)
  END;
  
  v_commission := ROUND(p_deposit_amount * v_commission_rate, 2);
  RETURN v_commission;
END;
$$;

-- Update deposit approval trigger with correct commission calculation
CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved_fixed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent_id UUID;
  v_commission NUMERIC;
  v_agent_vip_level INT;
  v_referral_chain UUID[];
  v_current_user_id UUID;
  v_i INT := 0;
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

    -- Build referral chain (up to 6 levels for commission distribution)
    v_referral_chain := ARRAY[NEW.user_id];
    v_current_user_id := NEW.user_id;
    
    WHILE v_i < 6 LOOP
      v_i := v_i + 1;
      SELECT referred_by INTO v_agent_id
      FROM public.users
      WHERE id = v_current_user_id;
      
      IF v_agent_id IS NULL THEN EXIT; END IF;
      
      v_referral_chain := v_referral_chain || v_agent_id;
      v_current_user_id := v_agent_id;
    END LOOP;

    -- Distribute commission through referral chain (skip the depositing user)
    FOR i IN 2..array_length(v_referral_chain, 1) LOOP
      v_agent_id := v_referral_chain[i];
      
      -- Get agent's VIP level
      SELECT vip_level INTO v_agent_vip_level
      FROM public.users
      WHERE id = v_agent_id;
      
      -- Calculate commission for this level (level i-1 in chain)
      v_commission := public.calculate_deposit_commission(NEW.amount, v_agent_vip_level);
      
      -- Apply commission rate reduction for deeper levels
      -- Level 1: 100%, Level 2: 30%, Level 3: 9%, Level 4: 2.7%, Level 5: 0.81%, Level 6: 0.243%
      CASE i-1
        WHEN 1 THEN v_commission := v_commission * 1.0;
        WHEN 2 THEN v_commission := v_commission * 0.3;
        WHEN 3 THEN v_commission := v_commission * 0.09;
        WHEN 4 THEN v_commission := v_commission * 0.027;
        WHEN 5 THEN v_commission := v_commission * 0.0081;
        WHEN 6 THEN v_commission := v_commission * 0.00243;
        ELSE v_commission := 0;
      END CASE;
      
      v_commission := ROUND(v_commission, 2);
      
      IF v_commission > 0 THEN
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
          'Deposit commission from member ' || NEW.user_id::TEXT || ' (Level ' || (i-1) || ')',
          'Member deposit: Rs ' || NEW.amount || ' → Commission: Rs ' || v_commission || ' (Level ' || (i-1) || ')'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_deposit_approved_fixed ON public.deposit_history;
CREATE TRIGGER trg_deposit_approved_fixed
  AFTER UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_deposit_approved_fixed();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: FIX VIP LEVEL INCREASE RULES
-- Update VIP level based on betting requirements
-- VIP 0 to VIP 1: 62,500 total bets (not 125,000 as previously set)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_vip_level_based_on_bets()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_total_bets NUMERIC;
  v_new_vip_level INT;
BEGIN
  -- Get user's total bets
  SELECT COALESCE(total_bets, 0) INTO v_total_bets
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Calculate VIP level based on betting requirements
  -- Corrected requirements: VIP 0 to VIP 1: 62,500
  IF v_total_bets < 62500 THEN
    v_new_vip_level := 0;
  ELSIF v_total_bets < 250000 THEN
    v_new_vip_level := 1;
  ELSIF v_total_bets < 500000 THEN
    v_new_vip_level := 2;
  ELSIF v_total_bets < 1000000 THEN
    v_new_vip_level := 3;
  ELSIF v_total_bets < 5000000 THEN
    v_new_vip_level := 4;
  ELSIF v_total_bets < 10000000 THEN
    v_new_vip_level := 5;
  ELSIF v_total_bets < 50000000 THEN
    v_new_vip_level := 6;
  ELSIF v_total_bets < 100000000 THEN
    v_new_vip_level := 7;
  ELSIF v_total_bets < 500000000 THEN
    v_new_vip_level := 8;
  ELSIF v_total_bets < 1000000000 THEN
    v_new_vip_level := 9;
  ELSE
    v_new_vip_level := 10;
  END IF;
  
  -- Update user's VIP level if changed
  UPDATE public.users
  SET vip_level = v_new_vip_level
  WHERE id = NEW.user_id
    AND (vip_level IS NULL OR vip_level != v_new_vip_level);
  
  RETURN NEW;
END;
$$;

-- Create trigger to update VIP level on bet completion
DROP TRIGGER IF EXISTS trg_update_vip_on_bet ON public.betting_history;
CREATE TRIGGER trg_update_vip_on_bet
  AFTER INSERT OR UPDATE ON public.betting_history
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.update_vip_level_based_on_bets();

-- Update existing users' VIP levels based on current bets
UPDATE public.users u
SET vip_level = CASE
  WHEN COALESCE(total_bets, 0) < 62500 THEN 0
  WHEN COALESCE(total_bets, 0) < 250000 THEN 1
  WHEN COALESCE(total_bets, 0) < 500000 THEN 2
  WHEN COALESCE(total_bets, 0) < 1000000 THEN 3
  WHEN COALESCE(total_bets, 0) < 5000000 THEN 4
  WHEN COALESCE(total_bets, 0) < 10000000 THEN 5
  WHEN COALESCE(total_bets, 0) < 50000000 THEN 6
  WHEN COALESCE(total_bets, 0) < 100000000 THEN 7
  WHEN COALESCE(total_bets, 0) < 500000000 THEN 8
  WHEN COALESCE(total_bets, 0) < 1000000000 THEN 9
  ELSE 10
END
WHERE vip_level IS NULL OR vip_level != CASE
  WHEN COALESCE(total_bets, 0) < 62500 THEN 0
  WHEN COALESCE(total_bets, 0) < 250000 THEN 1
  WHEN COALESCE(total_bets, 0) < 500000 THEN 2
  WHEN COALESCE(total_bets, 0) < 1000000 THEN 3
  WHEN COALESCE(total_bets, 0) < 5000000 THEN 4
  WHEN COALESCE(total_bets, 0) < 10000000 THEN 5
  WHEN COALESCE(total_bets, 0) < 50000000 THEN 6
  WHEN COALESCE(total_bets, 0) < 100000000 THEN 7
  WHEN COALESCE(total_bets, 0) < 500000000 THEN 8
  WHEN COALESCE(total_bets, 0) < 1000000000 THEN 9
  ELSE 10
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: FIX AGENT INVITED MEMBERS DEPOSITS DISPLAY
-- Get agent's invited members with correct deposit data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_invited_members_complete(p_agent_id UUID)
RETURNS TABLE(
  member_id UUID,
  numeric_uid TEXT,
  phone_number TEXT,
  lifetime_deposit NUMERIC,
  today_deposit NUMERIC,
  total_bets NUMERIC,
  vip_level INT,
  registration_date TIMESTAMPTZ,
  last_deposit_date TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, public.generate_numeric_uid_9digit(u.phone_number)) as numeric_uid,
    u.phone_number,
    COALESCE(u.total_deposit, 0) as lifetime_deposit,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposit,
    COALESCE(u.total_bets, 0) as total_bets,
    COALESCE(u.vip_level, 0) as vip_level,
    u.created_at as registration_date,
    MAX(dh.created_at) as last_deposit_date
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed'
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.phone_number, u.referral_code, u.total_deposit, u.total_bets, u.vip_level, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_invited_members_complete(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: FIX DIRECT VS TEAM INVITES COMMISSION DISTRIBUTION
-- Separate functions for direct invites and team invites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_direct_invites_stats(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  total_deposits NUMERIC,
  today_deposits NUMERIC,
  total_commission NUMERIC,
  today_commission NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  RETURN QUERY
  SELECT
    COUNT(DISTINCT u.id)::BIGINT as total_members,
    COALESCE(SUM(u.total_deposit), 0) as total_deposits,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposits,
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' 
        AND t.gateway_ref LIKE 'Deposit commission from member% (Level 1)'
      THEN t.amount 
      ELSE 0 
    END), 0) as total_commission,
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' 
        AND t.gateway_ref LIKE 'Deposit commission from member% (Level 1)'
        AND t.created_at >= v_today_start 
        AND t.created_at < v_today_end 
      THEN t.amount 
      ELSE 0 
    END), 0) as today_commission
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_direct_invites_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_agent_team_invites_stats(p_agent_id UUID)
RETURNS TABLE(
  total_members BIGINT,
  total_deposits NUMERIC,
  today_deposits NUMERIC,
  total_commission NUMERIC,
  today_commission NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_all_team_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_today_end := v_today_start + INTERVAL '1 day';
  
  -- Build team hierarchy (levels 2-7, excluding direct invites)
  v_all_team_members := ARRAY[]::UUID[];
  
  -- Start with direct invites
  SELECT ARRAY_AGG(id) INTO v_current_level
  FROM public.users
  WHERE referred_by = p_agent_id;
  
  IF v_current_level IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Get team members (levels 2+)
  WHILE v_i < 6 AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users
    WHERE referred_by = ANY(v_current_level);
    
    IF v_current_level IS NOT NULL THEN
      v_all_team_members := v_all_team_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT u.id)::BIGINT as total_members,
    COALESCE(SUM(u.total_deposit), 0) as total_deposits,
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
        AND dh.created_at >= v_today_start 
        AND dh.created_at < v_today_end 
      THEN dh.amount 
      ELSE 0 
    END), 0) as today_deposits,
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' 
        AND t.gateway_ref LIKE 'Deposit commission from member% (Level ' || (v_i+1) || ')'
      THEN t.amount 
      ELSE 0 
    END), 0) as total_commission,
    COALESCE(SUM(CASE 
      WHEN t.type = 'commission' 
        AND t.gateway_ref LIKE 'Deposit commission from member% (Level ' || (v_i+1) || ')'
        AND t.created_at >= v_today_start 
        AND t.created_at < v_today_end 
      THEN t.amount 
      ELSE 0 
    END), 0) as today_commission
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id
  LEFT JOIN public.transactions t ON u.id = t.user_id
  WHERE u.id = ANY(v_all_team_members);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_invites_stats(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: UPDATE FRONTEND COMPONENTS TO USE NEW FUNCTIONS
-- Note: Frontend code updates will be done separately
-- ─────────────────────────────────────────────────────────────────────────────

-- Test queries to verify fixes
/*
-- Test numeric UID generation
SELECT phone_number, referral_code, public.generate_numeric_uid_9digit(phone_number) as new_numeric_uid
FROM public.users LIMIT 10;

-- Test platform past 24h deposits
SELECT * FROM public.get_platform_past_24h_deposits_complete();

-- Test agent team today deposits
SELECT * FROM public.get_agent_team_today_deposits('AGENT_UUID_HERE');

-- Test commission calculation
SELECT public.calculate_deposit_commission(300, 0) as l0_commission,
       public.calculate_deposit_commission(300, 1) as l1_commission,
       public.calculate_deposit_commission(300, 6) as l6_commission;

-- Test VIP level update
SELECT id, phone_number, total_bets, vip_level,
  CASE
    WHEN COALESCE(total_bets, 0) < 62500 THEN 0
    WHEN COALESCE(total_bets, 0) < 250000 THEN 1
    WHEN COALESCE(total_bets, 0) < 500000 THEN 2
    WHEN COALESCE(total_bets, 0) < 1000000 THEN 3
    WHEN COALESCE(total_bets, 0) < 5000000 THEN 4
    WHEN COALESCE(total_bets, 0) < 10000000 THEN 5
    WHEN COALESCE(total_bets, 0) < 50000000 THEN 6
    WHEN COALESCE(total_bets, 0) < 100000000 THEN 7
    WHEN COALESCE(total_bets, 0) < 500000000 THEN 8
    WHEN COALESCE(total_bets, 0) < 1000000000 THEN 9
    ELSE 10
  END as calculated_vip_level
FROM public.users LIMIT 10;

-- Test agent invited members
SELECT * FROM public.get_agent_invited_members_complete('AGENT_UUID_HERE');

-- Test direct vs team invites stats
SELECT * FROM public.get_agent_direct_invites_stats('AGENT_UUID_HERE');
SELECT * FROM public.get_agent_team_invites_stats('AGENT_UUID_HERE');
*/

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF COMPREHENSIVE FIX
-- ════════════════════════════════════════════════════════════════════════════════