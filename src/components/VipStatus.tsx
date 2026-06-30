import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useUser, VIP_TIERS } from "../context/UserContext";
import { Pen, X, ChevronRight, Crown } from "lucide-react";
import { VipBadgeImage } from "./VipBadgeImage";

const AVATARS = [
  "/assets/avatar/Avatar 1.webp",
  "/assets/avatar/Avatar 2.webp",
  "/assets/avatar/Avatar 3.webp",
  "/assets/avatar/Avatar 4.webp",
  "/assets/avatar/Avatar 5.webp",
  "/assets/avatar/Avatar 6.webp",
  "/assets/avatar/Avatar 7.webp",
  "/assets/avatar/Avatar 8.webp",
];

export default function VipStatus({
  onViewBenefits,
}: {
  onViewBenefits?: (targetLevel?: number) => void;
}) {
  const { t } = useLanguage();
  const { username, setUsername, avatar, setAvatar, cumulativeWager, vipLevel, vipProgress } = useUser();
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);
  const [tempAvatar, setTempAvatar] = useState(avatar);

  const currentTier = VIP_TIERS[vipLevel] || VIP_TIERS[0];
  const nextTier = VIP_TIERS[Math.min(vipLevel + 1, VIP_TIERS.length - 1)] || currentTier;
  const experiencePoints = cumulativeWager / 100;
  const requiredExp = currentTier.requiredWager / 100;
  const nextRequiredExp = nextTier.requiredWager / 100;
  const progressPercent = vipProgress;
  const remainingExp = Math.max(0, nextRequiredExp - experiencePoints);

  const handleSaveUsername = () => {
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
    }
    setIsUsernameModalOpen(false);
  };

  const handleSaveAvatar = () => {
    setAvatar(tempAvatar);
    setIsAvatarModalOpen(false);
  };

  return (
    <>
      <div className="px-4 py-3">
        <div className="bg-[#1C1C1F] rounded-2xl border border-white/5 p-4 shadow-xl relative overflow-hidden">
          {/* Subtle VIP glow */}
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>

          <div className="flex items-start gap-4 relative z-10">
            {/* Avatar + VIP badge */}
            <div
              className="relative flex-shrink-0 cursor-pointer group"
              onClick={() => {
                setTempAvatar(avatar);
                setIsAvatarModalOpen(true);
              }}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] group-hover:shadow-[0_0_15px_rgba(245,158,11,0.6)] transition-all bg-[#2A2A2E]">
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-0 right-0 bg-amber-500 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1C1C1F] z-10">
                <Pen className="w-2.5 h-2.5 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 z-20 pointer-events-none">
                <div className="w-5 h-5 rounded-md overflow-hidden border border-amber-500/40 bg-[#0A0A0B] shadow-md flex items-center justify-center">
                  <div className="scale-[0.45] origin-center">
                    <VipBadgeImage level={vipLevel} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* User Info & VIP progress */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-white text-sm tracking-wide">{username}</span>
                <button 
                  onClick={() => {
                    setTempUsername(username);
                    setIsUsernameModalOpen(true);
                  }}
                  className="text-gray-400 hover:text-amber-500 transition-colors p-1"
                >
                  <Pen className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2 mb-1.5">
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Crown className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500 text-[10px] font-black uppercase italic tracking-wider">VIP {vipLevel}</span>
                </div>
                <span className="text-gray-400 text-[10px] font-bold">VIP {Math.min(vipLevel + 1, 10)}</span>
              </div>
              
              <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                <span>{experiencePoints.toFixed(0)} / {requiredExp.toLocaleString()} EXP</span>
                <span>{remainingExp.toFixed(0)} EXP to next VIP</span>
              </div>
              <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 mt-1">
                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Benefits Button */}
          <div className="flex justify-end mt-4">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
              onClick={() => onViewBenefits?.(vipLevel)}
              type="button"
            >
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{t('viewBenefits')}</span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Username Modal */}
      {isUsernameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsUsernameModalOpen(false)}></div>
          <div className="bg-[#1A1A1D] rounded-2xl w-full max-w-[320px] relative z-10 border border-white/10 shadow-2xl p-5 animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">{t('editUsername')}</h3>
              <button onClick={() => setIsUsernameModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input 
              type="text" 
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder={t('enterNewUsername')}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors mb-5 font-medium"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsUsernameModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveUsername}
                className="flex-1 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-colors"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Avatar Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}></div>
          <div className="bg-[#1A1A1D] rounded-2xl w-full max-w-[320px] relative z-10 border border-white/10 shadow-2xl p-5 animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">{t('selectAvatar')}</h3>
              <button onClick={() => setIsAvatarModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {AVATARS.map((av, index) => (
                <div 
                  key={index} 
                  onClick={() => setTempAvatar(av)}
                  className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all bg-[#2A2A2E] ${tempAvatar === av ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105' : 'border-transparent hover:border-white/20'}`}
                >
                  <img src={av} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsAvatarModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveAvatar}
                className="flex-1 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-colors"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
