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
  // 1) Hard phone uniqueness using the public.users table (target table per requirements)
  const { data: existingUsers, error: existingUsersErr } = await supabase
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

/**
 * Generate a unique 6-digit numeric referral code (e.g., 101814)
 * Ensures no collision with existing codes in public.users
 */
const generateReferralCode = async (): Promise<string> => {
  let code: string;
  let attempts = 0;
  do {
    // Generate random 6-digit number between 100000 and 999999
    code = (100000 + Math.floor(Math.random() * 900000)).toString();
    attempts++;
    
    // Check if code already exists in public.users
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', code)
      .limit(1);
      
    if (error) {
      console.error('Error checking referral code uniqueness:', error);
      // If error, just use this code anyway
      return code;
    }
    
    if (!data || data.length === 0) {
      // Code is unique
      return code;
    }
    
    // If we've tried too many times, just use the current code
    if (attempts > 20) {
      console.warn('Could not find unique referral code after 20 attempts, using:', code);
      return code;
    }
  } while (true);
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
      const numericMatch = normalizedInvitationCode.match(/^\d{6,}$/);
      const referralMatch = normalizedInvitationCode.match(/^WW[A-Za-z0-9]{6}$/);

      let referrer: any = null;
      let refErr: any = null;

      console.log('🔍 REFERRAL DEBUG - Looking up invitation code:', normalizedInvitationCode);

      if (referralMatch) {
        // Try matching as WWxxxxxx format in public.users
        ({ data: referrer, error: refErr } = await supabase
          .from('users')
          .select('id, referral_code')
          .eq('referral_code', normalizedInvitationCode)
          .maybeSingle());
          
        console.log('🔍 REFERRAL DEBUG - WW format lookup result:', { referrer, refErr });
      } else if (numericMatch) {
        // Numeric code - look up directly in public.users
        const baseCode = normalizedInvitationCode.slice(0, 6);
        console.log('🔍 REFERRAL DEBUG - Numeric code detected, looking up referral_code:', baseCode);
        
        // First try exact match
        ({ data: referrer, error: refErr } = await supabase
          .from('users')
          .select('id, referral_code')
          .eq('referral_code', baseCode)
          .maybeSingle());
          
        console.log('🔍 REFERRAL DEBUG - Numeric exact lookup result:', { referrer, refErr });
        
        // If not found, try with WW prefix
        if (!referrer && !refErr) {
          console.log('🔍 REFERRAL DEBUG - Trying WW prefix lookup for:', `WW${baseCode}`);
          ({ data: referrer, error: refErr } = await supabase
            .from('users')
            .select('id, referral_code')
            .eq('referral_code', `WW${baseCode}`)
            .maybeSingle());
            
          console.log('🔍 REFERRAL DEBUG - WW prefix lookup result:', { referrer, refErr });
        }

        // If still not found, try phone_number
        if (!referrer && !refErr) {
          console.log('🔍 REFERRAL DEBUG - Trying phone_number lookup for:', normalizedInvitationCode);
          ({ data: referrer, error: refErr } = await supabase
            .from('users')
            .select('id, referral_code')
            .eq('phone_number', normalizedInvitationCode)
            .maybeSingle());
            
          console.log('🔍 REFERRAL DEBUG - Phone number lookup result:', { referrer, refErr });
        }
      } else {
        // Fallback: exact match on referral_code
        ({ data: referrer, error: refErr } = await supabase
          .from('users')
          .select('id, referral_code')
          .eq('referral_code', normalizedInvitationCode)
          .maybeSingle());
          
        console.log('🔍 REFERRAL DEBUG - Fallback lookup result:', { referrer, refErr });
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

    // 1. Auth Creation
    const serviceRoleAvailable = isServiceRoleKey();
    let authData: any;
    let authError: any;

    if (serviceRoleAvailable) {
      ({ data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password,
        user_metadata: { phone: cleanPhone }
      } as any));
    } else {
      ({ data: authData, error: authError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: { data: { phone: cleanPhone } }
      }));
    }

    if (authError) return res.status(400).json({ ok: false, error: authError.message });

    const userId = authData?.user?.id || (authData as any)?.id;
    if (!userId) return res.status(500).json({ ok: false, error: 'Signup failed: No User ID' });

    // 2. Generate unique 6-digit numeric referral code
    const referral_code = await generateReferralCode();
    console.log('📋 Generated 6-digit referral code for new user:', referral_code);

    // 3. Insert into public.users table (target table per requirements)
    const { error: userInsertError } = await supabase.from('users').insert({
      id: userId,
      phone_number: cleanPhone,
      referral_code: referral_code,
      referred_by: referrerId,  // This maps the referrer's id from public.users
      created_at: new Date().toISOString(),
    });

    if (userInsertError) {
      console.error("❌ User Insert Error:", userInsertError);
      return res.status(500).json({ ok: false, error: 'User record creation failed' });
    }

    // 4. Create wallet record
    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      main_balance: 0,
      wagering_required: 0,
    });

    if (walletError) {
      console.error("❌ Wallet Insert Error:", walletError);
      return res.status(500).json({ ok: false, error: 'Wallet creation failed' });
    }

    // Log successful registration
    console.log('✅ Registration complete for:', cleanPhone, 'with referral_code:', referral_code, 'referred_by:', referrerId);
    await logSecurityEvent('register_success', cleanPhone, context, { userId, referralCode: referral_code, referredBy: referrerId });

    return res.json({ 
      ok: true, 
      userId,
      referral_code,
      referred_by: referrerId 
    });

  } catch (err: any) {
    console.error('❌ register failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;