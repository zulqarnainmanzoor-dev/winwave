import { NavLink, useLocation } from 'react-router-dom';
import { Handshake, Gift, Gamepad2, Wallet, UserCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  to: string;
  icon: React.ReactNode;
  label: string;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      id: 'promotion',
      to: '/promotion',
      icon: <Handshake strokeWidth={2} size={20} />,
      label: t('promotion'),
    },
    {
      id: 'activity',
      to: '/activity',
      icon: <Gift strokeWidth={2} size={20} />,
      label: t('activity'),
    },
    {
      id: 'home',
      to: '/',
      icon: <Gamepad2 strokeWidth={2} size={20} />,
      label: t('home'),
    },
    {
      id: 'wallet',
      to: '/wallet',
      icon: <Wallet strokeWidth={2} size={20} />,
      label: t('wallet'),
    },
    {
      id: 'account',
      to: '/account',
      icon: <UserCircle strokeWidth={2} size={20} />,
      label: t('account'),
    },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0F0F11] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-50 border-t border-white/5">
      <div className="flex justify-around items-end h-[72px] pb-3 relative px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.id === 'home'}
            onClick={() => onTabChange(item.id)}
            className={({ isActive }) =>
              `flex flex-col items-center justify-end gap-1 w-[20%] transition-all duration-200 ${
                isActive ? 'text-amber-500 scale-110' : 'text-gray-600 hover:text-gray-300'
              }`
            }
          >
            <div className="w-[20px] h-[20px] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
              {item.icon}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest leading-tight">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;