-- ================================================================
-- credit_user_balance.sql
-- Run in Supabase SQL Editor.
-- Called by the Node.js WinGo engine after resolving a winning bet.
-- Atomically credits main_balance and updates total_winning + rtp_phase.
-- ================================================================

CREATE OR REPLACE FUNCTION public.credit_user_balance(
  p_user_id UUID,
  p_amount  NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users
  SET
    main_balance  = main_balance  + p_amount,
    total_winning = total_winning + p_amount,
    rtp_phase     = public.fn_compute_rtp_phase(
                      total_deposit,
                      total_winning + p_amount,
                      total_bets_count
                    )
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_user_balance(UUID, NUMERIC)
  TO service_role;
