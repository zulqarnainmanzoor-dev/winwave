-- ════════════════════════════════════════════════════════════════════════════════
-- FIX: Show YESTERDAY's data (Monday) instead of today
-- ════════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_subordinate_past_24h_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_subordinate_past_24h_stats(p_agent_id UUID)
RETURNS TABLE(
  deposit_count BIGINT,
  deposit_amount NUMERIC,
  deposit_users BIGINT,
  first_deposit_users BIGINT,
  first_deposit_amount NUMERIC,
  total_bet NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
BEGIN
  -- Calculate yesterday's date range (00:00 to 23:59)
  v_yesterday_start := DATE_TRUNC('day', NOW() - INTERVAL '1 day') AT TIME ZONE 'UTC';
  v_yesterday_end := v_yesterday_start + INTERVAL '1 day';

  RETURN QUERY
  SELECT
    COUNT(dh.id)::BIGINT as deposit_count,
    COALESCE(SUM(dh.amount), 0) as deposit_amount,
    COUNT(DISTINCT dh.user_id)::BIGINT as deposit_users,
    COUNT(DISTINCT dh.user_id)::BIGINT as first_deposit_users,
    COALESCE(SUM(dh.amount), 0) as first_deposit_amount,
    0::NUMERIC as total_bet
  FROM public.deposit_history dh
  JOIN public.users u ON dh.user_id = u.id
  WHERE u.referred_by = p_agent_id
  AND dh.status = 'completed'
  AND dh.created_at >= v_yesterday_start
  AND dh.created_at < v_yesterday_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subordinate_past_24h_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- TEST: Verify function returns yesterday's data
-- ════════════════════════════════════════════════════════════════════════════════

SELECT * FROM public.get_subordinate_past_24h_stats('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- ════════════════════════════════════════════════════════════════════════════════
