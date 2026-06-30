import React from "react";
import { 
  ChevronLeft, 
  Users, 
  Link2, 
  ClipboardCheck, 
  Clock, 
  TrendingUp, 
  Percent, 
  Trophy, 
  Shield 
} from "lucide-react";

interface InvitationRulesViewProps {
  onBack: () => void;
}

export default function InvitationRulesView({ onBack }: InvitationRulesViewProps) {
  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      {/* Top Navbar matching the website's matte charcoal style */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button 
          id="rules-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[#ffa502] text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          Invitation Rules
        </h1>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
        {/* Banner Headers mimicking the screenshot */}
        <div className="text-center py-6 px-4 bg-[#161618] rounded-3xl border border-white/5 relative overflow-hidden space-y-3 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffa502]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-zinc-800/20 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-[#ffa502] text-xl font-black tracking-wider leading-tight uppercase">
            【PROMOTION PARTNER】<br />
            <span className="text-white text-3xl font-extrabold tracking-widest block mt-1">PROGRAM</span>
          </h2>
          
          <div className="inline-block bg-[#ffa502]/10 border border-[#ffa502]/25 rounded-full px-5 py-2">
            <span className="text-[#ffa502] text-[10px] font-black tracking-wider uppercase">
              THIS ACTIVITY IS VALID FOR A LONG TIME
            </span>
          </div>
        </div>

        {/* 8 Custom Invitation Rules Cards */}
        <div className="space-y-4">
          
          {/* Rule 01 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex flex-col md:flex-row gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              01
            </div>
            
            {/* Visual Icon / Schematic Diagram */}
            <div className="w-full md:w-1/3 flex flex-col items-center bg-[#1C1C1E] rounded-2xl p-4 border border-white/5">
              <div className="relative flex flex-col items-center space-y-2">
                {/* Root A */}
                <div className="flex items-center gap-1.5 bg-[#ffa502]/10 border border-[#ffa502]/30 rounded-full px-2.5 py-1">
                  <span className="text-[10px] font-black text-[#ffa502] bg-[#161618] rounded-full w-4 h-4 flex items-center justify-center">A</span>
                  <Users className="w-3.5 h-3.5 text-[#ffa502]" />
                </div>
                {/* Line downwards */}
                <div className="w-0.5 h-4 bg-[#ffa502]/20" />
                {/* Children B (L1) */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 bg-[#161618] border border-white/10 rounded-full px-2 py-0.5">
                      <span className="text-[9px] font-bold text-gray-300">B</span>
                      <span className="text-[8px] font-black text-orange-500 bg-orange-500/10 rounded-md px-1 scale-90">L1</span>
                    </div>
                    <div className="w-0.5 h-3 bg-[#ffa502]/25" />
                    <div className="flex items-center gap-1 bg-[#161618] border border-white/10 rounded-full px-2 py-0.5">
                      <span className="text-[9px] font-bold text-gray-400">C</span>
                      <span className="text-[8px] font-black text-orange-400 bg-orange-400/10 rounded-md px-1 scale-90">L2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1 md:pt-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Subordinate Levels</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                There are <span className="text-[#ffa502] font-bold">6 subordinate levels</span> in inviting friends, if A invites B, then B is a level 1 subordinate of A. If B invites C, then C is a level 1 subordinate of B and also a level 2 subordinate of A. If C invites D, then D is a level 1 subordinate of C, at the same time a level 2 subordinate of B and also a level 3 subordinate of A.
              </p>
            </div>
          </div>

          {/* Rule 02 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              02
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <Link2 className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Manually Link Code</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                When inviting friends to register, you must send the invitation link provided or enter the invitation code manually so that your friends become your <span className="text-[#ffa502] font-bold">level 1 subordinates</span>.
              </p>
            </div>
          </div>

          {/* Rule 03 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              03
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Instant Rewards</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                The invitee registers via the inviter's invitation code and completes the deposit, shortly after that the commission will be <span className="text-[#ffa502] font-bold">received immediately</span>.
              </p>
            </div>
          </div>

          {/* Rule 04 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              04
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <Clock className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Commission Settlements</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                The calculation of yesterday's commission starts every morning at <span className="text-[#ffa502] font-bold">01:00</span>. After the commission calculation is completed, the commission is rewarded to the wallet and can be viewed through the commission collection record.
              </p>
            </div>
          </div>

          {/* Rule 05 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              05
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Variable Rates & Levels</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                Commission rates vary depending on your agency level on that day. <span className="text-[#ffa502] font-bold">Number of Teams</span>: How many downline deposits you have to date. <span className="text-[#ffa502] font-bold">Team Deposits</span>: The total number of deposits made by your downline in one day. <span className="text-[#ffa502] font-bold">Team Deposit</span>: Your downline deposits within one day.
              </p>
            </div>
          </div>

          {/* Rule 06 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              06
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <Percent className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Bonus Percentages</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                The commission percentage depends on the membership level. The higher the membership level, the higher the bonus percentage. Different game types also have different payout percentages. The commission rate is specifically explained as follows.
              </p>
            </div>
          </div>

          {/* Rule 07 */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              07
            </div>
            
            {/* Visual Icon */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0">
              <Trophy className="w-6 h-6 text-[#ffa502]" />
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Leaderboard Bonuses</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed">
                <span className="text-[#ffa502] font-bold">TOP20 commission rankings</span> will be randomly awarded with a separate bonus.
              </p>
            </div>
          </div>

          {/* Rule 08 - Shield with "W" instead of "P" and POPZAR replaced with WINWAVE */}
          <div className="bg-[#161618] border border-[#ffa502]/10 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30">
            <div className="absolute top-3 right-4 text-3xl font-black text-[#ffa502]/10 select-none">
              08
            </div>
            
            {/* Custom SVG Shield containing "W" */}
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/25 flex-shrink-0 relative">
              <svg className="w-8 h-8 text-[#ffa502]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {/* Bold custom "W" inside matching font of "P" in the screenshot */}
              <span className="absolute inset-0 flex items-center justify-center font-black text-sm text-[#ffa502] pt-0.5 select-none font-sans">
                W
              </span>
            </div>

            {/* Description Text */}
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">Final Interpretation</span>
              <p className="text-xs font-medium text-gray-300 leading-relaxed font-sans">
                The final interpretation of this activity belongs to <span className="text-[#ffa502] font-black">WINWAVE</span> – Best Online Casino in Pakistan, Promo Code Pakistan.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
