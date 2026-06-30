import { Router } from 'express';
import { supabase, isServiceRoleKey } from '../database/db';
import {
  getDeviceContext,
  logSecurityEvent,
} from './security';

const router = Router();

type RegisterBody = {
  phone: string;
  password: string;
  confirmPassword?: string;
  invitationCode: string;
};

type AbuseGuardReason = 'phone_already_registered';
type AbuseGuardSuccess = { ok: true };
type AbuseGuardFailure = { ok: false; reason: AbuseGuardReason };
type AbuseGuardResult = AbuseGuardSuccess | AbuseGuardFailure;

const isAbuseGuardFailure = (result: AbuseGuardResult): result is AbuseGuardFailure => result.ok === false;

const normalizePhone = (phone: string) => (phone || '').replace(/\D/g, '');

// NOTE: This is a minimal guard for phone uniqueness.
// It logs registration attempts but does not block repeated device/IP attempts.
const enforceAbuseGuards = async (ip: string, phone: string): Promise<AbuseGuardResult> => {
  // 1) Hard phone uniqueness using the profiles table, which is the app's user record source.
  const { data: existingProfiles, error: existingProfilesErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone_number', phone)
    .limit(1);

  if (existingProfilesErr) throw existingProfilesErr;
  if (existingProfiles && existingProfiles.length > 0) {
    return { ok: false, reason: 'phone_already_registered' };
  }

  // 2) Log IP+phone registration attempts for manual review.
  try {
    await supabase.from('registration_attempts').insert({ ip, phone_number: phone });
  } catch {
    // ignore logging failures; do not block registration
  }

  return { ok: true as const };
};

const isValidInvitationCodeFormat = (raw: string) => {
  const code = String(raw || '').trim();
  if (!code) return false;

  // Accept either:
  // 1) digits-only, minimum 6 digits (e.g. 123456)
  // 2) WW + 6 chars (current backend generates WWxxxxxx)
  const digitsOnly = code.replace(/\D/g, '');
  const digitsOk = digitsOnly.length >= 6 && digitsOnly.length === code.length;
  const wwOk = /^WW[A-Za-z0-9]{6}$/.test(code);
  return digitsOk || wwOk;
};

router.post('/register', async (req, res) => {
  try {
    const body = req.body as RegisterBody;
    const phone = normalizePhone(body?.phone);
    const password = body?.password || '';
    const invitationCode = (body?.invitationCode || '').trim();

    if (!phone || phone.length < 9) return res.status(400).json({ ok: false, error: 'Invalid phone' });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Invalid password' });

    const cleanPhone = phone.trim();
    const dummyEmail = `u_${cleanPhone}@winwave.com`;
    
    // ... (Referrer ID logic waisa hi rahe)
    let referrerId: string | null = null;
    // ... (Keep your existing Referrer lookup logic here)

    const context = getDeviceContext(req, body);
    const guard = await enforceAbuseGuards(context.ip, phone);
    if (!guard.ok && isAbuseGuardFailure(guard)) {
       return res.status(409).json({ ok: false, error: 'Phone already registered' });
    }

    // 1. Auth Creation
    const serviceRoleAvailable = isServiceRoleKey();
    let authData: any;
    let authError: any;

    if (serviceRoleAvailable) {
      ({ data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: dummyEmail,
        password,
        user_metadata: { phone: cleanPhone }
      } as any));
    } else {
      ({ data: authData, error: authError } = await supabase.auth.signUp({
        email: dummyEmail,
        password,
        options: { data: { phone: cleanPhone } }
      }));
    }

    if (authError) return res.status(400).json({ ok: false, error: authError.message });

    const userId = authData?.user?.id || (authData as any)?.id;
    if (!userId) return res.status(500).json({ ok: false, error: 'Signup failed: No User ID' });

    // 2. Manual Profile & Wallet Insert
    const referral_code = `WW${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      phone_number: cleanPhone,
      vip_level: 0,
      display_id: Math.floor(100000 + Math.random() * 900000).toString(),
      referral_code: referral_code,
      referred_by: referrerId
    });

    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      main_balance: 0,
      wagering_required: 0,
    });

    if (profileError || walletError) {
      console.error("DB Insert Error:", { profileError, walletError });
      return res.status(500).json({ ok: false, error: 'Database record creation failed' });
    }

    await logSecurityEvent('register_success', cleanPhone, context, { userId, referralCode: referral_code });

    return res.json({ ok: true }); // <--- Yahan par function END ho raha hai

  } catch (err: any) {
    console.error('register failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

    // --- NEW UPDATE: Generate a valid Dummy Email ---
    const cleanPhone = phone.trim();
    const dummyEmail = `u_${cleanPhone}@winwave.com`;
    // ------------------------------------------------

    let referrerId: string | null = null;

    if (invitationCode) {
      if (!isValidInvitationCodeFormat(invitationCode)) {
        return res.status(400).json({ ok: false, error: 'Invalid invitation code format' });
      }

      const normalizedInvitationCode = invitationCode.replace(/[^A-Za-z0-9]/g, '');
      const numericMatch = normalizedInvitationCode.match(/^\d{6,}$/);
      const referralMatch = normalizedInvitationCode.match(/^WW[A-Za-z0-9]{6}$/);

      let referrer: any = null;
      let refErr: any = null;

      if (referralMatch) {
        ({ data: referrer, error: refErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', normalizedInvitationCode)
          .maybeSingle());
      } else if (numericMatch) {
        const baseCode = normalizedInvitationCode.slice(0, 6);
        const orFilters = [`referral_code.eq.${baseCode}`, `referral_code.eq.WW${baseCode}`, `phone_number.eq.${normalizedInvitationCode}`].join(',');
        ({ data: referrer, error: refErr } = await supabase
          .from('profiles')
          .select('id')
          .or(orFilters)
          .maybeSingle());
      } else {
        ({ data: referrer, error: refErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', normalizedInvitationCode)
          .maybeSingle());
      }

      if (refErr) {
        console.warn('Invitation code validation query failed, continuing without referral:', {
          invitationCode,
          normalizedInvitationCode,
          error: refErr,
        });
      } else if (referrer?.id) {
        referrerId = referrer.id;
      } else {
        console.warn('Invitation code not found, continuing registration without referral:', invitationCode);
      }
    }

    const context = getDeviceContext(req, body);

    const guard = await enforceAbuseGuards(context.ip, phone);
    if (!guard.ok && isAbuseGuardFailure(guard)) {
      await logSecurityEvent('register_blocked', phone, context, { reason: guard.reason });
      if (guard.reason === 'phone_already_registered') {
        return res.status(409).json({ ok: false, error: 'Phone already registered' });
      }
    }

    // --- NEW UPDATE: Pass dummyEmail instead of phone to Supabase Auth ---
    const serviceRoleAvailable = isServiceRoleKey();

    let authData: any;
    let authError: any;

    if (serviceRoleAvailable) {
      ({ data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: dummyEmail, // UPDATED
        password,
        user_metadata: { phone: cleanPhone } // Save phone in metadata just in case
      } as any));
    } else {
      ({ data: authData, error: authError } = await supabase.auth.signUp({
        email: dummyEmail, // UPDATED
        password,
        options: {
          data: { phone: cleanPhone } // Save phone in metadata just in case
        }
      }));
    }
    // ---------------------------------------------------------------------

    // ... (up ka auth block waisa hi rahe)

    if (authError) {
      return res.status(400).json({ ok: false, error: authError.message || 'Signup failed' });
    }

    const userId = (authData as any)?.user?.id;

    if (!userId) {
      return res.status(500).json({ ok: false, error: 'User ID not found' });
    }

    // --- MANUAL INSERTION (Trigger ke bajaye ab hum yahan seedha data daal rahe hain) ---
    const referral_code = `WW${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 1. Profile Insert
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      phone_number: cleanPhone,
      referral_code: referral_code,
      referred_by: referrerId
    });

    // 2. Wallet Insert
    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      main_balance: 0,
      wagering_required: 0,
    });

    if (profileError || walletError) {
      console.error("Profile/Wallet creation failed:", { profileError, walletError });
      return res.status(500).json({ ok: false, error: 'Database record creation failed' });
    }
    // ----------------------------------------------------------------------------------

    await logSecurityEvent('register_success', cleanPhone, context, { userId, referralCode: referral_code });

    return res.json({ ok: true });

    if (authError) {
      return res.status(400).json({ ok: false, error: authError.message || 'Signup failed' });
    }

    const userId =
      (authData as any)?.user?.id ||
      (authData as any)?.session?.user?.id ||
      (authData as any)?.id;

    if (!userId) {
      console.error('Registration failed because Supabase returned no user ID', authData);
      return res.status(500).json({ ok: false, error: serviceRoleAvailable ? 'Signup failed' : 'Supabase signup failed. Check anon key or service role key.' });
    }

    // Create user/profile
    const referral_code = `WW${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const profileInsert = {
      id: userId,
      phone_number: phone,
      referral_code,
      referred_by: referrerId,
    } as Record<string, any>;

    const { error: userError } = await supabase.from('profiles').insert(profileInsert);

    if (userError) throw userError;

    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      main_balance: 0,
      wagering_required: 0,
    });

    if (walletError) throw walletError;

    await logSecurityEvent('register_success', phone, context, { userId, referralCode: referral_code });

    return res.json({ ok: true });

  } catch (err: any) {
    const errorMessage = err?.message || String(err) || 'register_failed';
    console.error('register failed', errorMessage, err);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
});

export default router;