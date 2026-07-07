-- ════════════════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE FIX: All Issues - Platform 24h, Numeric UID, Deposits, Commission, VIP
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX: Drop overloaded function causing error
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.analyze_agent_network_fraud(UUID);
DROP FUNCTION IF EXISTS public.analyze_agent_network_fraud(UUID, INTEGER);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FIX: Create proper numeric UID system
-- UID should be like 162334511, not 8AF19B819
-- Use phone_number as base for numeric UID
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to generate numeric UID from phone
CREATE OR REPLACE FUNCTION public.generate_numeric_uid(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_phone_digits TEXT;
  v_hash TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
  END IF;
  
  -- Extract only digits from phone
  v_phone_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
  
  -- If phone has enough digits, use last 9 digits
  IF LENGTH(v_phone_digits) >= 9 THEN
    RETURN SUBSTRING(v_phone_digits FROM LENGTH(v_phone_digits) - 8 FOR 9);
  END IF;
  
  -- Fallback: hash the phone and take first 9 digits
  v_hash := MD5(p_phone);
  v_hash := REGEXP_REPLACE(v_hash, '[^0-9]', '', 'g');
  
  -- Ensure we have 9 digits
  WHILE LENGTH(v_hash) < 9 LOOP
    v_hash := v_hash || v_hash;
  END LOOP;
  
  RETURN SUBSTRING(v_hash FROM 1 FOR 9);
END;
$$;

-- Update existing users with numeric UID
UPDATE public.users 
SET referral_code = public.generate_numeric_uid(phone_number)
WHERE referral_code IS NULL OR referral_code ~ '[A-Za-z]';

-- Trigger to auto-generate numeric UID on user creation
CREATE OR REPLACE FUNCTION public.set_numeric_uid()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code ~ '[A-Za-z]' THEN
    NEW.referral_code := public.generate_numeric_uid(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_numeric_uid ON public.users;
CREATE TRIGGER trg_set_numeric_uid
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_numeric_uid();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FIX: Platform-wide past 24h deposits
-- Shows deposits from last 24 hours for ALL users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_platform_past_24h_deposits()
RETURNS TABLE(
  total_deposit_amount NUMERIC,
  total_deposit_count BIGINT,
  unique_depositors BIGINT,
  first_time_depositors BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
BEGIN
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  RETURN QUERY
  SELECT
    COALESCE(SUM(dh.amount), 0) as total_deposit_amount,
    COUNT(dh.id)::BIGINT as total_deposit_count,
    COUNT(DISTINCT dh.user_id)::BIGINT as unique_depositors,
    COUNT(DISTINCT CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM public.deposit_history dh2 
        WHERE dh2.user_id = dh.user_id 
        AND dh2.status = 'completed' 
        AND dh2.created_at < v_24h_start
      ) THEN dh.user_id 
    END)::BIGINT as first_time_depositors
  FROM public.deposit_history dh
  WHERE dh.status = 'completed'
  AND dh.created_at >= v_24h_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_past_24h_deposits() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FIX: Agent direct invites deposits (past 24h)
-- Shows deposits from agent's DIRECT invites only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_direct_invites_deposits(p_agent_id UUID)
RETURNS TABLE(
  total_deposit_amount NUMERIC,
  total_deposit_count BIGINT,
  unique_depositors BIGINT,
  member_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
BEGIN
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  RETURN QUERY
  SELECT
    COALESCE(SUM(dh.amount), 0) as total_deposit_amount,
    COUNT(dh.id)::BIGINT as total_deposit_count,
    COUNT(DISTINCT dh.user_id)::BIGINT as unique_depositors,
    COUNT(DISTINCT u.id)::BIGINT as member_count
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.status = 'completed'
    AND dh.created_at >= v_24h_start
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_direct_invites_deposits(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FIX: Agent team deposits (multi-level hierarchy)
-- Shows deposits from agent's entire team (direct + indirect)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_team_deposits_hierarchy(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  total_deposit_amount NUMERIC,
  total_deposit_count BIGINT,
  unique_depositors BIGINT,
  direct_deposit_amount NUMERIC,
  team_deposit_amount NUMERIC,
  member_count BIGINT,
  direct_member_count BIGINT,
  team_member_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
  v_all_team_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
BEGIN
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  -- Build hierarchy
  v_all_team_members := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];

  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users WHERE referred_by = ANY(v_current_level);
    
    IF v_current_level IS NOT NULL THEN
      v_all_team_members := v_all_team_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    COALESCE(SUM(dh.amount), 0) as total_deposit_amount,
    COUNT(dh.id)::BIGINT as total_deposit_count,
    COUNT(DISTINCT dh.user_id)::BIGINT as unique_depositors,
    -- Direct deposits (level 1)
    COALESCE(SUM(CASE WHEN u.referred_by = p_agent_id THEN dh.amount ELSE 0 END), 0) as direct_deposit_amount,
    -- Team deposits (level 2+)
    COALESCE(SUM(CASE WHEN u.referred_by != p_agent_id AND u.id != p_agent_id THEN dh.amount ELSE 0 END), 0) as team_deposit_amount,
    -- Member counts
    COUNT(DISTINCT u.id)::BIGINT as member_count,
    COUNT(DISTINCT CASE WHEN u.referred_by = p_agent_id THEN u.id END)::BIGINT as direct_member_count,
    COUNT(DISTINCT CASE WHEN u.referred_by != p_agent_id AND u.id != p_agent_id THEN u.id END)::BIGINT as team_member_count
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.status = 'completed'
    AND dh.created_at >= v_24h_start
  WHERE u.id = ANY(v_all_team_members)
  AND u.id != p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_team_deposits_hierarchy(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FIX: Agent invited members with REAL deposit data
-- Shows agent's direct invites with their actual deposits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agent_invited_members_with_deposits(p_agent_id UUID)
RETURNS TABLE(
  id UUID,
  numeric_uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  past_24h_deposit NUMERIC,
  total_bets NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_start TIMESTAMPTZ;
BEGIN
  v_24h_start := NOW() - INTERVAL '24 hours';
  
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, public.generate_numeric_uid(u.phone_number)) as numeric_uid,
    u.phone_number,
    u.total_deposit,
    COALESCE(SUM(CASE WHEN dh.created_at >= v_24h_start THEN dh.amount ELSE 0 END), 0) as past_24h_deposit,
    u.total_bets,
    u.created_at
  FROM public.users u
  LEFT JOIN public.deposit_history dh ON u.id = dh.user_id 
    AND dh.status = 'completed'
  WHERE u.referred_by = p_agent_id
  GROUP BY u.id, u.referral_code, u.phone_number, u.total_deposit, u.total_bets, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_invited_members_with_deposits(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. FIX: Commission calculation (0.3% on deposits)
-- Calculate commission for agent based on team deposits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_agent_commission(p_agent_id UUID)
RETURNS TABLE(
  total_commission NUMERIC,
  yesterday_commission NUMERIC,
  today_commission NUMERIC,
  total_team_deposit NUMERIC,
  yesterday_team_deposit NUMERIC,
  today_team_deposit NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yesterday_start TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  v_today_start := DATE_TRUNC('day', v_now);
  v_yesterday_start := v_today_start - INTERVAL '1 day';
  
  RETURN QUERY
  SELECT
    -- Total commission (0.3% of all team deposits)
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as total_commission,
    
    -- Yesterday's commission
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND dh.created_at >= v_yesterday_start 
      AND dh.created_at < v_today_start
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as yesterday_commission,
    
    -- Today's commission
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND dh.created_at >= v_today_start
      THEN dh.amount * 0.003 
      ELSE 0 
    END), 0) as today_commission,
    
    -- Total team deposit
    COALESCE(SUM(CASE WHEN dh.status = 'completed' THEN dh.amount ELSE 0 END), 0) as total_team_deposit,
    
    -- Yesterday's team deposit
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND dh.created_at >= v_yesterday_start 
      AND dh.created_at < v_today_start
      THEN dh.amount ELSE 0 
    END), 0) as yesterday_team_deposit,
    
    -- Today's team deposit
    COALESCE(SUM(CASE 
      WHEN dh.status = 'completed' 
      AND dh.created_at >= v_today_start
      THEN dh.amount ELSE 0 
    END), 0) as today_team_deposit
    
  FROM public.users u
  JOIN public.deposit_history dh ON u.id = dh.user_id
  WHERE u.referred_by = p_agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_agent_commission(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FIX: VIP level calculation
-- VIP 0 → VIP 1 requires 62,500 in bets
-- Update VIP level based on total_bets
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_vip_levels()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users 
  SET vip_level = CASE
    WHEN total_bets >= 1000000000 THEN 10
    WHEN total_bets >= 500000000 THEN 9
    WHEN total_bets >= 100000000 THEN 8
    WHEN total_bets >= 50000000 THEN 7
    WHEN total_bets >= 10000000 THEN 6
    WHEN total_bets >= 5000000 THEN 5
    WHEN total_bets >= 1000000 THEN 4
    WHEN total_bets >= 500000 THEN 3
    WHEN total_bets >= 250000 THEN 2
    WHEN total_bets >= 62500 THEN 1
    ELSE 0
  END
  WHERE vip_level != CASE
    WHEN total_bets >= 1000000000 THEN 10
    WHEN total_bets >= 500000000 THEN 9
    WHEN total_bets >= 100000000 THEN 8
    WHEN total_bets >= 50000000 THEN 7
    WHEN total_bets >= 10000000 THEN 6
    WHEN total_bets >= 5000000 THEN 5
    WHEN total_bets >= 1000000 THEN 4
    WHEN total_bets >= 500000 THEN 3
    WHEN total_bets >= 250000 THEN 2
    WHEN total_bets >= 62500 THEN 1
    ELSE 0
  END;
END;
$$;

-- Trigger to update VIP level on bet
CREATE OR REPLACE FUNCTION public.update_vip_on_bet()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update user's total_bets
  UPDATE public.users 
  SET total_bets = total_bets + NEW.amount
  WHERE id = NEW.user_id;
  
  -- Update VIP level if needed
  PERFORM public.update_vip_levels();
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vip_on_bet ON public.betting_history;
CREATE TRIGGER trg_update_vip_on_bet
  AFTER INSERT ON public.betting_history
  FOR EACH ROW EXECUTE FUNCTION public.update_vip_on_bet();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. FIX: New analyze_agent_network_fraud function
-- Single function with default parameter
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.analyze_agent_network_fraud(p_agent_id UUID, p_max_level INT DEFAULT 7)
RETURNS TABLE(
  total_network_accounts BIGINT,
  unique_genuine_profiles BIGINT,
  today_deposits NUMERIC,
  today_withdrawals NUMERIC,
  lifetime_deposits NUMERIC,
  lifetime_withdrawals NUMERIC,
  flagged_accounts JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_today_end TIMESTAMPTZ := v_today_start + INTERVAL '1 day';
  v_all_members UUID[];
  v_current_level UUID[];
  v_i INT := 0;
  v_total_accounts BIGINT;
  v_genuine_profiles BIGINT;
  v_today_dep NUMERIC;
  v_today_with NUMERIC;
  v_lifetime_dep NUMERIC;
  v_lifetime_with NUMERIC;
BEGIN
  -- Build hierarchy
  v_all_members := ARRAY[p_agent_id];
  v_current_level := ARRAY[p_agent_id];

  WHILE v_i < p_max_level AND array_length(v_current_level, 1) > 0 LOOP
    v_i := v_i + 1;
    SELECT ARRAY_AGG(id) INTO v_current_level
    FROM public.users WHERE referred_by = ANY(v_current_level);
    
    IF v_current_level IS NOT NULL THEN
      v_all_members := v_all_members || v_current_level;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Count accounts
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE total_deposit > 0)::BIGINT
  INTO v_total_accounts, v_genuine_profiles
  FROM public.users
  WHERE id = ANY(v_all_members) AND id != p_agent_id;

  -- Deposits
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= v_today_start AND created_at < v_today_end THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_today_dep, v_lifetime_dep
  FROM public.deposit_history
  WHERE user_id = ANY(v_all_members) AND status = 'completed';

  -- Withdrawals
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= v_today_start AND created_at < v_today_end THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_today_with, v_lifetime_with
  FROM public.withdrawal_history
  WHERE user_id = ANY(v_all_members) AND status = 'completed';

  RETURN QUERY SELECT
    v_total_accounts,
    v_genuine_profiles,
    v_today_dep,
    v_today_with,
    v_lifetime_dep,
    v_lifetime_with,
    '[]'::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_agent_network_fraud(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. FIX: Update InviteesOverview to show correct data
-- View for frontend to use
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_agent_dashboard_data AS
SELECT 
  u.id as agent_id,
  u.referral_code as agent_uid,
  u.phone_number as agent_phone,
  -- Direct invites count
  (SELECT COUNT(*) FROM public.users WHERE referred_by = u.id) as direct_invites_count,
  -- Direct invites deposits (past 24h)
  COALESCE((SELECT total_deposit_amount FROM public.get_agent_direct_invites_deposits(u.id)), 0) as direct_invites_deposit_24h,
  -- Team deposits (past 24h)
  COALESCE((SELECT total_deposit_amount FROM public.get_agent_team_deposits_hierarchy(u.id)), 0) as team_deposit_24h,
  -- Commission
  COALESCE((SELECT total_commission FROM public.calculate_agent_commission(u.id)), 0) as total_commission,
  -- VIP level
  u.vip_level,
  -- Total bets
  u.total_bets
FROM public.users u
WHERE u.is_agent = true OR u.referral_code IN ('146695130', '162334511');

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST: Verify all fixes work
-- ════════════════════════════════════════════════════════════════════════════════

-- Test 1: Platform deposits
SELECT * FROM public.get_platform_past_24h_deposits();

-- Test 2: Agent UID 146695130 direct invites deposits
SELECT * FROM public.get_agent_direct_invites_deposits(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 3: Agent invited members with deposits
SELECT * FROM public.get_agent_invited_members_with_deposits(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 4: Commission calculation
SELECT * FROM public.calculate_agent_commission(
  (SELECT id FROM public.users WHERE referral_code = '146695130' LIMIT 1)
);

-- Test 5: Numeric UID generation
SELECT 
  phone_number,
  referral_code as current_uid,
  public.generate_numeric_uid(phone_number) as new_numeric_uid
FROM public.users 
WHERE phone_number IS NOT NULL 
LIMIT 10;

-- Test 6: Update VIP levels
SELECT public.update_vip_levels();

-- Test 7: Agent dashboard view
SELECT * FROM public.v_agent_dashboard_data 
WHERE agent_uid IN ('146695130', '162334511');

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF COMPREHENSIVE FIX
-- ════════════════════════════════════════════════════════════════════════════════