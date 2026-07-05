import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabaseClient';
import { Award, UserPlus, Coins, Trophy, Gift, Check, X, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';

// Day config: deposit required to unlock, reward amount
const DAYS = [
  { day: 1, depositRequired: 500,   reward: 7 },
  { day: 2, depositRequired: 1000,  reward: 20 },
  { day: 3, depositRequired: 1500,  reward: 100 },
  { day: 4, depositRequired: 2000,  reward: 200 },
  { day: 5, depositRequired: 3000,  reward: 450 },
  { day: 6, depositRequired: 5000,  reward: 2400 },
  { day: 7, depositRequired: 10000, reward: 5000 },
];

interface ClaimedDay { day_number: number; reward_amount: number; claimed_at: string; }

export default function ActivityView() {
  const { t } = useLanguage();
  const { uid, mainWalletBalance, setBalance, balance, wageringRequired, setWageringRequired } = useUser();

  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isGiftsModalOpen, setIsGiftsModalOpen]     = useState(false);
  const [claimedDays, setClaimedDays]               = useState<ClaimedDay[]>([]);
  const [totalDeposited, setTotalDeposited]         = useState(0);
  const [giftCode, setGiftCode]                     = useState('');
  const [toast, setToast]                           = useState<{ msg: string; ok: boolean } | null>(null);
  const [claiming, setClaiming]                     = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Load claimed days + total deposits from Supabase
  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const { data: claimed } = await supabase
        .from('attendance_bonus')
        .select('day_number, reward_amount, claimed_at')
        .eq('user_id', uid)
        .order('day_number');
      setClaimedDays(claimed || []);

      const { data: txs } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', uid)
        .eq('type', 'deposit')
        .eq('status', 'completed');
      const total = (txs || []).reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
      setTotalDeposited(total);
    };
    void load();
  }, [uid]);

  // Determine current streak and next claimable day
  const claimedDayNumbers = claimedDays.map(d => d.day_number);
  // Streak: consecutive from day 1
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    if (claimedDayNumbers.includes(i)) streak = i;
    else break;
  }
  const nextDay = streak + 1; // next day to claim (1-7)
  const accumulated = claimedDays.reduce((s, d) => s + Number(d.reward_amount ?? 0), 0);

  const handleClaim = async (dayNum: number) => {
    if (!uid) { showToast('Please log in first.', false); return; }
    if (claimedDayNumbers.includes(dayNum)) { showToast('Already claimed this day.', false); return; }
    if (dayNum !== nextDay) { showToast(`Complete Day ${nextDay} first.`, false); return; }

    const dayConfig = DAYS[dayNum - 1];

    // Check deposit requirement
    if (totalDeposited < dayConfig.depositRequired) {
      showToast(`Deposit at least Rs ${dayConfig.depositRequired.toLocaleString()} to claim Day ${dayNum}.`, false);
      return;
    }

    // Check 24h gap from previous claim (if not day 1)
    if (dayNum > 1) {
      const prevClaim = claimedDays.find(d => d.day_number === dayNum - 1);
      if (prevClaim) {
        const prevTime = new Date(prevClaim.claimed_at).getTime();
        const now = Date.now();
        if (now - prevTime < 24 * 60 * 60 * 1000) {
          const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - prevTime)) / 3600000);
          showToast(`Come back in ${hoursLeft}h to claim Day ${dayNum}.`, false);
          return;
        }
      }
    }

    setClaiming(true);
    try {
      // Insert claim record
      const { error: insertErr } = await supabase.from('attendance_bonus').insert({
        user_id: uid,
        day_number: dayNum,
        reward_amount: dayConfig.reward,
        deposit_amount: totalDeposited,
      });
      if (insertErr) throw insertErr;

      // Credit reward to main_balance + add to wagering
      const { data: userRow } = await supabase.from('users').select('main_balance, wagering_required').eq('id', uid).maybeSingle();
      const newBal = Number(userRow?.main_balance ?? 0) + dayConfig.reward;
      const newWager = Number(userRow?.wagering_required ?? 0) + dayConfig.reward;

      await supabase.from('users').update({ main_balance: newBal, wagering_required: newWager }).eq('id', uid);

      setClaimedDays(prev => [...prev, { day_number: dayNum, reward_amount: dayConfig.reward, claimed_at: new Date().toISOString() }]);
      setBalance(balance + dayConfig.reward);
      setWageringRequired(newWager);
      showToast(`Rs ${dayConfig.reward} claimed! Wagering required to withdraw.`, true);
    } catch (err: any) {
      showToast(err?.message || 'Claim failed.', false);
    } finally {
      setClaiming(false);
    }
  };

  const handleRedeemGift = async () => {
    if (!giftCode.trim()) return;
    if (!uid) { showToast('Please log in first.', false); return; }
    const code = giftCode.trim().toUpperCase();

    try {
      // Check already claimed
      const { data: existing } = await supabase
        .from('gift_code_claims')
        .select('id')
        .eq('user_id', uid)
        .eq('gift_code', code)
        .maybeSingle();
      if (existing) { showToast('You already claimed this code.', false); return; }

      // Fetch gift code
      const { data: gc } = await supabase
        .from('gift_codes')
        .select('id, amount, status')
        .eq('code', code)
        .eq('status', 'active')
        .maybeSingle();
      if (!gc) { showToast('Invalid or expired gift code.', false); return; }

      const reward = Number(gc.amount ?? 0);

      // Credit balance + wagering
      const { data: userRow } = await supabase.from('users').select('main_balance, wagering_required').eq('id', uid).maybeSingle();
      const newBal   = Number(userRow?.main_balance ?? 0) + reward;
      const newWager = Number(userRow?.wagering_required ?? 0) + reward;
      await supabase.from('users').update({ main_balance: newBal, wagering_required: newWager }).eq('id', uid);

      // Record claim
      await supabase.from('gift_code_claims').insert({ user_id: uid, gift_code: code, amount: reward });

      setBalance(balance + reward);
      setWageringRequired(newWager);
      setGiftCode('');
      showToast(`Rs ${reward.toLocaleString()} added! Complete wagering to withdraw.`, true);
    } catch (err: any) {
      showToast(err?.message || 'Redemption failed.', false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1A1A1D] animate-slide-up pb-[100px] overflow-y-auto relative z-10">
      <div className="p-4 bg-[#121214] border-b border-white/5 sticky top-0 z-20">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-orange-500 font-bold text-xl tracking-[0.2em] font-mono">Activity</h2>
          <p className="text-white font-bold text-[11px] tracking-[0.15em] font-mono">Please remember to follow the event page</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-6 gap-2">
          <TopIcon icon={<Award className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('activityAward')} />
          <TopIcon icon={<UserPlus className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('invitationBonus')} />
          <TopIcon icon={<Coins className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('bettingRebate')} />
          <TopIcon icon={<Trophy className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('superJackpot')} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#2B2735] rounded-xl overflow-hidden cursor-pointer border border-white/5 shadow-md flex flex-col h-full" onClick={() => setIsGiftsModalOpen(true)}>
            <div className="h-28 bg-[#15151a] flex items-center justify-center overflow-hidden">
              <img src="/assets/svg/Gifts.png" alt="Gifts" className="w-full h-full object-cover" onError={e => e.currentTarget.style.display='none'} />
            </div>
            <div className="p-3"><h3 className="text-amber-500 font-bold text-sm mb-1">{t('gifts')}</h3><p className="text-gray-400 text-[10px]">{t('giftsDesc')}</p></div>
          </div>
          <div className="bg-[#2B2735] rounded-xl overflow-hidden cursor-pointer border border-white/5 shadow-md flex flex-col h-full" onClick={() => setIsCheckInModalOpen(true)}>
            <div className="h-28 bg-[#15151a] flex items-center justify-center overflow-hidden">
              <img src="/assets/svg/Attendence Bonus.png" alt="Attendance" className="w-full h-full object-cover" onError={e => e.currentTarget.style.display='none'} />
            </div>
            <div className="p-3"><h3 className="text-amber-500 font-bold text-sm mb-1">{t('attendanceBonus')}</h3><p className="text-gray-400 text-[10px]">{t('attendanceDesc')}</p></div>
          </div>
        </div>

      </div>

      {/* Attendance Modal */}
      {isCheckInModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#1A1A1D] animate-slide-up">
          <div className="flex items-center justify-between p-4 bg-[#1A1A1D] border-b border-white/5 sticky top-0 z-50">
            <ChevronLeft className="w-6 h-6 text-amber-500 cursor-pointer" onClick={() => setIsCheckInModalOpen(false)} />
            <span className="text-amber-500 font-bold text-lg">{t('attendanceBonus')}</span>
            <div className="w-6 h-6" />
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            <div className="bg-[#EF4444] p-5 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-white font-bold text-xl mb-1">{t('attendanceBonus')}</h2>
                <p className="text-white/90 text-xs mb-4">Deposit daily to claim consecutive rewards</p>

                <div className="bg-white text-[#EF4444] rounded-r-full py-2 px-4 inline-flex flex-col mb-4 -ml-5 shadow-md">
                  <span className="text-[11px] font-medium">Attended consecutively</span>
                  <span className="font-bold text-lg">{streak} <span className="text-xs font-normal text-gray-500">Day</span></span>
                </div>

                <div className="mb-4">
                  <p className="text-white/90 text-xs mb-0.5">Accumulated (total claimed)</p>
                  <p className="text-white font-bold text-xl">Rs {accumulated.toLocaleString()}</p>
                </div>

                <div className="text-white/80 text-xs">
                  Your total deposits: <span className="font-bold text-white">Rs {totalDeposited.toLocaleString()}</span>
                </div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-90">
                <img src="/assets/svg/Attendence Bonus.png" alt="" className="w-full h-full object-contain" onError={e => e.currentTarget.style.display='none'} />
              </div>
            </div>

            <div className="p-4 grid grid-cols-3 gap-3">
              {DAYS.map(d => {
                const isClaimed = claimedDayNumbers.includes(d.day);
                const isNext    = d.day === nextDay;
                const canClaim  = isNext && totalDeposited >= d.depositRequired;

                return (
                  <div
                    key={d.day}
                    onClick={() => !isClaimed && handleClaim(d.day)}
                    className={`bg-[#2B2735] rounded-xl p-3 flex flex-col items-center justify-center border transition-colors shadow-md ${
                      isClaimed ? 'border-emerald-500/40 opacity-70' :
                      canClaim  ? 'border-amber-500/60 cursor-pointer hover:bg-[#332f3d]' :
                                  'border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-white text-xs font-bold mb-1">Rs {d.reward.toLocaleString()}</span>
                    <div className="w-10 h-10 mb-1 relative bg-amber-500/20 rounded-full flex items-center justify-center">
                      <Award className="w-5 h-5 text-amber-400" />
                      {isClaimed && (
                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                          <Check className="text-emerald-400 w-6 h-6" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="text-gray-400 text-[10px]">Day {d.day}</span>
                    <span className="text-[9px] text-gray-500 mt-0.5">Dep: Rs {d.depositRequired.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {toast && (
            <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] flex items-center gap-2 ${toast.ok ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              {toast.ok ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <span className="text-sm font-bold">{toast.msg}</span>
            </div>
          )}
        </div>
      )}

      {/* Gift Modal */}
      {isGiftsModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#1A1A1D] animate-slide-up">
          <div className="flex items-center justify-between p-4 bg-[#1A1A1D] sticky top-0 z-50">
            <ChevronLeft className="w-6 h-6 text-amber-500 cursor-pointer" onClick={() => setIsGiftsModalOpen(false)} />
            <span className="text-amber-500 font-bold text-lg">{t('gifts')}</span>
            <div className="w-6 h-6" />
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            <div className="h-48 w-full bg-[#15151a] overflow-hidden">
              <img src="/assets/svg/Gifts.png" alt="" className="w-full h-full object-cover" onError={e => e.currentTarget.style.display='none'} />
            </div>
            <div className="p-4">
              <div className="bg-[#2B2735] rounded-xl p-5 shadow-lg border border-white/5 mb-4">
                <p className="text-white/70 text-sm mb-4">{t('weHaveAGiftForYou')}</p>
                <p className="text-amber-500 text-sm mb-3 font-medium">{t('pleaseEnterGiftCodeBelow')}</p>
                <input
                  type="text"
                  value={giftCode}
                  onChange={e => setGiftCode(e.target.value)}
                  placeholder={t('pleaseEnterGiftCode')}
                  className="w-full bg-[#1C1C1F] text-white rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 border border-white/5 mb-4 placeholder-white/30 uppercase"
                />
                <button onClick={handleRedeemGift} className="w-full bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] text-black font-bold py-3 rounded-full hover:opacity-90 transition-opacity shadow-md">
                  {t('receive')}
                </button>
                <p className="text-[10px] text-gray-500 text-center mt-3">Claimed gift amounts require wagering before withdrawal.</p>
              </div>
            </div>
          </div>

          {toast && (
            <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] flex items-center gap-2 ${toast.ok ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              {toast.ok ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <span className="text-sm font-bold">{toast.msg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group w-1/4">
      <div className="w-14 h-14 rounded-full bg-[#1f2937] flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 border border-white/20">
        {icon}
      </div>
      <span className="text-[#a5a5a5] text-[10px] text-center font-medium leading-tight px-1 group-hover:text-white transition-colors">{label}</span>
    </div>
  );
}
