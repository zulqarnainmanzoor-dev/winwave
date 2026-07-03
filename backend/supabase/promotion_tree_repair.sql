-- ============================================================
-- PROMOTION TREE REPAIR: Invitee Counter & Commission System
-- ============================================================

-- STEP 1: Add total_invitees column if it doesn't exist
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS total_invitees INTEGER NOT NULL DEFAULT 0;

-- STEP 2: Create trigger function to auto-increment invitee counter
CREATE OR REPLACE FUNCTION public.handle_new_downline_registration_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- If new user has a referrer, increment their invitee counter
    IF NEW.referred_by IS NOT NULL AND NEW.referred_by != '' THEN
        UPDATE public.users
        SET total_invitees = COALESCE(total_invitees, 0) + 1
        WHERE referral_code = NEW.referred_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Bind trigger to users table
DROP TRIGGER IF EXISTS on_new_user_registration_counter_sync ON public.users;
CREATE TRIGGER on_new_user_registration_counter_sync
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_downline_registration_sync();

-- STEP 4: Create commission distribution RPC function
CREATE OR REPLACE FUNCTION public.process_team_commission(
    p_subordinate_id UUID,
    p_processing_amount NUMERIC
)
RETURNS VOID AS $$
DECLARE
    v_referrer_code TEXT;
    v_commission_amount NUMERIC;
BEGIN
    -- Get the referrer code for the subordinate
    SELECT referred_by INTO v_referrer_code
    FROM public.users
    WHERE id = p_subordinate_id;

    -- If no referrer, exit
    IF v_referrer_code IS NULL OR v_referrer_code = '' THEN
        RETURN;
    END IF;

    -- Calculate commission (0.5% baseline)
    v_commission_amount := p_processing_amount * 0.005;

    -- Credit the referrer's balance and commission total
    UPDATE public.users
    SET 
        main_balance = COALESCE(main_balance, 0) + v_commission_amount,
        total_commission_earned = COALESCE(total_commission_earned, 0) + v_commission_amount
    WHERE referral_code = v_referrer_code;

    -- Log commission transaction
    INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        status,
        gateway_ref,
        created_at
    ) VALUES (
        (SELECT id FROM public.users WHERE referral_code = v_referrer_code),
        'commission',
        v_commission_amount,
        'completed',
        'Team Commission',
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_downline_registration_sync() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.process_team_commission(UUID, NUMERIC) TO postgres, service_role;

-- STEP 6: Backfill total_invitees for existing users
UPDATE public.users u
SET total_invitees = COALESCE((
    SELECT COUNT(*)
    FROM public.users child
    WHERE child.referred_by = u.referral_code
), 0);

-- Verification query
-- SELECT referral_code, total_invitees FROM public.users ORDER BY total_invitees DESC LIMIT 10;