import React, { useState } from "react";
import {
  Users,
  Copy,
  Check,
  ChevronRight,
  X,
  Info,
  Gift,
  FileText,
  Award,
  TrendingUp,
  Coins,
  Percent,
  History,
  UserCheck,
  DollarSign
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useUser } from "../context/UserContext";
import InviteesOverviewView from "./InviteesOverviewView";
import NewInviteesView from "./NewInviteesView";
import CommissionDetailsView from "./CommissionDetailsView";
import InvitationRulesView from "./InvitationRulesView";
import AnimatedCounter from "./AnimatedCounter";

export default function PromotionView() {
  const { t } = useLanguage();
  const {
    referralCode,
    referralCount,
    totalCommissions,
    balance,
    setBalance
  } = useUser();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showInviteesOverview, setShowInviteesOverview] = useState(false);
  const [showNewInvitees, setShowNewInvitees] = useState(false);
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);
  const [showInvitationRules, setShowInvitationRules] = useState(false);

  // Gift Code states
  const [giftCode, setGiftCode] = useState("");
  const [giftError, setGiftError] = useState("");
  const [giftSuccess, setGiftSuccess] = useState("");

  // Mouse drag state and handlers for carousel swipe on desktop
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  if (showInviteesOverview) {
    return <InviteesOverviewView onBack={() => setShowInviteesOverview(false)} />;
  }

  if (showNewInvitees) {
    return <NewInviteesView onBack={() => setShowNewInvitees(false)} />;
  }

  if (showCommissionDetails) {
    return <CommissionDetailsView onBack={() => setShowCommissionDetails(false)} />;
  }

  if (showInvitationRules) {
    return <InvitationRulesView onBack={() => setShowInvitationRules(false)} />;
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleInviteFriends = () => {
    const inviteLink = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Touch handlers for carousel swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      setActiveSlide(1); // Swipe left
    } else if (diff < -50) {
      setActiveSlide(0); // Swipe right
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const dragEndX = e.clientX;
    const diff = dragStartX - dragEndX;
    if (diff > 50) {
      setActiveSlide(1); // Swipe left
    } else if (diff < -50) {
      setActiveSlide(0); // Swipe right
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleGiftRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    setGiftError("");
    setGiftSuccess("");

    const code = giftCode.trim().toUpperCase();
    if (!code) {
      setGiftError("Please enter a valid gift code.");
      return;
    }

    // Supported gift codes
    if (code === "GIFT777" || code === "BONUS2026" || code === "WINWAVE7") {
      const reward = code === "WINWAVE7" ? 500 : 100;
      setBalance(balance + reward);
      setGiftSuccess(`Redeemed successfully! Rs ${reward.toLocaleString()} has been added to your wallet.`);
      setGiftCode("");
    } else {
      setGiftError("Invalid or expired gift code.");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] animate-slide-up pb-[110px] overflow-y-auto scrollbar-hide relative z-10 text-gray-200">
      {/* Promotion/Earn Header matched with Charcoal Header */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-20 flex-shrink-0">
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center uppercase">Earn</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Top Static Panel: Yesterday's Commission Card in Matte Metallic Charcoal with Orange Text */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 text-center shadow-[0_12px_24px_rgba(0,0,0,0.6)] relative overflow-hidden">
          <div className="absolute right-0 top-0.5 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-20 h-20 bg-zinc-800/10 rounded-full blur-xl pointer-events-none" />
          
          <span className="text-sm font-bold text-gray-400 block mb-1">Yesterday's commission</span>
          <span className="text-4xl font-black text-[#ffa502] tracking-tight block">
            <AnimatedCounter value={totalCommissions} prefix="Rs " />
          </span>
        </div>

        {/* Swipeable Carousel Panel Container */}
        <div 
          className="relative select-none cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {activeSlide === 0 ? (
            /* SLIDE 1: Direct Invitees & Team Invitees Stats Card */
            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden shadow-[0_12px_24px_rgba(0,0,0,0.5)] animate-fade-in">
              {/* Header Row */}
              <div className="grid grid-cols-2 text-center font-black text-xs border-b border-white/5">
                <div className="bg-[#2C2C2E] py-3.5 text-white border-r border-white/5 tracking-wider uppercase">
                  Direct Invitees
                </div>
                <div className="bg-[#2C2C2E] py-3.5 text-white tracking-wider uppercase">
                  Team Invitees
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-2 p-4 text-center divide-x divide-white/5">
                {/* Direct Invitees Col */}
                <div className="space-y-4 pr-2">
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={referralCount} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Registered Users</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-[#ffa502] block">
                      <AnimatedCounter value={0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Users</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-white block">
                      <AnimatedCounter value={0} prefix="Rs " />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Amount</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">First Deposit Users</span>
                  </div>
                </div>

                {/* Team Invitees Col */}
                <div className="space-y-4 pl-2">
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Registered Users</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-[#ffa502] block">
                      <AnimatedCounter value={0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Users</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-white block">
                      <AnimatedCounter value={0} prefix="Rs " />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Amount</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">First Deposit Users</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SLIDE 2: Commission summary & quick values */
            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-5 shadow-[0_12px_24px_rgba(0,0,0,0.5)] animate-fade-in space-y-5">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#2C2C2E] border border-white/5 rounded-2xl py-3 px-1">
                  <span className="text-[#ffa502] text-sm font-black block">
                    <AnimatedCounter value={0} prefix="Rs " />
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase mt-0.5">This Week</span>
                </div>
                <div className="bg-[#2C2C2E] border border-white/5 rounded-2xl py-3 px-1">
                  <span className="text-[#ffa502] text-sm font-black block">
                    <AnimatedCounter value={totalCommissions} prefix="Rs " />
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase mt-0.5">Total Commission</span>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 grid grid-cols-2 text-center divide-x divide-white/5">
                <div>
                  <span className="text-xl font-black text-white block">
                    <AnimatedCounter value={referralCount} decimals={0} />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Direct Invitees</span>
                </div>
                <div>
                  <span className="text-xl font-black text-white block">
                    <AnimatedCounter value={0} decimals={0} />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Team Invitees</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Carousel indicator dots */}
        <div className="flex justify-center items-center gap-1.5 pt-1">
          <button 
            onClick={() => setActiveSlide(0)}
            className={`w-3 h-1.5 rounded-full transition-all ${activeSlide === 0 ? "bg-[#ffa502]" : "bg-zinc-700 w-1.5"}`}
          />
          <button 
            onClick={() => setActiveSlide(1)}
            className={`w-3 h-1.5 rounded-full transition-all ${activeSlide === 1 ? "bg-[#ffa502]" : "bg-zinc-700 w-1.5"}`}
          />
        </div>

        {/* Main Invite Action Button - Highly polished glow and clean gradient pill */}
        <button
          onClick={handleInviteFriends}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-[0.98] transition-all rounded-full font-black text-sm tracking-widest text-black shadow-[0_6px_20px_rgba(249,115,22,0.25)] flex items-center justify-center gap-2 cursor-pointer uppercase"
        >
          {copiedInvite ? "Invite Link Copied!" : "Invite Friends To Get Money"}
        </button>

        {/* Menu list items mimicking the actual dashboard */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
          {/* Item 1: Invite Code display with Copy */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Invite Code</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-black text-gray-400 font-mono select-all">{referralCode}</span>
              <button 
                onClick={handleCopyCode}
                className="p-1.5 hover:bg-white/5 active:scale-95 transition-all rounded-lg text-gray-400 hover:text-[#ffa502] cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#ffa502]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Item 2: Commission Details */}
          <button 
            onClick={() => setShowCommissionDetails(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Commission Details</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* Item 3: Invitees Overview */}
          <button 
            onClick={() => setShowInviteesOverview(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Invitees Overview</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* Item 4: New Invitees */}
          <button 
            onClick={() => setShowNewInvitees(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">New Invitees</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* Item 5: Invitation Rules */}
          <button 
            onClick={() => setShowInvitationRules(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Invitation Rules</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* Item 6: Rebate Ratio */}
          <button 
            onClick={() => setActiveModal("rebate_ratio")}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Percent className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Rebate Ratio</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

          {/* Item 7: Gift Code */}
          <button 
            onClick={() => setActiveModal("gift_code")}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Gift className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Gift Code</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* RENDER MODALS FOR EACH DETAIL VIEW */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-[#161618] border border-white/10 rounded-t-3xl rounded-b-xl w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="h-14 bg-[#1C1C1E] border-b border-white/5 flex items-center justify-between px-5 sticky top-0 z-10">
              <span className="text-white font-black text-sm uppercase tracking-wider">
                {activeModal === "commission_details" && "Commission Details"}
                {activeModal === "invitees_overview" && "Invitees Overview"}
                {activeModal === "new_invitees" && "New Invitees"}
                {activeModal === "rebate_ratio" && "Rebate Ratio"}
                {activeModal === "gift_code" && "Redeem Gift Code"}
              </span>
              <button 
                onClick={() => {
                  setActiveModal(null);
                  setGiftError("");
                  setGiftSuccess("");
                }}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 space-y-4">
              {activeModal === "commission_details" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Here are your active agent commission records from your network referrals.</p>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0A0A0B]">
                    <div className="grid grid-cols-3 bg-[#1C1C1E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                      <span>Date</span>
                      <span>Network Bet</span>
                      <span>Commission</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      <div className="grid grid-cols-3 p-3 text-xs text-center text-gray-300">
                        <span className="text-gray-500 font-mono">Today</span>
                        <span className="font-bold">Rs 0.00</span>
                        <span className="text-[#ffa502] font-black">Rs 0.00</span>
                      </div>
                      <div className="grid grid-cols-3 p-3 text-xs text-center text-gray-300">
                        <span className="text-gray-500 font-mono">Yesterday</span>
                        <span className="font-bold">Rs 0.00</span>
                        <span className="text-[#ffa502] font-black">Rs 0.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "invitees_overview" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Detailed breakdown of total active referrers in your downstream network levels.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 text-center">
                      <span className="text-2xl font-black text-white block">{referralCount}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Direct Referrals</span>
                    </div>
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 text-center">
                      <span className="text-2xl font-black text-white block">0</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Sub Referrals</span>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "new_invitees" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Recent players who registered on your direct tracking referral network.</p>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0A0A0B]">
                    <div className="grid grid-cols-2 bg-[#1C1C1E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                      <span>UID / Username</span>
                      <span>Reg. Date</span>
                    </div>
                    {referralCount > 0 ? (
                      <div className="divide-y divide-white/5 text-center">
                        <div className="grid grid-cols-2 p-3 text-xs text-gray-300">
                          <span className="font-mono text-[#ffa502] font-bold">UID_121***</span>
                          <span className="text-gray-500">2026-06-28</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-gray-500 font-bold uppercase">
                        No referrals found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeModal === "rebate_ratio" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Current active rebate multipliers grouped by game categories.</p>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0A0A0B]">
                    <div className="grid grid-cols-3 bg-[#1C1C1E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                      <span>Game Type</span>
                      <span>Lvl 1 %</span>
                      <span>Lvl 2 %</span>
                    </div>
                    <div className="divide-y divide-white/5 text-center text-xs">
                      <div className="grid grid-cols-3 p-3 text-gray-300">
                        <span className="font-bold">Lottery</span>
                        <span className="text-[#ffa502] font-bold">0.60%</span>
                        <span className="text-gray-500">0.30%</span>
                      </div>
                      <div className="grid grid-cols-3 p-3 text-gray-300">
                        <span className="font-bold">Slots</span>
                        <span className="text-[#ffa502] font-bold">0.50%</span>
                        <span className="text-gray-500">0.25%</span>
                      </div>
                      <div className="grid grid-cols-3 p-3 text-gray-300">
                        <span className="font-bold">Live Casino</span>
                        <span className="text-[#ffa502] font-bold">0.40%</span>
                        <span className="text-gray-500">0.20%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "gift_code" && (
                <form onSubmit={handleGiftRedeem} className="space-y-4">
                  <p className="text-xs text-gray-400">Enter your WinWave gift voucher or reward code below to claim instant cash prizes.</p>
                  
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="ENTER GIFT CODE (e.g. GIFT777)"
                      value={giftCode}
                      onChange={(e) => setGiftCode(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-2xl px-4 py-3 text-center text-sm font-black text-white placeholder-gray-600 focus:outline-none focus:border-[#ffa502] font-mono tracking-wider uppercase"
                    />
                    <p className="text-[10px] text-gray-500 font-bold text-center">Try redeeming with sample codes: <span className="text-[#ffa502]">GIFT777</span> or <span className="text-[#ffa502]">WINWAVE7</span></p>
                  </div>

                  {giftError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center text-xs font-bold text-red-400">
                      {giftError}
                    </div>
                  )}

                  {giftSuccess && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 text-center text-xs font-bold text-green-400">
                      {giftSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-95 transition-all text-black font-black text-xs uppercase tracking-widest rounded-full cursor-pointer"
                  >
                    Redeem
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
