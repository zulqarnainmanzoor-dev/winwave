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

// Public, user-facing display id: a random 6-digit numeric code (e.g. "634079").
// The internal uuid (profiles.id) remains the source of truth for DB relations.
const randomDisplayId = (digits = 6): string => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

// Generates a 6-digit numeric display id and verifies it is not already taken,
// retrying a few times to avoid collisions; widens to 8 digits as a fallback.
const generateUniqueDisplayId = async (): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomDisplayId();
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();
    if (error) {
      // On lookup failure, fall back to a higher-entropy id rather than blocking.
      return randomDisplayId(8);
    }
    if (!data) return candidate;
  }
  return randomDisplayId(8);
};

// NOTE: This is a minimal guard for phone uniqueness.
// It logs registration attempts but does not block repeated device/IP attempts.
const enforceAbuseGuards = async (ip: string, phone: string): Promise<AbuseGuardResult> => {
  // 1) Hard phone uniqueness using the profiles table, which is the app's user record source.
  const { data: existingProfiles, error: existingProfilesErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
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
    const dummyEmail = `${cleanPhone}@winwave.com`;

    // Resolve the referrer (optional). Supports WW-prefixed referral codes,
    // raw numeric codes, and phone-number based invitation codes.
    let referrerId: string | null = null;

    if (invitationCode) {
      if (!isValidInvitationCodeFormat(invitationCode)) {
        return res.status(400).json({ ok: false, error: 'Invalid invitation code format' });
      }

      const normalizedInvitationCode = invitationCode.replace(/[^A-Za-z0-9]/g, '');
      const numericMatch = normalizedInvitationCode.match(/^\d{6,}$/);
      const referralMatch = normalizedInvitationCode.match(/^WW[A-Za-z0-9]{6}$/);

      let referrer: { id: string } | null = null;
      let refErr: unknown = null;

      if (numericMatch && !referralMatch) {
        const baseCode = normalizedInvitationCode.slice(0, 6);
        ({ data: referrer, error: refErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('invite_code', baseCode)
          .maybeSingle());
      } else {
        ({ data: referrer, error: refErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('invite_code', normalizedInvitationCode)
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
    if (isAbuseGuardFailure(guard)) {
      await logSecurityEvent('register_blocked', phone, context, { reason: guard.reason });
      return res.status(409).json({ ok: false, error: 'Phone already registered' });
    }

    // Create the auth user with a deterministic dummy email derived from the phone.
    const serviceRoleAvailable = isServiceRoleKey();
    let authData: any;
    let authError: any;

    if (serviceRoleAvailable) {
      ({ data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: dummyEmail,
        password,
        user_metadata: { phone: cleanPhone },
      } as any));
    } else {
      ({ data: authData, error: authError } = await supabase.auth.signUp({
        email: dummyEmail,
        password,
        options: { data: { phone: cleanPhone } },
      }));
    }

    if (authError) {
      return res.status(400).json({ ok: false, error: authError.message || 'Signup failed' });
    }

    const userId =
      (authData as any)?.user?.id ||
      (authData as any)?.session?.user?.id ||
      (authData as any)?.id;

    if (!userId) {
      console.error('Registration failed because Supabase returned no user ID', authData);
      return res.status(500).json({
        ok: false,
        error: serviceRoleAvailable ? 'Signup failed' : 'Supabase signup failed. Check anon key or service role key.',
      });
    }

    // Create the user, profile and wallet rows for the new account. The same
    // 6-digit numeric code is the user-facing display id and the invite code.
    const display_id = await generateUniqueDisplayId();
    const username = `MEMBER_${cleanPhone.slice(-4)}`;

    const { error: usersError } = await supabase.from('users').insert({
      id: userId,
      phone_number: cleanPhone,
      password_hash: 'supabase_auth',
      referral_code: display_id,
      referred_by: referrerId,
      vip_level: 0,
      is_active: true,
    });

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      phone: cleanPhone,
      username,
      vip_level: 0,
      balance: 0,
      invite_code: display_id,
      inviter_id: referrerId,
      last_active: new Date().toISOString(),
    });

    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      main_balance: 0,
      wagering_required: 0,
      wagering_completed: 0,
      total_recharged: 0,
      total_withdrawn: 0,
    });

    if (usersError || profileError || walletError) {
      console.error('Account record creation failed:', { usersError, profileError, walletError });
      // Roll back the orphaned auth user so the phone can be retried cleanly.
      if (serviceRoleAvailable) {
        try { await supabase.auth.admin.deleteUser(userId); } catch { /* best effort */ }
      }
      return res.status(500).json({ ok: false, error: 'Database record creation failed' });
    }

    await logSecurityEvent('register_success', cleanPhone, context, { userId, referralCode: display_id });

    return res.json({ ok: true });
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || 'register_failed';
    console.error('register failed', errorMessage, err);
    return res.status(500).json({ ok: false, error: errorMessage });
  }
});

export default router;