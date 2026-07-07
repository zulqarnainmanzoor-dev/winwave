-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Create All Required RPC Functions
-- ════════════════════════════════════════════════════════════════════════════════
-- Purpose: Ensure all RPC functions exist with correct parameter names and types
--          to prevent "function does not exist" errors in frontend
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: EXISTING RPC FUNCTIONS (Already in MASTER_PRODUCTION_SCHEMA)
-- ─────────────────────────────────────────────────────────────────────────────
-- These functions already exist and should NOT be recreated:
-- - public.validate_invite_code(p_code TEXT)
-- - public.validate_referral_code(p_code TEXT)
-- - public.get_referral_stats(p_user_id UUID)
-- - public.get_user_rtp_phase(p_user_id UUID)
-- - public.get_active_round(p_game_type TEXT, p_mode TEXT)
-- - public.set_round_target(p_period TEXT, p_target_result TEXT)
-- - public.complete_round(p_period TEXT, p_number INT, p_size TEXT, p_color TEXT)
-- - public.get_server_time()
-- - public.submit_withdrawal(p_user_id UUID, p_amount NUMERIC, p_method TEXT, p_account_name TEXT, p_account_number TEXT, p_remarks TEXT)
-- - public.approve_withdrawal(p_withdrawal_id UUID)
-- - public.fail_withdrawal(p_withdrawal_id UUID, p_reason TEXT)

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: VERIFY EXISTING FUNCTIONS ARE CORRECT
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify validate_referral_code exists and has correct signature
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name = 'validate_referral_code';

-- Verify get_referral_stats exists and has correct signature
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name = 'get_referral_stats';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: ADDITIONAL RPC FUNCTIONS (If needed in future)
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to get commission history for a user
CREATE OR REPLACE FUNCTION public.get_commission_history(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  member_uid TEXT,
  deposit_amount NUMERIC,
  commission_percent NUMERIC,
  commission_amount NUMERIC,
  status TEXT,
  claimed BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    u.referral_code::TEXT,
    dh.amount,
    CAST(0.06 AS NUMERIC),  -- 6% commission rate (example)
    t.amount,
    t.status,
    FALSE,
    t.created_at
  FROM public.transactions t
  JOIN public.users u ON t.user_id = u.id
  LEFT JOIN public.deposit_history dh ON dh.user_id = u.id
  WHERE t.user_id = p_user_id
    AND t.type = 'commission'
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_commission_history(UUID, INT) TO authenticated;

-- Function to get invitees with real UIDs
CREATE OR REPLACE FUNCTION public.get_invitees_with_uids(p_user_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_bets INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, u.invite_code)::TEXT,
    u.phone_number,
    u.total_deposit,
    u.total_bets,
    u.created_at
  FROM public.users u
  WHERE u.referred_by = p_user_id
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitees_with_uids(UUID, INT) TO authenticated;

-- Function to search invitees by UID or phone
CREATE OR REPLACE FUNCTION public.search_invitees(
  p_user_id UUID,
  p_search_term TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_bets INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.referral_code, u.invite_code)::TEXT,
    u.phone_number,
    u.total_deposit,
    u.total_bets,
    u.created_at
  FROM public.users u
  WHERE u.referred_by = p_user_id
    AND (
      u.referral_code ILIKE '%' || p_search_term || '%'
      OR u.phone_number ILIKE '%' || p_search_term || '%'
      OR u.invite_code ILIKE '%' || p_search_term || '%'
    )
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_invitees(UUID, TEXT, INT) TO authenticated;

-- Function to get real-time partner rewards stats
CREATE OR REPLACE FUNCTION public.get_partner_rewards_stats(p_user_id UUID)
RETURNS TABLE(
  invitation_count BIGINT,
  effective_invitation_count BIGINT,
  invitation_total_bonus NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bonus NUMERIC;
BEGIN
  -- Get total bonus from transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_total_bonus
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'commission'
    AND status = 'completed';

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS invitation_count,
    COUNT(*) FILTER (WHERE total_deposit > 0)::BIGINT AS effective_invitation_count,
    v_total_bonus AS invitation_total_bonus
  FROM public.users
  WHERE referred_by = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_rewards_stats(UUID) TO authenticated;

-- Function to claim commission with idempotency check
CREATE OR REPLACE FUNCTION public.claim_commission(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_last_claim_date DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Check if user already claimed today
  SELECT DATE(MAX(created_at)) INTO v_last_claim_date
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'commission_claimed'
    AND status = 'completed';

  IF v_last_claim_date = v_today THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Already claimed commission today. Try again tomorrow.'
    );
  END IF;

  -- Get current balance
  SELECT main_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  -- Credit commission to main balance
  v_new_balance := v_current_balance + p_amount;
  UPDATE public.users
  SET main_balance = v_new_balance
  WHERE id = p_user_id;

  -- Record the claim
  INSERT INTO public.transactions (user_id, type, amount, status)
  VALUES (p_user_id, 'commission_claimed', p_amount, 'completed');

  RETURN jsonb_build_object(
    'success', TRUE,
    'new_balance', v_new_balance,
    'claimed_amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_commission(UUID, NUMERIC) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════
