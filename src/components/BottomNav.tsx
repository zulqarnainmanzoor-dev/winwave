import { Handshake, Gift, Gamepad2, Wallet, UserCircle } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0F0F11] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-50 border-t border-white/5">
      <div className="flex justify-around items-end h-[72px] pb-3 relative px-2">
        <NavItem 
          icon={<Handshake strokeWidth={2} />} 
          label={t('promotion')} 
          isActive={activeTab === 'promotion'}
          onClick={() => onTabChange('promotion')}
        />
        <NavItem 
          icon={<Gift strokeWidth={2} />} 
          label={t('activity')} 
          isActive={activeTab === 'activity'}
          onClick={() => onTabChange('activity')}
        />

        {/* Center Home Button */}
        <div 
          className="flex flex-col items-center justify-end relative h-full cursor-pointer w-[20%] group"
          onClick={() => onTabChange('home')}
        >
          <div className={`absolute -top-7 w-[60px] h-[60px] bg-gradient-to-b rounded-2xl rotate-45 flex items-center justify-center shadow-lg border-4 border-[#0A0A0B] transition-transform group-hover:scale-105 ${activeTab === 'home' ? 'from-amber-400 to-amber-600 shadow-amber-500/20' : 'from-[#2A2A2E] to-[#1C1C1F] shadow-black/50'}`}>
            <div className="-rotate-45">
              <Gamepad2 className={`${activeTab === 'home' ? 'text-black' : 'text-gray-400'} w-6 h-6 drop-shadow-sm`} fill="currentColor" strokeWidth={1} />
            </div>
          </div>
          <span className={`text-[10px] font-black tracking-widest uppercase mt-auto ${activeTab === 'home' ? 'text-amber-500' : 'text-gray-600 group-hover:text-gray-400'}`}>{t('home')}</span>
        </div>

        <NavItem 
          icon={<Wallet strokeWidth={2} />} 
          label={t('wallet')} 
          isActive={activeTab === 'wallet'}
          onClick={() => onTabChange('wallet')}
        />
        <NavItem 
          icon={<UserCircle strokeWidth={2} />} 
          label={t('account')} 
          isActive={activeTab === 'account'}
          onClick={() => onTabChange('account')}
        />
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div 
      className={`flex flex-col items-center justify-end gap-[4px] cursor-pointer w-[20%] transition-colors ${isActive ? 'text-amber-500' : 'text-gray-600 hover:text-gray-300'}`}
      onClick={onClick}
    >
      <div className="w-[20px] h-[20px] [&>svg]:w-full [&>svg]:h-full">{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
    </div>
  );
}
