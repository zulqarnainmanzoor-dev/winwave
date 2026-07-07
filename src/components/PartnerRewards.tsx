import React, { useState, useEffect } from "react";
import { ChevronLeft, Copy, Check, Award } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface InvitationStats {
  invitation_count: number;
  effective_invitation_count: number;
  invitation_total_bonus: number;
}

interface BonusRule {
  deposit_range: string;
  turnover_requirement: string;
  bonus_amount: number;
}

export default function PartnerRewards({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [stats, setStats] = useState<InvitationStats>({
    invitation_count: 0,
    effective_invitation_count: 0,
    invitation_total_bonus: 0,
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Bonus rules from screenshot - 1st deposit tier
  const firstDepositRules: BonusRule[] = [
    { deposit_range: "Rs300 ≤ Amount < Rs500", turnover_requirement: "≥ Rs1,500", bonus_amount: 60 },
    { deposit_range: "Rs500 ≤ Amount < Rs1,000", turnover_requirement: "≥ Rs2,500", bonus_amount: 80 },
    { deposit_range: "Rs1,000 ≤ Amount < Rs5,000", turnover_requirement: "≥ Rs5,000", bonus_amount: 170 },
    { deposit_range: "Rs5,000 ≤ Amount < Rs10,000", turnover_requirement: "≥ Rs25,000", bonus_amount: 450 },
  ];

  // Bonus rules from screenshot - 2nd deposit tier
  const secondDepositRules: BonusRule[] = [
    { deposit_range: "Rs10,000 ≤ Amount < Rs50,000", turnover_requirement: "≥ Rs50,000", bonus_amount: 730 },
    { deposit_range: "Amount ≥ Rs50,000", turnover_requirement: "≥ Rs250,000", bonus_amount: 4000 },
    { deposit_range: "Rs500 ≤ Amount < Rs1,000", turnover_requirement: "≥ Rs5,000", bonus_amount: 80 },
    { deposit_range: "Rs1,000 ≤ Amount < Rs5,000", turnover_requirement: "≥ Rs10,000", bonus_amount: 160 },
    { deposit_range: "Rs5,000 ≤ Amount < Rs10,000", turnover_requirement: "≥ Rs50,000", bonus_amount: 400 },
    { deposit_range: "Rs10,000 ≤ Amount < Rs50,000", turnover_requirement: "≥ Rs100,000", bonus_amount: 850 },
    { deposit_range: "Rs50,000 ≤ Amount < Rs100,000", turnover_requirement: "≥ Rs500,000", bonus_amount: 3000 },
    { deposit_range: "Amount ≥ Rs100,000", turnover_requirement: "≥ Rs1,000,000", bonus_amount: 6000 },
  ];

  // Bonus rules from screenshot - 3rd deposit tier
  const thirdDepositRules: BonusRule[] = [
    { deposit_range: "Rs1,000 ≤ Amount < Rs5,000", turnover_requirement: "≥ Rs15,000", bonus_amount: 150 },
    { deposit_range: "Rs5,000 ≤ Amount < Rs10,000", turnover_requirement: "≥ Rs75,000", bonus_amount: 520 },
    { deposit_range: "Rs10,000 ≤ Amount < Rs50,000", turnover_requirement: "≥ Rs150,000", bonus_amount: 920 },
    { deposit_range: "Rs50,000 ≤ Amount < Rs100,000", turnover_requirement: "≥ Rs750,000", bonus_amount: 3200 },
    { deposit_range: "Rs100,000 ≤ Amount < Rs250,000", turnover_requirement: "≥ Rs1,500,000", bonus_amount: 5200 },
    { deposit_range: "Amount ≥ Rs250,000", turnover_requirement: "≥ Rs3,750,000", bonus_amount: 10000 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      if (!uid) return;

      try {
        // Fetch direct invitees count
        const { data: directUsers, error: directError } = await supabase
          .from("users")
          .select("id, total_deposit", { count: "exact" })
          .eq("referred_by", uid);

        if (directError) throw directError;

        const invitationCount = directUsers?.length || 0;
        
        // Count effective invitations (users with deposits > 0)
        const effectiveCount = directUsers?.filter((u: any) => (u.total_deposit || 0) > 0).length || 0;

        // Fetch total commission from transactions (type = 'commission', not 'deposit')
        const { data: commissions, error: commError } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", uid)
          .eq("type", "commission")
          .eq("status", "completed");

        if (commError) throw commError;

        const totalBonus = commissions?.reduce((sum, tx: any) => sum + (tx.amount || 0), 0) || 0;

        setStats({
          invitation_count: invitationCount,
          effective_invitation_count: effectiveCount,
          invitation_total_bonus: totalBonus,
        });
      } catch (error) {
        console.error("Error fetching partner rewards stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [uid]);

  const handleCopyLink = async () => {
    // Use production URL or fallback
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const inviteLink = `${baseUrl}/#/register?ref=${uid}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200">
      {/* Header */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-20">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center uppercase">Partner rewards</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-white/5 p-6 overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute left-0 bottom-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-bold text-white mb-2">Invite friends to get max rewards</p>
              <p className="text-2xl font-black text-[#ffa502]">Rs10,000.00</p>
            </div>
            <div className="w-24 h-24 relative">
              <Award className="w-full h-full text-[#ffa502]" />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-4 space-y-3">
          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">Invitation count</span>
            <span className="text-lg font-black text-white">{loading ? "..." : stats.invitation_count}</span>
          </div>

          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">Effective Invitation count</span>
            <span className="text-lg font-black text-green-400">{loading ? "..." : stats.effective_invitation_count}</span>
          </div>

          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">Invitation total bonus</span>
            <span className="text-lg font-black text-[#ffa502]">{loading ? "..." : formatCurrency(stats.invitation_total_bonus)}</span>
          </div>
        </div>

        {/* Invitation Record Link */}
        <div className="px-4 mb-4">
          <button className="w-full text-center text-sm text-gray-400 hover:text-white py-2">
            Invitation record ›
          </button>
        </div>

        {/* Invitation Link */}
        <div className="px-4 mb-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider mb-3">| INVITATION LINK</h2>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 bg-[#1C1C1E] border border-white/5 rounded-xl px-4 py-3 min-w-0">
              <p className="text-xs text-gray-400 font-mono truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/#/register?ref=${uid}` : ''}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="shrink-0 w-14 bg-[#00d4d4] hover:bg-[#00bfbf] rounded-xl flex items-center justify-center transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-black" /> : <Copy className="w-5 h-5 text-black" />}
            </button>
          </div>
        </div>

        {/* Invitation Rules */}
        <div className="px-4 pb-6">
          <h2 className="text-sm font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ffa502]" />
            Invitation rules
          </h2>
          <p className="text-xs text-gray-400 mb-4">If you invites player A, with in <span className="text-[#ffa502] font-bold">7 Day</span></p>

          {/* 1st Deposit Rules */}
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="bg-[#1C1C1E] border border-white/5 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">1st</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">deposit</p>
              </div>
            </div>

            <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 bg-[#252528] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <span>When Player A</span>
                <span className="text-right">You get bonus</span>
              </div>
              {firstDepositRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-2 p-3 text-xs border-t border-white/5">
                  <div className="text-gray-300">
                    <p className="font-mono text-[10px] leading-tight">{rule.deposit_range}</p>
                    <p className="text-[#ffa502] text-[10px] mt-1">and Turnover ≥ {rule.turnover_requirement.replace('≥ ', '')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#ffa502] font-black text-sm">{formatCurrency(rule.bonus_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2nd Deposit Rules */}
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="bg-[#1C1C1E] border border-white/5 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">2nd</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">deposit</p>
              </div>
            </div>

            <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 bg-[#252528] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <span>When Player A</span>
                <span className="text-right">You get bonus</span>
              </div>
              {secondDepositRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-2 p-3 text-xs border-t border-white/5">
                  <div className="text-gray-300">
                    <p className="font-mono text-[10px] leading-tight">{rule.deposit_range}</p>
                    <p className="text-[#ffa502] text-[10px] mt-1">and Turnover ≥ {rule.turnover_requirement.replace('≥ ', '')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#ffa502] font-black text-sm">{formatCurrency(rule.bonus_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3rd Deposit Rules */}
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="bg-[#1C1C1E] border border-white/5 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">3rd</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">deposit</p>
              </div>
            </div>

            <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 bg-[#252528] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <span>When Player A</span>
                <span className="text-right">You get bonus</span>
              </div>
              {thirdDepositRules.map((rule, index) => (
                <div key={index} className="grid grid-cols-2 p-3 text-xs border-t border-white/5">
                  <div className="text-gray-300">
                    <p className="font-mono text-[10px] leading-tight">{rule.deposit_range}</p>
                    <p className="text-[#ffa502] text-[10px] mt-1">and Turnover ≥ {rule.turnover_requirement.replace('≥ ', '')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#ffa502] font-black text-sm">{formatCurrency(rule.bonus_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mt-4">
            <p className="text-xs font-bold text-red-400 text-center">
              Each deposit is eligible for only one bonus.
            </p>
          </div>

          {/* Info Points */}
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-[#00d4d4] mt-0.5">◆</span>
              <p className="text-xs text-gray-400">
                <span className="text-gray-300">eg:</span> Player A 1st deposit <span className="text-[#ffa502] font-bold">Rs299.00</span> and turnover <span className="text-[#ffa502] font-bold">Rs1,500.00</span>, you can't get bonus
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#00d4d4] mt-0.5">◆</span>
              <p className="text-xs text-gray-400">
                the reward has no limitation, the more you invited the more rewards you will get it
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#00d4d4] mt-0.5">◆</span>
              <p className="text-xs text-gray-400">
                If the conditions are met the rewards will be automatically credited to player's balance
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}