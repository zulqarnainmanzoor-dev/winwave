import React, { useEffect, useState } from "react";
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
  X,
  Menu,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { useAdmin, type AdminPage } from "../context/AdminContext";
import { adminSupabase } from "../../lib/adminSupabase";

function usePendingCounts() {
  const [depositCount,  setDepositCount]  = useState(0);
  const [withdrawCount, setWithdrawCount] = useState(0);

  const fetch = async () => {
    const [{ count: d }, { count: w }] = await Promise.all([
      adminSupabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "deposit").eq("status", "pending"),
      adminSupabase.from("withdrawal_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setDepositCount(Number(d ?? 0));
    setWithdrawCount(Number(w ?? 0));
  };

  useEffect(() => {
    void fetch();
    const channel = adminSupabase
      .channel("sidebar-pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" },       fetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_history" }, fetch)
      .subscribe();
    return () => { void adminSupabase.removeChannel(channel); };
  }, []);

  return { depositCount, withdrawCount };
}

interface MenuItem { id: AdminPage; label: string; icon: React.ReactNode; submenu?: MenuItem[]; badge?: number; }

export function Sidebar() {
  const { currentPage, setCurrentPage, adminRole, setAdminRole } = useAdmin();
  const [expandedMenu, setExpandedMenu] = useState<AdminPage | null>(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const { depositCount, withdrawCount } = usePendingCounts();

  useEffect(() => {
    const role = sessionStorage.getItem("admin_role");
    if (role === "main-admin" || role === "sub-admin") setAdminRole(role);
  }, [setAdminRole]);

  const MENU_ITEMS: MenuItem[] = [
    { id: "overview",         label: "Overview",          icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "wingo",            label: "Games",             icon: <Gamepad2 className="w-5 h-5" />,
      submenu: [
        { id: "wingo", label: "WinGo", icon: <Zap className="w-4 h-4" /> },
        { id: "k3",    label: "K3",    icon: <Zap className="w-4 h-4" /> },
        { id: "trx",   label: "TRX",   icon: <Zap className="w-4 h-4" /> },
        { id: "5d",    label: "5D",    icon: <Zap className="w-4 h-4" /> },
      ],
    },
    { id: "game-history",     label: "History",           icon: <History className="w-5 h-5" />,
      submenu: [
        { id: "game-history",     label: "Game History",     icon: <History className="w-4 h-4" /> },
        { id: "recharge-history", label: "Recharge History", icon: <History className="w-4 h-4" /> },
        { id: "bet-history",      label: "Bet History",      icon: <History className="w-4 h-4" /> },
        { id: "withdraw-history", label: "Withdraw History", icon: <History className="w-4 h-4" /> },
      ],
    },
    { id: "members",          label: "Members",           icon: <Users className="w-5 h-5" /> },
    { id: "deposit-requests", label: "Funds",             icon: <DollarSign className="w-5 h-5" />,
      submenu: [
        { id: "deposit-requests",  label: "Deposits",    icon: <ArrowDownCircle className="w-4 h-4" />, badge: depositCount  },
        { id: "withdraw-requests", label: "Withdrawals", icon: <ArrowUpCircle   className="w-4 h-4" />, badge: withdrawCount },
      ],
    },
    { id: "agents",           label: "Agents",            icon: <UserCheck className="w-5 h-5" /> },
    { id: "gift-codes",       label: "Gift Codes",        icon: <Zap className="w-5 h-5" /> },
    { id: "settings",         label: "Settings",          icon: <Settings className="w-5 h-5" /> },
  ];

  const menuItems = adminRole === "sub-admin"
    ? MENU_ITEMS.filter((i) => i.id === "agents")
    : MENU_ITEMS;

  // Bottom tab bar shows 5 most important items
  const BOTTOM_TABS: MenuItem[] = [
    { id: "overview",         label: "Home",      icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "withdraw-requests",label: "Withdraw",  icon: <ArrowUpCircle   className="w-5 h-5" />, badge: withdrawCount },
    { id: "deposit-requests", label: "Deposit",   icon: <ArrowDownCircle className="w-5 h-5" />, badge: depositCount  },
    { id: "members",          label: "Members",   icon: <Users           className="w-5 h-5" /> },
    { id: "overview",         label: "More",      icon: <Menu            className="w-5 h-5" /> }, // opens drawer
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.submenu) {
      setExpandedMenu(expandedMenu === item.id ? null : item.id);
    } else {
      setCurrentPage(item.id);
      setExpandedMenu(null);
      setDrawerOpen(false);
    }
  };

  const isMenuActive = (item: MenuItem) =>
    item.submenu ? item.submenu.some((s) => s.id === currentPage) : item.id === currentPage;

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated");
    sessionStorage.removeItem("admin_role");
    window.location.href = "/#/admin/login";
  };

  // ── Desktop sidebar (md+) ─────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">⚙️</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">WinWave Admin</h2>
            <p className="text-gray-400 text-xs">{adminRole === "sub-admin" ? "Sub-Admin" : "Control Panel"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={`${item.id}-${item.label}`}>
            <button onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 min-h-[44px] ${
                isMenuActive(item)
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
              }`}>
              <div className="flex items-center gap-3">
                <span className={isMenuActive(item) ? "text-white" : "text-gray-500"}>{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {!item.submenu && item.badge != null && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
                )}
                {item.submenu && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenu === item.id ? "rotate-180" : ""}`} />
                )}
              </div>
            </button>

            {item.submenu && expandedMenu === item.id && (
              <div className="ml-4 mt-1 space-y-1">
                {item.submenu.map((sub) => (
                  <button key={sub.id} onClick={() => { setCurrentPage(sub.id); setExpandedMenu(null); setDrawerOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all min-h-[44px] ${
                      currentPage === sub.id ? "bg-orange-500 text-white font-medium" : "text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                    }`}>
                    {sub.icon}
                    <span>{sub.label}</span>
                    {sub.badge != null && sub.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{sub.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#2a2a2a]">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-orange-400 hover:bg-[#2a2a2a] rounded-lg transition-all min-h-[44px]">
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
        <p className="text-gray-600 text-xs mt-3 text-center">© 2026 WinWave</p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#1c1c1c] border-r border-[#2a2a2a] h-screen sticky top-0 flex-col">
        <SidebarContent />
      </aside>

      {/* ── Mobile: Bottom Tab Bar ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1c1c1c] border-t border-[#2a2a2a] flex items-stretch">
        {BOTTOM_TABS.map((tab, idx) => {
          const isMore = idx === BOTTOM_TABS.length - 1;
          const isActive = !isMore && currentPage === tab.id;
          return (
            <button key={idx}
              onClick={() => isMore ? setDrawerOpen(true) : setCurrentPage(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] relative transition-colors ${
                isActive ? "text-orange-500" : "text-gray-500"
              }`}>
              {tab.icon}
              <span className="text-[9px] font-bold">{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Mobile: Full-screen drawer (opened by "More") ────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#1c1c1c] overflow-y-auto pb-20">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-bold">⚙️</span>
              </div>
              <span className="text-white font-bold">WinWave Admin</span>
            </div>
            <button onClick={() => setDrawerOpen(false)}
              className="p-2 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <div key={`drawer-${item.id}-${item.label}`}>
                <button onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all min-h-[44px] ${
                    isMenuActive(item) ? "bg-orange-500 text-white" : "text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                  }`}>
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.submenu && item.badge != null && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
                    )}
                    {item.submenu && (
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedMenu === item.id ? "rotate-180" : ""}`} />
                    )}
                  </div>
                </button>
                {item.submenu && expandedMenu === item.id && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.submenu.map((sub) => (
                      <button key={sub.id}
                        onClick={() => { setCurrentPage(sub.id); setExpandedMenu(null); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all min-h-[44px] ${
                          currentPage === sub.id ? "bg-orange-500 text-white font-medium" : "text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                        }`}>
                        {sub.icon}<span>{sub.label}</span>
                        {sub.badge != null && sub.badge > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{sub.badge}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="px-4 pt-4 border-t border-[#2a2a2a]">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-orange-400 hover:bg-[#2a2a2a] rounded-lg transition-all min-h-[44px]">
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
