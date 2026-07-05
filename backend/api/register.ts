import { Router } from 'express';
import { supabaseAdmin, isServiceRoleKey } from '../database/db';
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
  // 1) Hard phone uniqueness using the public.users table (target table per requirements)
  const { data: existingUsers, error: existingUsersErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('phone_number', phone)
    .limit(1);

  if (existingUsersErr) throw existingUsersErr;
  if (existingUsers && existingUsers.length > 0) {
    return { ok: false, reason: 'phone_already_registered' };
  }

  // 2) Log IP+phone registration attempts for manual review.
  try {
    await (supabaseAdmin as any).from('registration_attempts').insert({ ip, phone_number: phone });
  } catch {
    // ignore logging failures; do not block registration
  }

  return { ok: true as const };
};

const isValidInvitationCodeFormat = (raw: string) => {
  const code = String(raw || '').trim();
  if (!code) return false;

  // Accept 9-digit numeric codes only (e.g. 123456789)
  const digitsOnly = code.replace(/\D/g, '');
  return digitsOnly.length === 9 && digitsOnly.length === code.length;
};

/**
 * Generate a unique 9-digit numeric invite/referral code
 */
const generateInviteCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    // Generate 9-digit numeric code (100000000 to 999999999)
    const candidate = Math.floor(100000000 + Math.random() * 900000000).toString();

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('referral_code', candidate)
        .limit(1);

      if (error) {
        console.warn('Invite code uniqueness lookup failed, using fallback code', { candidate, error });
        return candidate;
      }

      if (!data || data.length === 0) {
        return candidate;
      }
    } catch (lookupError: any) {
      console.warn('Invite code lookup threw, using fallback code', { candidate, error: lookupError?.message });
      return candidate;
    }
  }

  // Fallback: use timestamp-based 9-digit code
  return Date.now().toString().slice(-9);
};

router.post('/register', async (req, res) => {
  try {
    const body = req.body as RegisterBody;
    const rawPhone = normalizePhone(body?.phone);
    const password = body?.password || '';
    const invitationCode = (body?.invitationCode || '').trim();

    if (!rawPhone) return res.status(400).json({ ok: false, error: 'Invalid phone' });
    const normalizedPhone = rawPhone.length === 11 && rawPhone.startsWith('0') ? rawPhone.slice(1) : rawPhone;
    if (!/^03\d{9}$/.test(`0${normalizedPhone}`)) {
      return res.status(400).json({ ok: false, error: 'Invalid Pakistan mobile number. Use 03XXXXXXXXX format.' });
    }
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Invalid password' });

    const cleanPhone = normalizedPhone.trim();
    const userEmail = `${cleanPhone}@winwave.com`;

    // ============================================================
    // REFERRAL LOGIC: Look up referrer by referral_code in public.users
    // ============================================================
    let referrerId: string | null = null;

    if (invitationCode) {
      if (!isValidInvitationCodeFormat(invitationCode)) {
        return res.status(400).json({ ok: false, error: 'Invalid invitation code format' });
      }

      const normalizedInvitationCode = invitationCode.replace(/[^A-Za-z0-9]/g, '');
      
      // Only accept 9-digit numeric codes
      const numericMatch = normalizedInvitationCode.match(/^\d{9}$/);

      let referrer: any = null;
      let refErr: any = null;

      console.log('🔍 REFERRAL DEBUG - Looking up invitation code:', normalizedInvitationCode);

      if (numericMatch) {
        // 9-digit numeric code - look up directly in public.users
        console.log('🔍 REFERRAL DEBUG - 9-digit code detected, looking up referral_code:', normalizedInvitationCode);
        
        ({ data: referrer, error: refErr } = await supabaseAdmin
          .from('users')
          .select('id, referral_code')
          .eq('referral_code', normalizedInvitationCode)
          .maybeSingle());
          
        console.log('🔍 REFERRAL DEBUG - 9-digit lookup result:', { referrer, refErr });
      } else {
        // Invalid format
        console.log('🔍 REFERRAL DEBUG - Invalid invitation code format:', normalizedInvitationCode);
      }

      if (refErr) {
        console.warn('⚠️ REFERRAL DEBUG - Invitation code validation query failed:', {
          invitationCode,
          normalizedInvitationCode,
          error: refErr,
        });
      } else if (referrer?.id) {
        referrerId = referrer.id;
        console.log('✅ REFERRAL DEBUG - Referrer found! ID:', referrerId, 'Code:', referrer.referral_code);
      } else {
        console.warn('⚠️ REFERRAL DEBUG - Invitation code not found in public.users, continuing without referral:', invitationCode);
      }
    } else {
      console.log('ℹ️ REFERRAL DEBUG - No invitation code provided, registering without referral');
    }

    const context = getDeviceContext(req, body);
    const guard = await enforceAbuseGuards(context.ip, normalizedPhone);
    if (!guard.ok && isAbuseGuardFailure(guard)) {
       return res.status(409).json({ ok: false, error: 'Phone already registered' });
    }

    // Registration is now handled by the client auth flow in AuthViewReact.
    // The backend route only validates referral and abuse-state concerns.
    await logSecurityEvent('register_deferred', cleanPhone, context, { referredBy: referrerId });

    return res.status(202).json({
      ok: true,
      message: 'Registration is handled by the client auth flow.',
      phone: cleanPhone,
      referred_by: referrerId,
    });

  } catch (err: any) {
    console.error('❌ register failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;