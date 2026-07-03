import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  Headphones,
  CheckCircle,
  User,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

interface AuthViewProps {
  onLoginSuccess: (
    phoneNumber: string,
    userId?: string,
    profile?: { referral_code?: string; invite_code?: string; phone_number?: string },
    wallet?: { main_balance?: number; wagering_required?: number }
  ) => void;
  initialMode?: "login" | "register";
}

export default function AuthView({
  onLoginSuccess,
  initialMode = "login",
}: AuthViewProps) {
  const { language, t, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isReferralLocked, setIsReferralLocked] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  const getReferralCodeFromLocation = () => {
    if (typeof window === 'undefined') return '';
    const fromSearch = searchParams.get('ref') || searchParams.get('invite');
    if (fromSearch) return fromSearch.trim().toUpperCase();

    const rawHash = window.location.hash || '';
    const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] || '' : rawHash.replace(/^#\/?/, '');
    const hashParams = new URLSearchParams(hashQuery);
    const fromHash = hashParams.get('ref') || hashParams.get('invite');
    if (fromHash) return fromHash.trim().toUpperCase();

    const hashRefMatch = rawHash.match(/[?&](?:ref|invite)=([^&]+)/i);
    return hashRefMatch?.[1] ? decodeURIComponent(hashRefMatch[1]) : '';
  };

useEffect(() => {
  const storedPhone = localStorage.getItem('winwave_last_phone');
  if (storedPhone) setPhone(storedPhone);

  // Always clear stale referral from storage first
  localStorage.removeItem('winwave_referral_code');

  const refCode = getReferralCodeFromLocation();
  if (refCode) {
    const normalizedRef = refCode.trim().toUpperCase();
    setInviteCode(normalizedRef);
    setIsReferralLocked(true);
    setMode('register');
  } else {
    setInviteCode('');
    setIsReferralLocked(false);
  }
}, [searchParams]);

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const normalizePakistanPhone = (value: string) => {
    const digits = normalizePhone(value);
    const normalized = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : '';
    return /^03\d{9}$/.test(`0${normalized}`) ? normalized : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedPhone = normalizePakistanPhone(phone);

    if (!normalizedPhone) {
      setError(language === 'EN' ? 'Please enter a valid 10-digit Pakistani phone number.' : 'براہ کرم درست 10 ہندسوں کا پاکستانی فون نمبر درج کریں۔');
      return;
    }

    if (!password.trim()) {
      setError(language === 'EN' ? 'Please enter your password.' : 'براہ کرم اپنا پاس ورڈ درج کریں۔');
      return;
    }

    if (mode === 'register') {
      if (normalizedPhone.length !== 10) {
        setError(language === 'EN' ? 'The phone number must be exactly 10 digits.' : 'فون نمبر بالکل 10 ہندسے ہونا چاہیے۔');
        return;
      }
      if (password !== confirmPassword) {
        setError(language === 'EN' ? 'Passwords do not match.' : 'پاس ورڈ میل نہیں کھا رہے ہیں۔');
        return;
      }
      if (password.length < 6) {
        setError(language === 'EN' ? 'Password must be at least 6 characters.' : 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔');
        return;
      }
    }

    setLoading(true);

    try {
      const email = `${normalizedPhone}@winwave.com`;

      if (mode === 'register') {
        const inviterCode = inviteCode.trim() || null;

        // ── Resolve invite code → referrer UUID BEFORE signUp ────
        // UUID is passed in metadata so the trigger uses it directly,
        // eliminating any race condition in code→UUID resolution.
        let referrerUuid: string | null = null;
        if (inviterCode) {
          const normalizedCode = inviterCode.trim().toUpperCase();
          const { data: referrerRow, error: refErr } = await supabase
            .from('users')
            .select('id')
            .eq('invite_code', normalizedCode)
            .maybeSingle();

          if (refErr || !referrerRow?.id) {
            setError(
              language === 'EN'
                ? `Invite code "${normalizedCode}" is invalid. Please check and try again.`
                : `\u062f\u0639\u0648\u062a \u06a9\u0648\u0688 "${normalizedCode}" \u063a\u0644\u0637 \u06c1\u06d2\u06d4 \u062f\u0648\u0628\u0627\u0631\u06c1 \u0686\u06cc\u06a9 \u06a9\u0631\u06cc\u06ba\u06d4`
            );
            setLoading(false);
            return;
          }
          referrerUuid = referrerRow.id;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              phone_number: normalizedPhone,
              inviter_code:  inviterCode ? inviterCode.trim().toUpperCase() : null,
              referrer_uuid: referrerUuid,
            }
          }
        });

        if (error) {
          console.error("Supabase SignUp Error:", error);
          // Map common Supabase signup errors to friendly messages
          let msg = error.message;
          if (msg.includes('already registered') || msg.includes('already been registered') || error.status === 422) {
            msg = language === 'EN'
              ? 'This phone number is already registered. Please log in.'
              : 'یہ نمبر پہلے سے رجسٹرڈ ہے۔ لاگ ان کریں۔';
          } else if (msg.includes('password') || msg.includes('weak')) {
            msg = language === 'EN'
              ? 'Password must be at least 6 characters.'
              : 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔';
          } else if (error.status === 500) {
            msg = language === 'EN'
              ? 'Registration failed due to a server error. Please try again.'
              : 'سرور کی خرابی کی وجہ سے رجسٹریشن ناکام ہوئی۔ دوبارہ کوشش کریں۔';
          }
          setError(msg);
          setLoading(false);
          return;
        }

        localStorage.setItem('winwave_last_phone', normalizedPhone);
        setIsReferralLocked(false);

        setSuccess(language === 'EN' ? 'Registration complete! You are now logged in.' : 'رجسٹریشن مکمل ہو گئی ہے!');

        onLoginSuccess(
          normalizedPhone,
          data.user?.id || normalizedPhone,
          { phone_number: normalizedPhone },
          undefined
        );

      } else {
        // LOGIN MODE
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Check if the phone number exists in public.users first
          const { count } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('phone_number', normalizedPhone);

          if (count === 0 || count === null) {
            setError(
              language === 'EN'
                ? 'This number is not registered. Please sign up first.'
                : 'یہ نمبر رجسٹرڈ نہیں ہے۔ پہلے سائن اپ کریں۔'
            );
          } else {
            setError(
              language === 'EN'
                ? 'Incorrect password. Please try again.'
                : 'پاس ورڈ غلط ہے۔ دوبارہ کوشش کریں۔'
            );
          }
          setLoading(false);
          return;
        }

        if (rememberPassword) {
          localStorage.setItem('winwave_last_phone', normalizedPhone);
        }

        onLoginSuccess(
          normalizedPhone,
          data.user?.id || normalizedPhone,
          { phone_number: normalizedPhone },
          undefined
        );
      }
    } catch (err: any) {
      console.error('Auth Flow Error:', err);
      setError(err?.message || (language === 'EN' ? 'Authentication failed.' : 'توثیق ناکام ہو گئی۔'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 relative overflow-y-auto no-scrollbar">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,165,0,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div className="flex items-center justify-between p-4 z-40 bg-transparent flex-shrink-0">
        <button onClick={() => mode === "register" && setMode("login")} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95">
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setIsLanguageOpen(true)} className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95">
            <Headphones className="w-5 h-5 text-gray-300" />
          </button>
          <button type="button" onClick={() => setIsLanguageOpen(true)} className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-full px-2.5 py-1 text-xs font-black text-white cursor-pointer active:scale-95 transition-all">
            <span className="tracking-wider uppercase">{language}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-12 pt-6 z-10 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center select-none py-6 mb-8">
          <div className="text-4xl font-black italic tracking-wider bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,165,2,0.35)] uppercase">
            {t('brand')}
          </div>
        </div>

        {success && (
          <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3.5 text-xs text-center font-bold mb-6 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3.5 text-xs text-center font-bold mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative flex items-center bg-[#161618] border border-white/10 rounded-2xl p-1.5 focus-within:border-[#ffa502]/50 transition-all shadow-md">
            <div className="p-2.5 text-gray-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-white font-bold text-sm pr-1.5 border-r border-white/10 select-none mr-2">+92</span>
            <input
              type="tel"
              placeholder={t('phonePlaceholder')}
              value={phone}
              maxLength={10}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setPhone(digits.slice(0, 10));
              }}
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2"
              required
            />
          </div>

          <div className="relative flex items-center bg-[#161618] border border-white/10 rounded-2xl p-1.5 focus-within:border-[#ffa502]/50 transition-all shadow-md">
            <div className="p-2.5 text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'login' ? t('passwordPlaceholder') : t('passwordRequirements')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2 pr-10"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 text-gray-400 hover:text-white p-1">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'register' && (
            <>
              <div className="relative flex items-center bg-[#161618] border border-white/10 rounded-2xl p-1.5 focus-within:border-[#ffa502]/50 transition-all shadow-md">
                <div className="p-2.5 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2 pr-10"
                  required
                />
              </div>
              <div className="relative flex items-center bg-[#161618] border border-white/10 rounded-2xl p-1.5 focus-within:border-[#ffa502]/50 transition-all shadow-md">
                <div className="p-2.5 text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Invitation code (optional)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  readOnly={isReferralLocked}
                  disabled={isReferralLocked}
                  className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2 pr-10 ${isReferralLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                {isReferralLocked && (
                  <div className="absolute right-3 text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                    Locked
                  </div>
                )}
              </div>
            </>
          )}

          <div className="pt-6 space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-[#ffa502] hover:brightness-110 active:scale-95 text-black font-black py-4 rounded-full transition-all uppercase text-sm tracking-widest cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (mode === 'login' ? 'Logging in...' : 'Creating account...') : (mode === 'login' ? t('login') : t('register'))}
            </button>

            {mode === 'login' ? (
              <button type="button" onClick={() => setMode('register')} className="w-full border border-[#ffa502]/30 hover:border-[#ffa502]/70 text-[#ffa502] hover:text-amber-400 active:scale-95 font-black py-4 rounded-full transition-all uppercase text-xs tracking-widest cursor-pointer bg-white/5">
                {t('registerNow')}
              </button>
            ) : (
              <button type="button" onClick={() => setMode('login')} className="w-full border border-white/10 hover:border-white/20 text-gray-300 hover:text-white active:scale-95 font-black py-4 rounded-full transition-all uppercase text-xs tracking-widest cursor-pointer bg-white/5">
                {t('passwordLogin')}
              </button>
            )}
          </div>
        </form>
      </div>

      {isLanguageOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsLanguageOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-[#0A0A0B] border-t border-white/10 rounded-t-3xl shadow-2xl p-4">
            <button type="button" onClick={() => { setLanguage('EN'); setIsLanguageOpen(false); }} className="w-full border border-white/10 p-4 text-white font-bold mb-2 rounded-xl">English</button>
            <button type="button" onClick={() => { setLanguage('UR'); setIsLanguageOpen(false); }} className="w-full border border-white/10 p-4 text-white font-bold rounded-xl">Urdu</button>
          </div>
        </div>
      )}
    </div>
  );
}