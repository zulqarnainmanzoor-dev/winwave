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
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

interface AuthViewProps {
  onLoginSuccess: (
    phoneNumber: string,
    userId?: string,
    profile?: { invite_code?: string; phone?: string },
    wallet?: { main_balance?: number; wagering_required?: number }
  ) => void;
  initialMode?: "login" | "register";
}

export default function AuthView({
  onLoginSuccess,
  initialMode = "login",
}: AuthViewProps) {
  const { language, t, setLanguage } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [rememberPassword, setRememberPassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  useEffect(() => {
    const storedPhone = localStorage.getItem('winwave_last_phone');
    if (storedPhone) {
      setPhone(storedPhone);
    }
  }, []);

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('winwave_device_id');
    if (!deviceId) {
      deviceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('winwave_device_id', deviceId);
    }
    return deviceId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      setError(language === 'EN' ? 'Please enter your phone number.' : 'براہ کرم اپنا فون نمبر درج کریں۔');
      return;
    }

    if (!password.trim()) {
      setError(language === 'EN' ? 'Please enter your password.' : 'براہ کرم اپنا پاس ورڈ درج کریں۔');
      return;
    }

    if (mode === 'register') {
      if (normalizedPhone.startsWith('0')) {
        setError(language === 'EN' ? 'The phone number cannot start with 0 when registering.' : 'رجسٹریشن کے وقت فون نمبر 0 سے شروع نہیں ہو سکتا۔');
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              phone: normalizedPhone,
              invitation_code: inviteCode.trim() || undefined,
            },
          },
        });

        if (error) {
          console.error('Registration error message:', error.message, 'full error:', error);
          setError(error.message);
          return;
        }

        localStorage.setItem('winwave_last_phone', normalizedPhone);
        setSuccess(language === 'EN' ? 'Registration complete. You can now log in.' : 'رجسٹریشن مکمل ہو گئی ہے۔ اب لاگ ان کریں۔');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setInviteCode('');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Login error message:', error.message, 'full error:', error);
          setError(error.message);
          return;
        }

        if (rememberPassword) {
          localStorage.setItem('winwave_last_phone', normalizedPhone);
        }

        onLoginSuccess(
          normalizedPhone,
          data.user?.id || normalizedPhone,
          undefined,
          undefined
        );
      }
    } catch (err: any) {
      console.error('AuthViewReact unexpected error:', err?.message, err);
      setError(err?.message || (language === 'EN' ? 'Authentication failed.' : 'توثیق ناکام ہو گئی۔'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 relative overflow-y-auto no-scrollbar">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,165,0,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div className="flex items-center justify-between p-4 z-40 bg-transparent flex-shrink-0">
        <button
          onClick={() => mode === "register" && setMode("login")}
          className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsLanguageOpen(true)}
            className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
          >
            <Headphones className="w-5 h-5 text-gray-300" />
          </button>
          <button
            type="button"
            onClick={() => setIsLanguageOpen(true)}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-full px-2.5 py-1 text-xs font-black text-white cursor-pointer active:scale-95 transition-all"
          >
            <img
              src={language === "EN" ? "https://flagcdn.com/w20/gb.png" : "https://flagcdn.com/w20/pk.png"}
              alt={language}
              className="w-4 h-2.5 object-cover rounded-px shadow-sm"
            />
            <span className="tracking-wider uppercase">{language}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-12 pt-6 z-10 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center select-none py-6 mb-8">
          <div className="text-4xl font-black italic tracking-wider bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,165,2,0.35)] uppercase">
            {t('brand')}
          </div>
          <div className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.4em] mt-2">
            Super Win Platform
          </div>
        </div>

        {success && (
          <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-3.5 text-xs text-center font-bold mb-6 flex items-center justify-center gap-2 animate-pulse">
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
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2"
              required
            />
          </div>
          <p className="text-[11px] text-gray-400 leading-5 mt-2 px-1">
            {language === 'EN'
              ? 'The phone number cannot start with 0 when registering! Example: 956521888'
              : 'رجسٹریشن کے وقت فون نمبر 0 سے شروع نہیں ہو سکتا! مثال: 956521888'}
          </p>

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
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-gray-400 hover:text-white p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'register' && password.length > 0 && (
            <div className="px-1 space-y-2">
              <div className="flex gap-1.5 h-1">
                <div className={`flex-1 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className={`flex-1 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-white/10'}`} />
                <div className={`flex-1 rounded-full ${/[A-Z]/.test(password) && /[0-9]/.test(password) ? 'bg-emerald-500' : 'bg-white/10'}`} />
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className={password.length >= 6 ? 'text-emerald-400' : 'text-red-400'}>
                  {password.length >= 6 ? '✓ 6+ Characters' : '✗ Min 6 Chars'}
                </span>
                <span className={/[A-Z]/.test(password) ? 'text-emerald-400' : 'text-gray-500'}>
                  {/[A-Z]/.test(password) ? '✓ Uppercase' : 'Lowercase'}
                </span>
                <span className={/[0-9]/.test(password) ? 'text-emerald-400' : 'text-gray-500'}>
                  {/[0-9]/.test(password) ? '✓ Number' : 'Digit'}
                </span>
              </div>
            </div>
          )}

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
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 text-gray-400 hover:text-white p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative flex items-center bg-[#161618] border border-white/10 rounded-2xl p-1.5 focus-within:border-[#ffa502]/50 transition-all shadow-md">
                <div className="p-2.5 text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder={language === 'EN' ? 'Invitation code (optional)' : 'انویٹیشن کوڈ (اختیاری)'}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm font-semibold py-2 pr-10"
                />
              </div>
            </>
          )}

          {mode === 'login' && (
            <div className="flex items-center justify-between text-xs font-bold pt-1 select-none">
              <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={() => setRememberPassword(!rememberPassword)}
                  className="rounded bg-[#161618] border-white/15 text-[#ffa502] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                <span>{t('rememberPassword')}</span>
              </label>
              <button
                type="button"
                onClick={() => setError(language === 'EN' ? 'Please contact support to reset your password' : 'براہ کرم پاس ورڈ تبدیل کرنے کے لیے سپورٹ سے رابطہ کریں')}
                className="text-[#ffa502] hover:brightness-110 transition-all"
              >
                {t('forgotPassword')}
              </button>
            </div>
          )}

          <div className="pt-6 space-y-4">
            {mode === 'register' && (
              <div className="flex justify-center select-none">
                <div className="bg-[#ffa502]/10 border border-[#ffa502]/30 text-[#ffa502] text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase flex items-center gap-1.5 animate-bounce shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffa502] inline-block animate-ping"></span>
                  🎁 Gift: +Rs 2-999
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-[#ffa502] hover:brightness-110 active:scale-95 text-black font-black py-4 rounded-full transition-all uppercase text-sm tracking-widest cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (mode === 'login' ? 'Logging in...' : 'Creating account...') : (mode === 'login' ? t('login') : t('register'))}
            </button>

            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full border border-[#ffa502]/30 hover:border-[#ffa502]/70 text-[#ffa502] hover:text-amber-400 active:scale-95 font-black py-4 rounded-full transition-all uppercase text-xs tracking-widest cursor-pointer bg-white/5"
                >
                  {t('registerNow')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full border border-white/10 hover:border-white/20 text-gray-300 hover:text-white active:scale-95 font-black py-4 rounded-full transition-all uppercase text-xs tracking-widest cursor-pointer bg-white/5"
              >
                {t('passwordLogin')}
              </button>
            )}
          </div>
        </form>
      </div>

      {isLanguageOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsLanguageOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-[#0A0A0B] border-t border-white/10 rounded-t-3xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-white">
                  {t('selectLanguage')}
                </div>
                <p className="text-xs text-gray-400">{t('tapToSwitchLanguage')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLanguageOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setLanguage('EN');
                  setIsLanguageOpen(false);
                }}
                className={`w-full border rounded-2xl p-4 flex items-center justify-between transition-all ${language === 'EN' ? 'border-[#ffa502] bg-white/5' : 'border-white/10 hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src="https://flagcdn.com/w40/gb.png"
                    alt="English"
                    className="w-6 h-4 object-cover rounded-sm shadow-sm"
                  />
                  <div>
                    <div className="text-white font-bold">English</div>
                    <div className="text-gray-400 text-xs">EN</div>
                  </div>
                </div>
                {language === 'EN' && (
                  <CheckCircle className="w-5 h-5 text-[#ffa502]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLanguage('UR');
                  setIsLanguageOpen(false);
                }}
                className={`w-full border rounded-2xl p-4 flex items-center justify-between transition-all ${language === 'UR' ? 'border-[#ffa502] bg-white/5' : 'border-white/10 hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src="https://flagcdn.com/w40/pk.png"
                    alt="Urdu"
                    className="w-6 h-4 object-cover rounded-sm shadow-sm"
                  />
                  <div>
                    <div className="text-white font-bold">Urdu</div>
                    <div className="text-gray-400 text-xs">UR</div>
                  </div>
                </div>
                {language === 'UR' && (
                  <CheckCircle className="w-5 h-5 text-[#ffa502]" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
