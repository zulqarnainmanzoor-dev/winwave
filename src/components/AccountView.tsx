import React, { useState } from "react";
import {
  Copy,
  RefreshCw,
  ChevronRight,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  Gamepad2,
  ArrowLeftRight,
  Download,
  Upload,
  Mail,
  Volume2,
  VolumeX,
  Music,
  Settings,
  X,
  LogOut,
  BarChart3,
  Check
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { formatDisplayUid, useUser } from "../context/UserContext";

export default function AccountView({
  onTransactionClick,
  onDepositClick,
  onWithdrawClick,
  onVipClick,
  onStatisticsClick,
  onWalletClick,
}: {
  onTransactionClick?: () => void;
  onDepositClick?: () => void;
  onWithdrawClick?: () => void;
  onVipClick?: (initialLevel: number) => void;
  onStatisticsClick?: () => void;
  onWalletClick?: () => void;
}) {
  const { t } = useLanguage();
  const {
    username,
    avatar,
    uid,
    lastLogin,
    totalBalance,
    mainWalletBalance,
    thirdPartyWalletBalance,
    soundEnabled,
    setSoundEnabled,
    musicEnabled,
    setMusicEnabled,
    vipLevel,
    logout,
    refreshUserData,
  } = useUser();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const displayUid = formatDisplayUid(uid);

  const handleCopyUid = async () => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      alert("UID copied!");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUserData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="flex-1 flex flex-col p-4 animate-slide-up pb-12 relative">
      {/* User Info Header */}
      <div className="flex items-start justify-between mb-6 mt-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-500/40 bg-[#1C1C1E]">
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#1C1C1E] border border-amber-500/30 rounded-full px-1.5 py-0.5 shadow-md">
              <span className="text-[8px] font-black text-amber-500 uppercase">V{vipLevel}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-white font-bold text-base truncate max-w-[140px]">{username}</span>
              <button
                type="button"
                onClick={() => onVipClick?.(vipLevel)}
                className="flex items-center gap-1 bg-amber-500/10 rounded-full px-2 py-0.5 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
              >
                <Crown className="w-3 h-3 text-amber-500" />
                <span className="text-amber-500 text-[10px] font-black uppercase">VIP{vipLevel}</span>
              </button>
            </div>

            <div className="inline-flex items-center bg-gradient-to-r from-amber-600 to-orange-600 rounded-full px-2.5 py-1 max-w-full">
              <span className="text-white/90 text-[10px] font-bold uppercase tracking-wide">{t("uid")}</span>
              <div className="w-px h-3 bg-white/30 mx-2" />
              <span className="text-white text-xs font-bold tracking-wider">{displayUid}</span>
              <button
                type="button"
                onClick={handleCopyUid}
                className="ml-2 p-0.5 hover:bg-white/10 rounded transition-colors"
                aria-label="Copy UID"
              >
                {copiedUid ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/90" />
                )}
              </button>
            </div>

            <div className="text-gray-500 text-[10px] mt-1.5 truncate">
              {t("lastLogin")} {lastLogin ? new Date(lastLogin).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-2.5 bg-[#1C1C1E] hover:bg-[#2A2A2E] rounded-xl border border-white/5 text-amber-500 transition-colors shadow-md flex-shrink-0 ml-2"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-[#1C1C1E] rounded-2xl p-5 mb-4 shadow-lg border border-white/5">
        <div className="text-gray-400 text-xs font-medium mb-1">{t("totalBalance")}</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-500 font-black text-2xl tracking-tight">
            Rs {totalBalance.toFixed(2)}
          </span>
          <RefreshCw
            className={`w-4 h-4 text-gray-500 cursor-pointer hover:text-amber-500 transition-colors ${
              isRefreshing ? "animate-spin" : ""
            }`}
            onClick={handleRefresh}
          />
        </div>
        <div className="flex gap-3 text-[10px] text-gray-500 mb-4">
          <span>Main: <span className="text-gray-300 font-bold">Rs {mainWalletBalance.toFixed(2)}</span></span>
          <span>Game: <span className="text-gray-300 font-bold">Rs {thirdPartyWalletBalance.toFixed(2)}</span></span>
        </div>

        <div className="w-full h-px bg-white/5 mb-4" />

        <div className="grid grid-cols-4 gap-2">
          <ActionBtn
            icon={<Wallet className="w-5 h-5 text-amber-500" strokeWidth={1.5} />}
            label="ARWallet"
            onClick={onWalletClick}
          />
          <ActionBtn
            icon={<ArrowDownToLine className="w-5 h-5 text-amber-500" strokeWidth={1.5} />}
            label={t("deposit")}
            onClick={onDepositClick}
          />
          <ActionBtn
            icon={<ArrowUpFromLine className="w-5 h-5 text-blue-400" strokeWidth={1.5} />}
            label={t("withdraw")}
            onClick={onWithdrawClick}
          />
          <ActionBtn
            icon={<Crown className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />}
            label={t("vip")}
            onClick={() => onVipClick?.(vipLevel)}
          />
        </div>
      </div>

      {/* Menu list — single-column rows, charcoal/orange/gray theme */}
      <div className="bg-[#1C1C1E] rounded-2xl border border-white/5 shadow-md mb-4 overflow-hidden divide-y divide-white/5">
        <MenuRow
          icon={<Mail className="w-5 h-5 text-amber-500" />}
          iconBg="bg-amber-500/10 border-amber-500/20"
          title={t("notification")}
          badge={1}
        />
        <MenuRow
          icon={<Gamepad2 className="w-5 h-5 text-blue-400" />}
          iconBg="bg-blue-500/10 border-blue-500/20"
          title={t("gameHistory")}
        />
        <MenuRow
          icon={<ArrowLeftRight className="w-5 h-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          title={t("transaction")}
          onClick={onTransactionClick}
        />
        <MenuRow
          icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
          iconBg="bg-blue-500/10 border-blue-500/20"
          title="Game Statistics"
          onClick={onStatisticsClick}
        />
        <MenuRow
          icon={<Download className="w-5 h-5 text-red-400" />}
          iconBg="bg-red-500/10 border-red-500/20"
          title={t("deposit")}
          onClick={onDepositClick}
        />
        <MenuRow
          icon={<Upload className="w-5 h-5 text-amber-500" />}
          iconBg="bg-amber-500/10 border-amber-500/20"
          title={t("withdraw")}
          onClick={onWithdrawClick}
        />
      </div>

      <div
        onClick={logout}
        className="bg-[#1C1C1E] rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-red-500/10 shadow-md mb-4 hover:bg-red-950/20 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl border border-red-500/20">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <span className="text-gray-300 group-hover:text-red-300 font-bold text-sm transition-colors">
            {t("selectLanguage") === "Language" ? "Log Out" : "لاگ آؤٹ"}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-red-400" />
      </div>

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#1C1C1E] rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#161618]">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <h3 className="text-white font-bold text-base">Game Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-white/5 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${soundEnabled ? "bg-amber-500/15 text-amber-500" : "bg-gray-800 text-gray-500"}`}>
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-white text-xs font-semibold block">Sound Effects</span>
                    <span className="text-[10px] text-gray-500">In-game interface audio</span>
                  </div>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-all relative ${soundEnabled ? "bg-amber-500" : "bg-gray-600"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-all transform ${soundEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-white/5 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${musicEnabled ? "bg-amber-500/15 text-amber-500" : "bg-gray-800 text-gray-500"}`}>
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-white text-xs font-semibold block">Background Music</span>
                    <span className="text-[10px] text-gray-500">Looping ambient music</span>
                  </div>
                </div>
                <button
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-all relative ${musicEnabled ? "bg-amber-500" : "bg-gray-600"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-all transform ${musicEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            <div className="bg-[#161618] p-4 flex justify-end">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="flex flex-col items-center gap-1.5 group" onClick={onClick}>
      <div className="w-10 h-10 rounded-xl bg-[#0A0A0B] border border-white/5 flex items-center justify-center group-hover:border-amber-500/30 transition-all group-hover:scale-105">
        {icon}
      </div>
      <span className="text-gray-400 text-[10px] font-medium">{label}</span>
    </button>
  );
}

function MenuRow({
  icon,
  iconBg,
  title,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-[#242428] transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-xl border flex-shrink-0 ${iconBg}`}>{icon}</div>
        <span className="text-white font-medium text-sm truncate">{title}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {badge ? (
          <div className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {badge}
          </div>
        ) : null}
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
      </div>
    </button>
  );
}
