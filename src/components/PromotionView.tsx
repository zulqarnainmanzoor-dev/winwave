import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { adminSupabase } from "../lib/adminSupabase";
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
  DollarSign,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useUser } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import InviteesOverviewView from "./InviteesOverviewView";
import NewInviteesView from "./NewInviteesView";
import CommissionDetailsView from "./CommissionDetailsView";
import InvitationRulesView from "./InvitationRulesView";
import PartnerRewards from "./PartnerRewards";
import AnimatedCounter from "./AnimatedCounter";
export default function PromotionView() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    uid,
    referralCode,
    totalCommissions,
    setTotalCommissions,
    balance,
    setBalance
  } = useUser();

  const [networkStats, setNetworkStats] = useState({
    direct_count: null as number | null,
    team_count: null as number | null,
    direct_deposit_users: null as number | null,
    team_deposit_users: null as number | null,
    direct_deposit_amount: null as number | null,
    team_deposit_amount: null as number | null,
  });
  const [weeklyCommission, setWeeklyCommission] = useState(0);
  const [commissionDetails, setCommissionDetails] = useState<Array<{ id: string; amount: number; created_at: string }>>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // --- Fetch network stats using live users data ---
  useEffect(() => {
    if (!uid) return;

    const fetchStats = async () => {
      if (!uid) return;

      // ── DEBUG BLOCK START ──
      const { data: { session: authSession } } = await supabase.auth.getSession();
      console.log('🔎 [PromotionView] DEBUG auth.user.id   :', authSession?.user?.id ?? 'NO SESSION');
      console.log('🔎 [PromotionView] DEBUG uid from context:', uid);
      console.log('🔎 [PromotionView] DEBUG referralCode    :', referralCode);
      console.log('🔎 [PromotionView] DEBUG uid === auth.id :', uid === authSession?.user?.id);
      console.log('🔎 [PromotionView] DEBUG QUERY: SELECT id,total_deposit FROM public.users WHERE referred_by =', uid);
      // ── DEBUG BLOCK END ──

      setLoadingStats(true);
      setStatsError(null);

      const { data: invitees, error: inviteesError } = await adminSupabase
        .from('users')
        .select('id, total_deposit')
        .eq('referred_by', uid);

      // ── DEBUG BLOCK START ──
      console.log('🔎 [PromotionView] DEBUG direct invitees response:');
      console.log('   data  :', JSON.stringify(invitees));
      console.log('   count :', invitees?.length ?? 'null');
      console.log('   error :', JSON.stringify(inviteesError));
      // ── DEBUG BLOCK END ──

      if (inviteesError) {
        console.error('❌ [PromotionView] Direct invitees fetch failed:', inviteesError);
        setStatsError(inviteesError.message || 'Unable to load referral stats.');
        setLoadingStats(false);
        return;
      }

      const directRows = (invitees || []) as Array<{ id: string; total_deposit: number | null }>;
      const directCount        = directRows.length;
      const directDepositUsers = directRows.filter(r => Number(r.total_deposit || 0) > 0).length;
      const directDepositAmt   = directRows.reduce((s, r) => s + Number(r.total_deposit || 0), 0);

      // ── Step 2: Team tree — recursively walk referred_by levels ──
      // Each iteration:
      //   SELECT id, total_deposit
      //   FROM public.users
      //   WHERE referred_by IN (<previous level ids>)
      let teamCount        = 0;
      let teamDepositUsers = 0;
      let teamDepositAmt   = 0;
      let currentLevelIds  = directRows.map(u => u.id);

      while (currentLevelIds.length > 0) {
        const { data: nextLevel } = await adminSupabase
          .from('users')
          .select('id, total_deposit')
          .in('referred_by', currentLevelIds);
        if (!nextLevel || nextLevel.length === 0) break;
        teamCount        += nextLevel.length;
        teamDepositUsers += nextLevel.filter((r: any) => Number(r.total_deposit || 0) > 0).length;
        teamDepositAmt   += nextLevel.reduce((s: number, r: any) => s + Number(r.total_deposit || 0), 0);
        currentLevelIds   = nextLevel.map((u: any) => u.id);
      }

      // ── DEBUG BLOCK START ──
      console.log('🔎 [PromotionView] DEBUG setNetworkStats value:', {
        direct_count: directCount,
        team_count: teamCount,
        direct_deposit_users: directDepositUsers,
        team_deposit_users: teamDepositUsers,
        direct_deposit_amount: directDepositAmt,
        team_deposit_amount: teamDepositAmt,
      });
      // ── DEBUG BLOCK END ──

      setNetworkStats({
        direct_count:          directCount,
        team_count:            teamCount,
        direct_deposit_users:  directDepositUsers,
        team_deposit_users:    teamDepositUsers,
        direct_deposit_amount: directDepositAmt,
        team_deposit_amount:   teamDepositAmt,
      });

      // ── Step 3: Commissions from public.transactions WHERE type='commission' ──
      // The referral_commissions table does not exist in the schema.
      // The trigger trg_credit_agent_commission inserts into public.transactions
      // with type='commission' and user_id = referrer_id.
      //
      // Query (weekly):
      //   SELECT amount FROM public.transactions
      //   WHERE user_id = '<uid>' AND type = 'commission'
      //     AND created_at >= '<7 days ago>'
      //
      // Query (total):
      //   SELECT amount FROM public.transactions
      //   WHERE user_id = '<uid>' AND type = 'commission'
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: allCommRows } = await (supabase as any)
        .from('transactions')
        .select('amount, created_at')
        .eq('user_id', uid)
        .eq('type', 'commission');

      const commRows = (allCommRows || []) as Array<{ amount: number; created_at: string }>;
      const totalComm  = commRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const weeklyComm = commRows
        .filter(r => r.created_at >= oneWeekAgo)
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      setTotalCommissions(totalComm);
      setWeeklyCommission(weeklyComm);

      setLoadingStats(false);
    };

    fetchStats();
  }, [uid, referralCode]);

  // --- State for navigation and modals ---
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showInviteesOverview, setShowInviteesOverview] = useState(false);
  const [showNewInvitees, setShowNewInvitees] = useState(false);
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);
  const [showInvitationRules, setShowInvitationRules] = useState(false);
  const [showPartnerReward, setShowPartnerReward] = useState(false); // NEW
  const [claimingCommission, setClaimingCommission] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Gift Code states
  const [giftCode, setGiftCode] = useState("");
  const [giftError, setGiftError] = useState("");
  const [giftSuccess, setGiftSuccess] = useState("");
  const [recentInvitees, setRecentInvitees] = useState<Array<{id: string, phone: string, date: string}>>([]);

  // Mouse drag state and handlers for carousel swipe on desktop
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  // --- Helper functions ---
  const getReferralCodeForShare = () => {
    return (referralCode?.trim() || localStorage.getItem('winwave_referral_code') || '').trim();
  };

  const handleCopyCode = async () => {
    const codeToCopy = getReferralCodeForShare();
    if (!codeToCopy) {
      alert('Invite code is not available yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite code:', err);
      alert('Failed to copy invite code. Please try again.');
    }
  };

  const handleInviteFriends = async () => {
    const codeToShare = getReferralCodeForShare();
    if (!codeToShare) {
      alert('Invite code is not available yet.');
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://winclub-official.vercel.app';
    const inviteLink = `${origin}/#/register?ref=${encodeURIComponent(codeToShare)}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
      alert('Failed to copy invite link. Please try again.');
    }
  };

  const handleClaimCommission = async () => {
    if (!uid || !Number(totalCommissions)) {
      setClaimMessage('No commission available to claim.');
      return;
    }
    setClaimingCommission(true);
    setClaimMessage(null);
    try {
      const { data: userRow, error: fetchErr } = await (supabase as any)
        .from('users')
        .select('main_balance')
        .eq('id', uid)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const next = Number(userRow?.main_balance ?? 0) + Number(totalCommissions);
      const { error: updateErr } = await (supabase as any)
        .from('users')
        .update({ main_balance: next })
        .eq('id', uid);
      if (updateErr) throw updateErr;
      setBalance(balance + Number(totalCommissions));
      setTotalCommissions(0);
      setClaimMessage(`Claimed Rs ${Number(totalCommissions).toLocaleString()} to your main wallet.`);
    } catch (err: any) {
      setClaimMessage(err?.message || 'Unable to claim commission right now.');
    } finally {
      setClaimingCommission(false);
      setTimeout(() => setClaimMessage(null), 4000);
    }
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

  // Fetch recent invitees for display
  useEffect(() => {
    if (!uid) return;
    
    const fetchRecentInvitees = async () => {
      try {
        console.log('📊 [PromotionView] Fetching recent invitees for uid:', uid);
        
        const { data, error } = await adminSupabase
          .from('users')
          .select('id, phone_number, created_at')
          .eq('referred_by', uid)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error('❌ [PromotionView] Error fetching recent invitees:', error);
          throw error;
        }
        
        console.log('📊 [PromotionView] Recent invitees found:', data?.length || 0);
        
        const formatted = (data || []).map((u: any) => ({
          id: u.id,
          phone: u.phone_number || 'Unknown',
          date: new Date(u.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })
        }));
        
        setRecentInvitees(formatted);
      } catch (err) {
        console.error('❌ [PromotionView] Failed to fetch recent invitees:', err);
      }
    };
    
    fetchRecentInvitees();
  }, [uid]);

  const handleGiftRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setGiftError("");
    setGiftSuccess("");

    const code = giftCode.trim().toUpperCase();
    if (!code) {
      setGiftError("Please enter a valid gift code.");
      return;
    }
    if (!uid) {
      setGiftError("Please log in before redeeming a gift code.");
      return;
    }

    try {
      const { data: existingClaim } = await (supabase as any)
        .from('gift_code_claims')
        .select('id')
        .eq('user_id', uid)
        .eq('gift_code', code)
        .maybeSingle();

      if (existingClaim?.id) {
        setGiftError('You have already claimed this gift code once!');
        return;
      }

      const { data: giftRow, error: giftRowError } = await (supabase as any)
        .from('gift_codes')
        .select('id, amount')
        .eq('code', code)
        .eq('status', 'active')
        .maybeSingle();

      if (giftRowError || !giftRow?.id) {
        setGiftError('Invalid or expired gift code.');
        return;
      }

      const reward = Number(giftRow.amount || 0);
      const { data: userRow, error: userFetchErr } = await (supabase as any)
        .from('users')
        .select('main_balance')
        .eq('id', uid)
        .maybeSingle();
      if (userFetchErr) throw userFetchErr;
      const nextBalance = Number(userRow?.main_balance ?? 0) + reward;
      const { error: userUpdateErr } = await (supabase as any)
        .from('users')
        .update({ main_balance: nextBalance })
        .eq('id', uid);
      if (userUpdateErr) throw userUpdateErr;

      await (supabase as any)
        .from('gift_code_claims')
        .insert([{ user_id: uid, gift_code: code, amount: reward, created_at: new Date().toISOString() }]);

      setBalance(nextBalance);
      setGiftSuccess(`Redeemed successfully! Rs ${reward.toLocaleString()} has been added to your wallet.`);
      setGiftCode("");
    } catch (err: any) {
      console.error('Gift redemption failed', err);
      setGiftError(err?.message || 'Unable to redeem gift code right now.');
    }
  };

  // --- Main render ---
  const renderContent = () => {
    if (showInviteesOverview) {
      return <InviteesOverviewView onBack={() => { setShowInviteesOverview(false); setActiveModal(null); }} />;
    }
    if (showNewInvitees) {
      return <NewInviteesView onBack={() => { setShowNewInvitees(false); setActiveModal(null); }} />;
    }
    if (showCommissionDetails) {
      return <CommissionDetailsView onBack={() => { setShowCommissionDetails(false); setActiveModal(null); }} />;
    }
    if (showInvitationRules) {
      return <InvitationRulesView onBack={() => { setShowInvitationRules(false); setActiveModal(null); }} />;
    }
    if (showPartnerReward) {
      return <PartnerRewards onBack={() => { setShowPartnerReward(false); setActiveModal(null); }} />;
    }
    return null;
  };

  const subView = renderContent();
  if (subView) return subView;

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] animate-slide-up pb-[110px] overflow-y-auto scrollbar-hide relative z-10 text-gray-200">
      {/* Promotion/Earn Header matched with Charcoal Header */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-20 flex-shrink-0">
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center uppercase">Earn</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Top Static Panel: Yesterday's Commission Card */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 text-center shadow-[0_12px_24px_rgba(0,0,0,0.6)] relative overflow-hidden">
          <div className="absolute right-0 top-0.5 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-20 h-20 bg-zinc-800/10 rounded-full blur-xl pointer-events-none" />
          
          <span className="text-sm font-bold text-gray-400 block mb-1">Yesterday's commission</span>
          <span className="text-4xl font-black text-[#ffa502] tracking-tight block">
            <AnimatedCounter value={totalCommissions} prefix="Rs " />
          </span>
          {loadingStats ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-300">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
              Loading referral stats
            </div>
          ) : statsError ? (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {statsError}
            </div>
          ) : null}
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

                <div className="grid grid-cols-2 p-4 text-center divide-x divide-white/5">
                {/* Direct Invitees Col */}
                <div className="space-y-4 pr-2">
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={networkStats.direct_count ?? 0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Registered Users</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-[#ffa502] block">
                      <AnimatedCounter value={networkStats.direct_deposit_users ?? 0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Users</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-white block">
                      <AnimatedCounter value={networkStats.direct_deposit_amount ?? 0} prefix="Rs " />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Amount</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={networkStats.direct_deposit_users ?? 0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">First Deposit Users</span>
                  </div>
                </div>

                {/* Team Invitees Col */}
                <div className="space-y-4 pl-2">
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={networkStats.team_count ?? 0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Registered Users</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-[#ffa502] block">
                      <AnimatedCounter value={networkStats.team_deposit_users ?? 0} decimals={0} />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Users</span>
                  </div>
                  <div>
                    <span className="text-base font-black text-white block">
                      <AnimatedCounter value={networkStats.team_deposit_amount ?? 0} prefix="Rs " />
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Deposit Amount</span>
                  </div>
                  <div>
                    <span className="text-lg font-black text-white block">
                      <AnimatedCounter value={networkStats.team_deposit_users ?? 0} decimals={0} />
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
                    <AnimatedCounter value={weeklyCommission} prefix="Rs " />
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
                    <AnimatedCounter value={networkStats.direct_count ?? 0} decimals={0} />
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Direct Invitees</span>
                </div>
                <div>
                  <span className="text-xl font-black text-white block">
                    <AnimatedCounter value={networkStats.team_count ?? 0} decimals={0} />
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

        {/* Main Invite Action Button */}
        <button
          onClick={handleInviteFriends}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-[0.98] transition-all rounded-full font-black text-sm tracking-widest text-black shadow-[0_6px_20px_rgba(249,115,22,0.25)] flex items-center justify-center gap-2 cursor-pointer uppercase"
        >
          {copiedInvite ? "Invite Link Copied!" : "Invite Friends To Get Money"}
        </button>

        <button
          onClick={handleClaimCommission}
          disabled={claimingCommission || !uid || !Number(totalCommissions)}
          className="w-full py-3.5 bg-[#1f2937] border border-orange-500/30 hover:border-orange-400 transition-all rounded-full font-black text-sm tracking-widest text-orange-400 flex items-center justify-center gap-2 uppercase disabled:opacity-60"
        >
          {claimingCommission ? "Claiming..." : "Claim Commission to Main Wallet"}
        </button>

        {claimMessage && (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
            {claimMessage}
          </div>
        )}

        {/* Menu list items */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
          {/* Item 1: Invite Code display with Copy */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#ffa502]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Invite Code</div>
                <div className="text-sm font-black text-orange-300 font-mono select-all break-all">
                  {referralCode ? `${referralCode}` : 'No invite code yet'}
                </div>
              </div>
            </div>
            <button 
              onClick={handleCopyCode}
              className="shrink-0 p-2 hover:bg-white/5 active:scale-95 transition-all rounded-lg text-gray-400 hover:text-[#ffa502] cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-[#ffa502]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* NEW Item 1.5: Partner Reward */}
          <button 
            onClick={() => setShowPartnerReward(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Award className="w-5 h-5 text-[#ffa502]" />
              </div>
              <span className="text-sm font-bold text-white">Partner Reward</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>

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
            onClick={() => navigate('/rebate-ratio')}
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
                      <span className="text-2xl font-black text-white block">{networkStats.direct_count}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Direct Referrals</span>
                    </div>
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 text-center">
                      <span className="text-2xl font-black text-white block">{networkStats.team_count}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-1">Team Referrals</span>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "new_invitees" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Recent players who registered on your direct tracking referral network.</p>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0A0A0B]">
                    <div className="grid grid-cols-2 bg-[#1C1C1E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                      <span>UID / Phone</span>
                      <span>Reg. Date</span>
                    </div>
                    {recentInvitees.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {recentInvitees.map((invitee) => (
                          <div key={invitee.id} className="grid grid-cols-2 p-3 text-xs text-center items-center">
                            <span className="font-mono text-[#ffa502] font-bold">
                              {invitee.phone.slice(0, 4)}****{invitee.phone.slice(-2)}
                            </span>
                            <span className="text-gray-500">{invitee.date}</span>
                          </div>
                        ))}
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
                  <p className="text-xs text-gray-400">Rebate commission rates by level</p>
                  
                  {/* Game Category Tabs */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gradient-to-r from-green-400 to-cyan-400 rounded-xl p-3 text-center">
                      <div className="w-8 h-8 mx-auto mb-1 bg-black/20 rounded-full flex items-center justify-center">
                        <span className="text-lg">🎱</span>
                      </div>
                      <p className="text-[10px] font-black text-black uppercase">Lottery</p>
                    </div>
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-3 text-center">
                      <div className="w-8 h-8 mx-auto mb-1 bg-white/5 rounded-full flex items-center justify-center">
                        <span className="text-lg">🎰</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Casino</p>
                    </div>
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-3 text-center">
                      <div className="w-8 h-8 mx-auto mb-1 bg-white/5 rounded-full flex items-center justify-center">
                        <span className="text-lg">⚽</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Sports</p>
                    </div>
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-xl p-3 text-center">
                      <div className="w-8 h-8 mx-auto mb-1 bg-white/5 rounded-full flex items-center justify-center">
                        <span className="text-lg">🎯</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">R...</p>
                    </div>
                  </div>

                  {/* Rebate Level L0 */}
                  <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-green-400 mb-3">Rebate level L0</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">1 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.3%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/50 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/50 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">2 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.09%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/30 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/30 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">3 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.027%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/20 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/20 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">4 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.0081%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/10 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">5 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.00243%</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/5 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/5 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">6 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.000729%</span>
                      </div>
                    </div>
                  </div>

                  {/* Rebate Level L1 */}
                  <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-cyan-400 mb-3">Rebate level L1</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">1 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.35%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/50 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400/50 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">2 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.1225%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/30 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400/30 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">3 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.042875%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/20 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400/20 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">4 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.015006%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400/10 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">5 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.005252%</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/5 flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400/5 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">6 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.001838%</span>
                      </div>
                    </div>
                  </div>

                  {/* Rebate Level L2 */}
                  <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-green-400 mb-3">Rebate level L2</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">1 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.375%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/50 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/50 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">2 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.140625%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/30 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/30 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">3 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.052734%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/20 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/20 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">4 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.019775%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/10 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">5 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.007416%</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-green-400/5 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-400/5 rounded-full" />
                          </div>
                          <span className="text-xs text-gray-300">6 level lower level commission rebate</span>
                        </div>
                        <span className="text-sm font-black text-white">0.002781%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "gift_code" && (
                <form onSubmit={handleGiftRedeem} className="space-y-4">
                  <p className="text-xs text-gray-400">Enter your WinClub gift voucher or reward code below to claim instant cash prizes.</p>
                  
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="ENTER GIFT CODE (e.g. GIFT777)"
                      value={giftCode}
                      onChange={(e) => setGiftCode(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-2xl px-4 py-3 text-center text-sm font-black text-white placeholder-gray-600 focus:outline-none focus:border-[#ffa502] font-mono tracking-wider uppercase"
                    />
                    <p className="text-[10px] text-gray-500 font-bold text-center">Try redeeming with sample codes: <span className="text-[#ffa502]">GIFT777</span> or <span className="text-[#ffa502]">WINCLUB7</span></p>
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