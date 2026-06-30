import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { Award, UserPlus, Coins, Trophy, Gift, Calendar, Check, X, ChevronLeft, Lock, Calendar as CalendarIcon } from 'lucide-react';

const ATTENDANCE_KEY = 'winwave_attendance_claimed';

// Each day unlocks only once the user's cumulative deposit reaches its threshold.
const days = [
  { day: 1, reward: 7, requiredDeposit: 500 },
  { day: 2, reward: 20, requiredDeposit: 2000 },
  { day: 3, reward: 100, requiredDeposit: 5000 },
  { day: 4, reward: 200, requiredDeposit: 10000 },
  { day: 5, reward: 450, requiredDeposit: 30000 },
  { day: 6, reward: 2400, requiredDeposit: 80000 },
  { day: 7, reward: 5000, requiredDeposit: 200000 },
];

export default function ActivityView() {
  const { t } = useLanguage();
  const { totalDeposited, mainWalletBalance, setMainWalletBalance } = useUser();
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isGiftsModalOpen, setIsGiftsModalOpen] = useState(false);
  const [checkedInDays, setCheckedInDays] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(ATTENDANCE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [giftCode, setGiftCode] = useState('');
  const [toastMsg, setToastMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const claimedReward = checkedInDays.reduce((sum, day) => {
    const cfg = days.find((d) => d.day === day);
    return sum + (cfg ? cfg.reward : 0);
  }, 0);

  const handleCheckIn = (day: number) => {
    if (checkedInDays.includes(day)) return;
    const cfg = days.find((d) => d.day === day);
    if (!cfg) return;
    if (totalDeposited < cfg.requiredDeposit) {
      setToastMsg({
        msg: `Deposit Rs.${cfg.requiredDeposit.toLocaleString('en-US')} in total to unlock Day ${day}`,
        type: 'error',
      });
      return;
    }
    const updated = [...checkedInDays, day];
    setCheckedInDays(updated);
    setMainWalletBalance(mainWalletBalance + cfg.reward);
    try {
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    setToastMsg({ msg: `Rs.${cfg.reward.toLocaleString('en-US')} credited to your balance`, type: 'success' });
  };

  const handleRedeemGift = () => {
    if (!giftCode.trim()) return;
    // Mock codes
    const validCodes = ['B9GAME2024', 'BONUS100', 'WELCOME50'];
    if (validCodes.includes(giftCode.trim().toUpperCase())) {
      setToastMsg({ msg: t('codeSuccess'), type: 'success' });
      setGiftCode('');
    } else {
      setToastMsg({ msg: t('codeInvalid'), type: 'error' });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1A1A1D] animate-slide-up pb-[100px] overflow-y-auto relative z-10">
      <div className="p-4 bg-[#121214] border-b border-white/5 sticky top-0 z-20">
        <h2 className="text-white font-bold text-xl mb-1">{t('activity')}</h2>
        <p className="text-white/80 text-[11px] leading-snug">{t('activitySubtitle1')}</p>
        <p className="text-white/80 text-[11px] leading-snug">{t('activitySubtitle2')}</p>
      </div>

      <div className="p-4">
        {/* Top 4 Icons */}
        <div className="flex justify-between items-start mb-6 gap-2">
          <TopIcon icon={<Award className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('activityAward')} bg="bg-[#1f2937]" />
          <TopIcon icon={<UserPlus className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('invitationBonus')} bg="bg-[#1f2937]" />
          <TopIcon icon={<Coins className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('bettingRebate')} bg="bg-[#1f2937]" />
          <TopIcon icon={<Trophy className="w-6 h-6 text-white/90" strokeWidth={1.5} />} label={t('superJackpot')} bg="bg-[#1f2937]" />
        </div>

        {/* 2 Grid Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div 
            className="bg-[#2B2735] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/5 shadow-md flex flex-col h-full"
            onClick={() => setIsGiftsModalOpen(true)}
          >
            <div className="h-28 bg-[#15151a] flex items-center justify-center relative overflow-hidden">
              <img src="/assets/svg/Gifts.png" alt="Gifts" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement?.classList.add('p-4'); }} />
              <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-black/20 via-black/0 to-black/60"></div>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <h3 className="text-amber-500 font-bold text-sm mb-1">{t('gifts')}</h3>
              <p className="text-gray-400 text-[10px] leading-tight">{t('giftsDesc')}</p>
            </div>
          </div>
          
          <div 
            className="bg-[#2B2735] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/5 shadow-md flex flex-col h-full"
            onClick={() => setIsCheckInModalOpen(true)}
          >
            <div className="h-28 bg-[#15151a] flex items-center justify-center relative overflow-hidden">
              <img src="/assets/svg/Attendence Bonus.png" alt="Attendance" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement?.classList.add('p-4'); }} />
              <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-black/20 via-black/0 to-black/60"></div>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <h3 className="text-amber-500 font-bold text-sm mb-1">{t('attendanceBonus')}</h3>
              <p className="text-gray-400 text-[10px] leading-tight">{t('attendanceDesc')}</p>
            </div>
          </div>
        </div>

        {/* Bottom Banners */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          {[
            "/assets/banners/Winwave Code Bonus.jpeg",
            "/assets/banners/Join Win wave as an Agent.jpeg",
            "/assets/banners/scam Alert.jpeg",
            "/assets/banners/VIP Rebate Bonus.jpeg",
          ].map((src, index) => (
            <div key={index} className="h-40 rounded-3xl overflow-hidden border border-white/10 shadow-xl bg-[#111827] relative">
              <img
                src={src}
                alt={`Banner ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {isCheckInModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#1A1A1D] animate-slide-up">
          <div className="flex items-center justify-between p-4 bg-[#1A1A1D] border-b border-white/5 sticky top-0 z-50">
            <ChevronLeft className="w-6 h-6 text-amber-500 cursor-pointer" onClick={() => setIsCheckInModalOpen(false)} />
            <span className="text-amber-500 font-bold text-lg">{t('attendanceBonus')}</span>
            <div className="w-6 h-6"></div> {/* Spacer */}
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {/* Red Header Area */}
            <div className="bg-[#EF4444] p-5 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-white font-bold text-xl mb-1">{t('attendanceBonus')}</h2>
                <p className="text-white/90 text-xs mb-4">Get rewards based on consecutive<br/>login days</p>
                
                <div className="bg-white text-[#EF4444] rounded-r-full py-2 px-4 inline-flex flex-col mb-4 -ml-5 shadow-md">
                  <span className="text-[11px] font-medium">Attended consecutively</span>
                  <span className="font-bold text-lg">{checkedInDays.length} <span className="text-xs font-normal text-gray-500">Day</span></span>
                </div>
                
                <div className="mb-4">
                  <p className="text-white/90 text-xs mb-0.5">Accumulated</p>
                  <p className="text-white font-bold text-xl">Rs.{claimedReward.toFixed(2)}</p>
                </div>
                
                <div className="flex gap-4">
                  <button className="bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:scale-105 transition-transform">
                    Game Rules
                  </button>
                  <button className="bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:scale-105 transition-transform">
                    Attendance history
                  </button>
                </div>
              </div>
              
              <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-90">
                <img src="/assets/svg/Attendence Bonus.png" alt="Calendar" className="w-full h-full object-contain drop-shadow-xl" onError={(e) => e.currentTarget.style.display='none'} />
              </div>
            </div>

            {/* Grid Area */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {days.map((d) => {
                const isClaimed = checkedInDays.includes(d.day);
                const isFinal = d.day === days.length;
                const isUnlocked = totalDeposited >= d.requiredDeposit;
                const iconSrc = isFinal ? "/assets/svg/Gift Box.png" : "/assets/svg/Coins.png";

                return (
                  <div
                    key={d.day}
                    onClick={() => handleCheckIn(d.day)}
                    className={`bg-[#2B2735] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer border transition-colors shadow-md ${isClaimed ? 'border-green-500/40' : isUnlocked ? 'border-amber-500/40 hover:bg-[#332f3d]' : 'border-white/5 opacity-70 hover:bg-[#332f3d]'}`}
                  >
                    <span className="text-white text-xs font-bold mb-2">Rs.{d.reward.toLocaleString('en-US')}.00</span>
                    <div className="w-12 h-12 mb-2 relative">
                       <img src={iconSrc} alt={isFinal ? "Gift Box" : "Coins"} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                       <div className="absolute inset-0 bg-[#F59E0B] rounded-full hidden flex items-center justify-center border-4 border-[#FBBF24] shadow-inner">
                         {isFinal ? <Gift className="w-6 h-6 text-white" /> : <Award className="w-6 h-6 text-white" />}
                       </div>
                       {isClaimed ? (
                         <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                           <Check className="text-green-500 w-8 h-8" strokeWidth={3} />
                         </div>
                       ) : !isUnlocked ? (
                         <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                           <Lock className="text-amber-400 w-6 h-6" />
                         </div>
                       ) : null}
                    </div>
                    <span className="text-gray-400 text-[11px]">{d.day} Day</span>
                    <span className="text-[9px] text-gray-500 mt-0.5 text-center leading-tight">Dep Rs.{d.requiredDeposit.toLocaleString('en-US')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isGiftsModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#1A1A1D] animate-slide-up">
          <div className="flex items-center justify-between p-4 bg-[#1A1A1D] sticky top-0 z-50">
            <ChevronLeft className="w-6 h-6 text-amber-500 cursor-pointer" onClick={() => setIsGiftsModalOpen(false)} />
            <span className="text-amber-500 font-bold text-lg">{t('gifts')}</span>
            <div className="w-6 h-6"></div> {/* Spacer */}
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            <div className="h-48 w-full relative bg-[#15151a] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-black/20 via-black/0 to-black/70"></div>
              <img src="/assets/svg/Gifts.png" alt="Gifts" className="w-full h-full object-cover z-10" onError={(e) => e.currentTarget.style.display='none'} />
            </div>

            <div className="p-4 -mt-6 relative z-20">
              <div className="bg-[#2B2735] rounded-xl p-5 shadow-lg border border-white/5 mb-4">
                <h3 className="text-white/70 text-sm mb-1">{t('hi')}</h3>
                <p className="text-white/70 text-sm mb-6">{t('weHaveAGiftForYou')}</p>
                
                <p className="text-amber-500 text-sm mb-3 font-medium">{t('pleaseEnterGiftCodeBelow')}</p>
                
                <input 
                  type="text" 
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                  placeholder={t('pleaseEnterGiftCode')}
                  className="w-full bg-[#1C1C1F] text-white rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 border border-white/5 mb-4 placeholder-white/30"
                />
                
                <button 
                  onClick={handleRedeemGift}
                  className="w-full bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] text-black font-bold py-3 rounded-full hover:opacity-90 transition-opacity shadow-md"
                >
                  {t('receive')}
                </button>
              </div>

              <div className="bg-[#2B2735] rounded-xl p-4 shadow-lg border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-[#332f3d] transition-colors">
                <CalendarIcon className="text-amber-500 w-5 h-5" />
                <span className="text-amber-500 text-sm font-medium">{t('history')}</span>
              </div>
            </div>
          </div>
          
          {toastMsg && (
            <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] animate-slide-up flex items-center gap-2 ${
              toastMsg.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {toastMsg.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <span className="text-sm font-bold">{toastMsg.msg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopIcon({ icon, label, bg }: { icon: React.ReactNode, label: string, bg: string }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group w-1/4">
      <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 border border-white/20`}>
        {icon}
      </div>
      <span className="text-[#a5a5a5] text-[10px] text-center font-medium leading-tight px-1 group-hover:text-white transition-colors">{label}</span>
    </div>
  );
}
