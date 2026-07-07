-- ════════════════════════════════════════════════════════════════════════════════
-- DAILY COMMISSION CLAIM LIMIT - ONE CLAIM PER 24 HOURS
-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION: Check if agent can claim commission today
DROP FUNCTION IF EXISTS public.can_claim_commission_today(UUID);

CREATE OR REPLACE FUNCTION public.can_claim_commission_today(p_agent_id UUID)
RETURNS TABLE(
  can_claim BOOLEAN,
  last_claim_at TIMESTAMPTZ,
  next_claim_at TIMESTAMPTZ,
  total_commission NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_ago TIMESTAMPTZ;
  v_last_claim TIMESTAMPTZ;
  v_total_comm NUMERIC;
BEGIN
  v_24h_ago := NOW() - INTERVAL '24 hours';

  -- Get last commission claim
  SELECT MAX(created_at) INTO v_last_claim
  FROM public.transactions
  WHERE user_id = p_agent_id
  AND type = 'commission_claim'
  AND created_at >= v_24h_ago;

  -- Get total unclaimed commission
  SELECT COALESCE(SUM(amount), 0) INTO v_total_comm
  FROM public.transactions
  WHERE user_id = p_agent_id
  AND type = 'commission'
  AND status = 'completed';

  RETURN QUERY
  SELECT
    (v_last_claim IS NULL)::BOOLEAN as can_claim,
    v_last_claim as last_claim_at,
    CASE WHEN v_last_claim IS NOT NULL THEN v_last_claim + INTERVAL '24 hours' ELSE NULL END as next_claim_at,
    v_total_comm as total_commission;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_claim_commission_today(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════

-- FUNCTION: Claim commission (only once per 24 hours)
DROP FUNCTION IF EXISTS public.claim_commission_daily(UUID);

CREATE OR REPLACE FUNCTION public.claim_commission_daily(p_agent_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  new_balance NUMERIC,
  claimed_amount NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_24h_ago TIMESTAMPTZ;
  v_last_claim TIMESTAMPTZ;
  v_total_comm NUMERIC;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_24h_ago := NOW() - INTERVAL '24 hours';

  -- Check if already claimed in past 24 hours
  SELECT MAX(created_at) INTO v_last_claim
  FROM public.transactions
  WHERE user_id = p_agent_id
  AND type = 'commission_claim'
  AND created_at >= v_24h_ago;

  IF v_last_claim IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      FALSE::BOOLEAN,
      'You can only claim commission once per 24 hours. Next claim available at: ' || (v_last_claim + INTERVAL '24 hours')::TEXT,
      0::NUMERIC,
      0::NUMERIC;
    RETURN;
  END IF;

  -- Get total unclaimed commission
  SELECT COALESCE(SUM(amount), 0) INTO v_total_comm
  FROM public.transactions
  WHERE user_id = p_agent_id
  AND type = 'commission'
  AND status = 'completed';

  IF v_total_comm <= 0 THEN
    RETURN QUERY
    SELECT 
      FALSE::BOOLEAN,
      'No commission available to claim',
      0::NUMERIC,
      0::NUMERIC;
    RETURN;
  END IF;

  -- Get current balance
  SELECT main_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_agent_id;

  v_new_balance := v_current_balance + v_total_comm;

  -- Update user balance
  UPDATE public.users
  SET main_balance = v_new_balance
  WHERE id = p_agent_id;

  -- Record claim transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    remarks
  ) VALUES (
    p_agent_id,
    'commission_claim',
    v_total_comm,
    'completed',
    'Daily commission claim - Rs ' || v_total_comm::TEXT
  );

  RETURN QUERY
  SELECT 
    TRUE::BOOLEAN,
    'Commission claimed successfully! Rs ' || v_total_comm::TEXT || ' added to your main wallet.',
    v_new_balance,
    v_total_comm;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_commission_daily(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Check if agent can claim today:
-- SELECT * FROM public.can_claim_commission_today('AGENT_UUID_HERE');

-- Claim commission (only once per 24 hours):
-- SELECT * FROM public.claim_commission_daily('AGENT_UUID_HERE');
