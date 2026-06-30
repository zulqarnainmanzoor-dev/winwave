import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Lock,
  ClipboardList,
  History,
  Info,
  Award,
  Coins,
  Gem
} from "lucide-react";
import { useUser, VIP_TIERS } from "../context/UserContext";
import { VipBadgeImage } from "./VipBadgeImage";

export default function VIPView({
  initialLevel,
  onBack
}: {
  initialLevel?: number;
  onBack: () => void;
}) {
  const { cumulativeWager, vipLevel, balance, setBalance } = useUser();
  const [selectedLevel, setSelectedLevel] = useState<number>(0);

  // Set initial level on mount
  useEffect(() => {
    if (initialLevel !== undefined) {
      setSelectedLevel(initialLevel);
    } else {
      setSelectedLevel(vipLevel);
    }
  }, [initialLevel, vipLevel]);

  // Track claimed level-up rewards in localStorage
  const [claimedRewards, setClaimedRewards] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem("claimed_vip_rewards");
    return saved ? JSON.parse(saved) : {};
  });

  const handleClaimReward = (level: number) => {
    if (vipLevel < level) return;
    if (claimedRewards[level]) return;

    const rewardAmount = VIP_TIERS[level].levelUpReward;
    setBalance(balance + rewardAmount);

    const updated = { ...claimedRewards, [level]: true };
    setClaimedRewards(updated);
    localStorage.setItem("claimed_vip_rewards", JSON.stringify(updated));
    alert(`Congratulations! You have claimed your VIP ${level} Level Up Reward of Rs ${rewardAmount.toLocaleString()}`);
  };

  // Helper to format currency
  const formatNum = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Get current and next level wagers
  const currentTier = VIP_TIERS[vipLevel] || VIP_TIERS[0];
  const experiencePoints = cumulativeWager / 100;
  const requiredExp = currentTier.requiredWager / 100;
  const progressPercent = Math.min(100, (experiencePoints / requiredExp) * 100);

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen animate-slide-up text-gray-200">
      {/* Top Navbar matched with Website's Charcoal Header */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 relative z-10 flex-shrink-0">
        <button 
          id="vip-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-sm font-black tracking-widest flex-1 text-center pr-9 uppercase">VIP Club</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Main Content Area */}
        <div className="p-4 space-y-4">
          
          {/* Premium Charcoal & Gray Theme VIP Top Card with Matte Metallic finish and Orange accent */}
          <div className="bg-[#1C1C1E] rounded-3xl p-5 shadow-[0_12px_24px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden flex items-center gap-4">
            <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute left-1/3 bottom-0 w-24 h-24 bg-zinc-700/10 rounded-full blur-2xl pointer-events-none" />

            {/* VIP Badge with custom Image tag support */}
            <div className="relative flex-shrink-0">
              <VipBadgeImage level={vipLevel} size="lg" />
            </div>

            {/* Information and Progress Bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white text-lg font-black tracking-tight">VIP {vipLevel}</h2>
                <div className="flex items-center gap-2">
                  <button className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-white/5">
                    <ClipboardList className="w-4 h-4 text-[#ffa502]" />
                  </button>
                  <button className="w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-white/5">
                    <History className="w-4 h-4 text-[#ffa502]" />
                  </button>
                </div>
              </div>

              {/* Progress Text */}
              <div className="flex items-center justify-between mt-1 mb-1.5 text-[11px] text-gray-400 font-bold">
                <span>EXP: {formatNum(experiencePoints)}</span>
                <span className="text-gray-500">/ {formatNum(requiredExp)}</span>
              </div>

              {/* Progress Bar Container */}
              <div className="h-2 w-full bg-[#0A0A0B] border border-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Horizontally scrolling Benefit/Bonus Previews in Clean Dark Charcoal Theme */}
          <div className="flex gap-3 overflow-x-auto py-1 no-scrollbar scroll-smooth snap-x">
            {selectedLevel === 0 ? (
              <>
                {/* VIP0 Previews */}
                <div className="bg-[#1C1C1E] rounded-2xl p-3 shadow-md border border-white/5 min-w-[160px] flex-shrink-0 flex items-center gap-3 snap-start">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#ffa502]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 8 L12 10" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 14 L12 16" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-400 text-[10px] leading-tight">Daily Withdrawal</h4>
                    <span className="text-[#ffa502] font-black text-xs mt-0.5 block">3/3</span>
                  </div>
                </div>

                <div className="flex items-center text-zinc-500 px-2">➔</div>

                <div className="bg-[#1C1C1E] rounded-2xl p-3 shadow-md border border-white/5 min-w-[160px] flex-shrink-0 flex items-center gap-3 snap-start">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <Coins className="w-6 h-6 text-[#ffa502]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-400 text-[10px] leading-tight">Fee-free Trans.</h4>
                    <span className="text-[#ffa502] font-black text-xs mt-0.5 block">∞</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Higher VIP Weekly/Monthly Bonus Previews */}
                <div className="bg-[#1C1C1E] rounded-2xl p-3 shadow-md border border-white/5 min-w-[160px] flex-shrink-0 flex items-center gap-3 relative overflow-hidden snap-start">
                  {vipLevel < selectedLevel && (
                    <div className="absolute top-1.5 right-1.5 bg-[#0A0A0B]/80 p-1 rounded-md border border-white/5">
                      <Lock className="w-3 h-3 text-[#ffa502]" />
                    </div>
                  )}
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-[#ffa502]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-400 text-[10px] leading-tight">Weekly Bonus</h4>
                    <span className="text-[#ffa502] font-black text-xs mt-0.5 block">
                      Rs {VIP_TIERS[selectedLevel].weeklyReward.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-zinc-700 px-0.5">➔</div>

                <div className="bg-[#1C1C1E] rounded-2xl p-3 shadow-md border border-white/5 min-w-[160px] flex-shrink-0 flex items-center gap-3 relative overflow-hidden snap-start">
                  {vipLevel < selectedLevel && (
                    <div className="absolute top-1.5 right-1.5 bg-[#0A0A0B]/80 p-1 rounded-md border border-white/5">
                      <Lock className="w-3 h-3 text-[#ffa502]" />
                    </div>
                  )}
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <Gem className="w-6 h-6 text-[#ffa502]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-400 text-[10px] leading-tight">Monthly Bonus</h4>
                    <span className="text-[#ffa502] font-black text-xs mt-0.5 block">
                      Rs {VIP_TIERS[selectedLevel].monthlyReward.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Split Panel Layout: Sidebar (Left) vs Detail Panel (Right) */}
          <div className="grid grid-cols-12 gap-3 items-start">
            
            {/* Left Sidebar Level Picker - Clean, no secondary vertical scroll bar, fits fully inside */}
            <div className="col-span-4 bg-[#1C1C1E] border border-white/5 rounded-2xl p-1.5 space-y-1.5 shadow-inner">
              {VIP_TIERS.map((tier) => {
                const isSelected = selectedLevel === tier.level;
                const isCurrent = vipLevel === tier.level;
                const isLocked = vipLevel < tier.level;

                return (
                  <button
                    key={tier.level}
                    onClick={() => setSelectedLevel(tier.level)}
                    className={`w-full flex flex-col items-center justify-center py-2 rounded-xl transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? "bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/10 border border-orange-400/30"
                        : "bg-[#2C2C2E] hover:bg-[#3A3A3C] text-gray-300 border border-white/5"
                    }`}
                  >
                    <div className="scale-75 -my-2.5">
                      <VipBadgeImage level={tier.level} size="sm" />
                    </div>
                    <span className={`text-[9px] uppercase font-black tracking-wider mt-1.5 ${isSelected ? "text-amber-100" : "text-gray-400"}`}>
                      VIP {tier.level}
                    </span>
                    {isCurrent && (
                      <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${isSelected ? "text-white" : "text-amber-500"}`}>
                        Current
                      </span>
                    )}
                    {isLocked && !isSelected && (
                      <Lock className="w-2.5 h-2.5 text-gray-500 absolute top-1.5 right-1.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Detail Panel for Selected Level */}
            <div className="col-span-8 space-y-3.5">
              
              {selectedLevel === 0 ? (
                <>
                  {/* VIP0 Benefits (Plain text no rewards) */}
                  <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-md border border-white/5 text-center py-10">
                    <h3 className="font-black text-white text-sm tracking-wide mb-2">VIP0 Benefits</h3>
                    <p className="text-xs text-gray-500 font-bold leading-relaxed">No benefits available for VIP0</p>
                  </div>

                  <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-md border border-white/5 text-center py-10">
                    <p className="text-xs text-gray-500 font-bold">No reward available</p>
                  </div>
                </>
              ) : (
                <>
                  {/* Level Maintenance Requirement */}
                  <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-md border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block mb-1">
                      Level maintenance
                    </span>
                    <div className="bg-[#0A0A0B] border border-white/5 rounded-xl p-3 mt-1.5">
                      <span className="text-[10px] font-bold text-gray-500 block uppercase">Bet Requirement</span>
                      <span className="text-amber-500 text-base font-black tracking-tight mt-0.5 block">
                        Rs {VIP_TIERS[selectedLevel].maintenance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* VIP Level Benefits Detail Card */}
                  <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-md border border-white/5">
                    <h3 className="font-black text-white text-sm tracking-wide mb-3 text-center">
                      VIP {selectedLevel} Benefits
                    </h3>
                    <div className="space-y-3 mt-1">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold text-gray-400">Weekly reward</span>
                        <span className="text-amber-500 font-black text-xs">
                          Rs {VIP_TIERS[selectedLevel].weeklyReward.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-gray-400">Monthly reward</span>
                        <span className="text-amber-500 font-black text-xs">
                          Rs {VIP_TIERS[selectedLevel].monthlyReward.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Level Up Reward & Claim Button */}
                  <div className="bg-[#1C1C1E] rounded-2xl p-4 shadow-md border border-white/5 text-center space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider block">
                        Level up reward
                      </span>
                      <span className="text-amber-500 text-lg font-black tracking-tight block">
                        Rs {VIP_TIERS[selectedLevel].levelUpReward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Claim/Receive Button */}
                    <button
                      id={`vip-claim-btn-${selectedLevel}`}
                      onClick={() => handleClaimReward(selectedLevel)}
                      disabled={vipLevel < selectedLevel || claimedRewards[selectedLevel]}
                      className={`w-full py-2.5 rounded-full font-black text-sm tracking-wide transition-all ${
                        claimedRewards[selectedLevel]
                          ? "bg-[#0A0A0B] text-gray-500 border border-white/5 cursor-not-allowed"
                          : vipLevel >= selectedLevel
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:brightness-110 hover:shadow-orange-500/30 active:scale-95 cursor-pointer"
                          : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                      }`}
                    >
                      {claimedRewards[selectedLevel] ? "Claimed" : "Receive"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick FAQ info panel at the very bottom */}
          <div className="bg-[#1C1C1E]/40 border border-orange-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-gray-400 mt-2">
            <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-gray-200">VIP Upgrade Rules</h5>
              <p className="text-[11px] leading-relaxed text-gray-400">
                Upgrades occur automatically once the betting requirement is satisfied. Monthly rewards can be claimed on the 1st of every month, while Weekly rewards are available each Monday.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
