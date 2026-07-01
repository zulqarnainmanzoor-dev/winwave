import React from "react";
import {
  LayoutDashboard,
  Gamepad2,
  History,
  Users,
  DollarSign,
  UserCheck,
  Settings,
  LogOut,
  ChevronDown,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useAdmin, type AdminPage } from "../context/AdminContext";

interface MenuItem {
  id: AdminPage;
  label: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
  badge?: number;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    id: "wingo",
    label: "Games Management",
    icon: <Gamepad2 className="w-5 h-5" />,
    submenu: [
      { id: "wingo", label: "WinGo", icon: <Zap className="w-4 h-4" /> },
      { id: "k3", label: "K3", icon: <Zap className="w-4 h-4" /> },
      { id: "trx", label: "TRX", icon: <Zap className="w-4 h-4" /> },
      { id: "5d", label: "5D", icon: <Zap className="w-4 h-4" /> },
    ],
  },
  {
    id: "game-history",
    label: "History Logs",
    icon: <History className="w-5 h-5" />,
    submenu: [
      { id: "game-history", label: "Game History", icon: <History className="w-4 h-4" /> },
      { id: "recharge-history", label: "Recharge History", icon: <History className="w-4 h-4" /> },
      { id: "bet-history", label: "Bet History", icon: <History className="w-4 h-4" /> },
      { id: "withdraw-history", label: "Withdraw History", icon: <History className="w-4 h-4" /> },
    ],
  },
  {
    id: "members",
    label: "Member Management",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "deposit-requests",
    label: "Funds Management",
    icon: <DollarSign className="w-5 h-5" />,
    submenu: [
      { id: "deposit-requests", label: "Deposit Requests", icon: <DollarSign className="w-4 h-4" />, badge: 12 },
      { id: "withdraw-requests", label: "Withdraw Requests", icon: <DollarSign className="w-4 h-4" />, badge: 8 },
    ],
  },
  {
    id: "agents",
    label: "Agent Management",
    icon: <UserCheck className="w-5 h-5" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="w-5 h-5" />,
  },
  {
    id: "gift-codes",
    label: "Gift Codes",
    icon: <Zap className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, adminRole } = useAdmin();
  const [expandedMenu, setExpandedMenu] = React.useState<AdminPage | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Filter menu items based on admin role
  const getMenuItems = (): MenuItem[] => {
    if (adminRole === 'sub-admin') {
      // Sub-admin can only see Agent Management
      return MENU_ITEMS.filter(item => item.id === 'agents');
    }
    // Main admin sees all items
    return MENU_ITEMS;
  };

  const menuItems = getMenuItems();

  const handleMenuClick = (item: MenuItem) => {
    if (item.submenu) {
      setExpandedMenu(expandedMenu === item.id ? null : item.id);
    } else {
      setCurrentPage(item.id as AdminPage);
      setExpandedMenu(null);
      setIsMenuOpen(false);
    }
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.submenu) {
      return item.submenu.some((sub) => sub.id === currentPage);
    }
    return item.id === currentPage;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('admin_role');
    window.location.href = '/#/admin/login';
  };

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  return (
    <>
      {/* Mobile header with drawer button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0b1223] border-b border-[#0f3460] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">⚙️</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">WinWave Admin</h2>
            <p className="text-gray-400 text-xs">Control Panel</p>
          </div>
        </div>
        <button
          onClick={toggleMenu}
          className="text-white rounded-lg border border-white/10 p-2 hover:bg-white/5 transition"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border-r border-[#0f3460] h-screen overflow-y-auto flex flex-col transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:w-64`}>
        {/* Header */}
        <div className="p-6 border-b border-[#0f3460] md:mt-0 mt-14">
          <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">⚙️</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">WinWave Admin</h2>
            <p className="text-gray-400 text-xs">
              {adminRole === 'sub-admin' ? 'Sub-Admin Panel' : 'Control Panel'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                isMenuActive(item)
                  ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white shadow-lg shadow-red-500/30"
                  : "text-gray-400 hover:bg-[#0f3460] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isMenuActive(item) ? "text-white" : "text-gray-500"}>
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.submenu && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    expandedMenu === item.id ? "rotate-180" : ""
                  }`}
                />
              )}
              {item.badge && (
                <span className="ml-auto bg-[#e94560] text-white text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>

            {/* Submenu */}
            {item.submenu && expandedMenu === item.id && (
              <div className="ml-4 mt-1 space-y-1">
                {item.submenu.map((subitem) => (
                  <button
                    key={subitem.id}
                    onClick={() => {
                      setCurrentPage(subitem.id as AdminPage);
                      setExpandedMenu(null);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                      currentPage === subitem.id
                        ? "bg-[#e94560] text-white font-medium"
                        : "text-gray-400 hover:bg-[#0f3460] hover:text-white"
                    }`}
                  >
                    {subitem.icon}
                    <span>{subitem.label}</span>
                    {subitem.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                        {subitem.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#0f3460]">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-[#0f3460] rounded-lg transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
        <p className="text-gray-600 text-xs mt-4 text-center">© 2026 WinWave</p>
      </div>
    </aside>

      {/* Mobile backdrop */}
      {isMenuOpen && (
        <button
          onClick={toggleMenu}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-label="Close menu"
        />
      )}
    </>
  );
}
