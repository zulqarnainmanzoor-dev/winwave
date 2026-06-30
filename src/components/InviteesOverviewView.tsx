import React, { useState } from "react";
import {
  ChevronLeft,
  Search,
  Calendar,
  ChevronDown,
  X,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";
import { useUser } from "../context/UserContext";

interface InviteesOverviewViewProps {
  onBack: () => void;
}

export default function InviteesOverviewView({ onBack }: InviteesOverviewViewProps) {
  const { referralCount } = useUser();
  const [activeTab, setActiveTab] = useState<"subordinate" | "invitees">("subordinate");
  const [searchId, setSearchId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("Select Date");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("All");
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  // Sorting states: null = none, 'asc' = ascending, 'desc' = descending
  const [depositSort, setDepositSort] = useState<"asc" | "desc" | null>(null);
  const [betSort, setBetSort] = useState<"asc" | "desc" | null>(null);
  const [commissionSort, setCommissionSort] = useState<"asc" | "desc" | null>(null);

  // Handle sort button clicks
  const handleSortClick = (type: "deposit" | "bet" | "commission") => {
    if (type === "deposit") {
      setDepositSort(depositSort === "desc" ? "asc" : "desc");
      setBetSort(null);
      setCommissionSort(null);
    } else if (type === "bet") {
      setBetSort(betSort === "desc" ? "asc" : "desc");
      setDepositSort(null);
      setCommissionSort(null);
    } else if (type === "commission") {
      setCommissionSort(commissionSort === "desc" ? "asc" : "desc");
      setDepositSort(null);
      setBetSort(null);
    }
  };

  const clearFilters = () => {
    setSearchId("");
    setSelectedDate("Select Date");
    setSelectedLevel("All");
    setDepositSort(null);
    setBetSort(null);
    setCommissionSort(null);
  };

  // Preset Date Options mimicking actual platform
  const dateOptions = ["All", "Today", "Yesterday", "This Week", "This Month", "Last Month"];

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      {/* Top Navbar matching the website's matte charcoal style */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button 
          id="invitees-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          Invitees Overview
        </h1>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
        {/* Toggle Pills / Tab Bar Row: Subordinate Data vs Invitees */}
        <div className="flex bg-[#1C1C1E] p-1.5 rounded-full border border-white/5 gap-1.5 select-none">
          <button
            onClick={() => setActiveTab("subordinate")}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
              activeTab === "subordinate"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            Subordinate Data
          </button>
          <button
            onClick={() => setActiveTab("invitees")}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
              activeTab === "invitees"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            Invitees
          </button>
        </div>

        {activeTab === "subordinate" ? (
          <>
            {/* Search Input Bar with glass finish */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search subordinate ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-white/5 rounded-full py-3 pl-10 pr-4 text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
              />
              {searchId && (
                <button
                  onClick={() => setSearchId("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Select Date and Dropdown Filter Row */}
            <div className="grid grid-cols-2 gap-3 relative z-20">
              {/* Select Date Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDatePicker(!showDatePicker);
                    setShowLevelDropdown(false);
                  }}
                  className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl py-3 px-4 flex items-center justify-between text-left text-xs font-black text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className={selectedDate !== "Select Date" ? "text-orange-500" : ""}>
                    {selectedDate}
                  </span>
                  <Calendar className="w-4 h-4 text-gray-500" />
                </button>

                {showDatePicker && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 animate-fade-in">
                    {dateOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setSelectedDate(opt === "All" ? "Select Date" : opt);
                          setShowDatePicker(false);
                        }}
                        className={`w-full text-left py-2.5 px-4 text-xs font-bold transition-colors ${
                          (opt === "All" && selectedDate === "Select Date") || selectedDate === opt
                            ? "bg-orange-500/10 text-orange-500"
                            : "text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Select ("All") Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowLevelDropdown(!showLevelDropdown);
                    setShowDatePicker(false);
                  }}
                  className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl py-3 px-4 flex items-center justify-between text-left text-xs font-black text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className={selectedLevel !== "All" ? "text-orange-500" : ""}>
                    {selectedLevel}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showLevelDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 animate-fade-in">
                    {["All", "Direct Invitees", "Team Invitees", "Level 1", "Level 2", "Level 3"].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setSelectedLevel(lvl);
                          setShowLevelDropdown(false);
                        }}
                        className={`w-full text-left py-2.5 px-4 text-xs font-bold transition-colors ${
                          selectedLevel === lvl ? "bg-orange-500/10 text-orange-500" : "text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Premium Charcoal & Gray Matte Stats Card with specific Green & Orange Highlights */}
            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-5 shadow-[0_12px_24px_rgba(0,0,0,0.6)] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute left-0 bottom-0 w-24 h-24 bg-zinc-800/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="grid grid-cols-2 text-center divide-x divide-white/5 gap-y-6">
                {/* Left Stats Column */}
                <div className="space-y-4 pr-1">
                  <div>
                    <span className="text-xl font-black text-white block">0</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      Deposit number
                    </span>
                  </div>
                  <div className="border-t border-white/5 pt-4">
                    <span className="text-xl font-black text-[#10b981] block">0</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      Number of bettors
                    </span>
                  </div>
                  <div className="border-t border-white/5 pt-4">
                    <span className="text-xl font-black text-[#ffa502] block">0</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      Number of people making first deposit
                    </span>
                  </div>
                </div>

                {/* Right Stats Column */}
                <div className="space-y-4 pl-1">
                  <div>
                    <span className="text-xl font-black text-white block">Rs0.00</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      Deposit amount
                    </span>
                  </div>
                  <div className="border-t border-white/5 pt-4">
                    <span className="text-xl font-black text-[#10b981] block">Rs0.00</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      Total Bet
                    </span>
                  </div>
                  <div className="border-t border-white/5 pt-4">
                    <span className="text-xl font-black text-[#ffa502] block">Rs0.00</span>
                    <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">
                      First deposit Amount
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sorting Interactive Filters mimicking screenshot */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSortClick("deposit")}
                className={`py-2 px-3 rounded-xl border font-black text-[11px] tracking-wide text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  depositSort
                    ? "bg-orange-500/10 border-orange-500/40 text-orange-500"
                    : "bg-[#1C1C1E] border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span>Deposit</span>
                <span className="text-xs font-normal">
                  {depositSort === "asc" ? "▲" : depositSort === "desc" ? "▼" : "⇅"}
                </span>
              </button>
              
              <button
                onClick={() => handleSortClick("bet")}
                className={`py-2 px-3 rounded-xl border font-black text-[11px] tracking-wide text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  betSort
                    ? "bg-orange-500/10 border-orange-500/40 text-orange-500"
                    : "bg-[#1C1C1E] border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span>Bet</span>
                <span className="text-xs font-normal">
                  {betSort === "asc" ? "▲" : betSort === "desc" ? "▼" : "⇅"}
                </span>
              </button>
              
              <button
                onClick={() => handleSortClick("commission")}
                className={`py-2 px-3 rounded-xl border font-black text-[11px] tracking-wide text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  commissionSort
                    ? "bg-orange-500/10 border-orange-500/40 text-orange-500"
                    : "bg-[#1C1C1E] border-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <span>Commission</span>
                <span className="text-xs font-normal">
                  {commissionSort === "asc" ? "▲" : commissionSort === "desc" ? "▼" : "⇅"}
                </span>
              </button>
            </div>

            {/* Custom Overlapping Document/Folder Empty State Graphics */}
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="relative w-24 h-24 select-none flex items-center justify-center">
                {/* Back document */}
                <div className="absolute w-14 h-18 bg-[#1C1C1E]/80 rounded-xl border border-white/10 rotate-[-12deg] shadow-lg flex flex-col justify-end p-2.5">
                  <div className="w-8 h-1 bg-zinc-800 rounded-full mb-1" />
                  <div className="w-6 h-1 bg-zinc-800 rounded-full" />
                </div>
                {/* Front document with frosted glass finish and gray guidelines */}
                <div className="absolute w-14 h-18 bg-[#2C2C2E]/90 rounded-xl border border-white/20 translate-x-3 translate-y-1 rotate-[6deg] shadow-2xl flex flex-col p-2.5 justify-center gap-2 backdrop-blur-sm">
                  <div className="w-10 h-1.5 bg-zinc-700/60 rounded-full" />
                  <div className="w-8 h-1.5 bg-zinc-700/60 rounded-full" />
                  <div className="w-9 h-1.5 bg-zinc-700/60 rounded-full" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">No Data Records</span>
                <span className="text-[11px] text-gray-600 font-bold block">No subordinates match selected filter settings</span>
              </div>
            </div>
          </>
        ) : (
          /* "Invitees" Tab Details showing actual count and empty state or list of direct invitees */
          <div className="space-y-4">
            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-5 text-center">
              <span className="text-xs font-bold text-gray-400 block uppercase">Total Network Invitees</span>
              <span className="text-3xl font-black text-[#ffa502] block mt-1.5">{referralCount} Players</span>
            </div>

            {referralCount > 0 ? (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
                <div className="grid grid-cols-3 bg-[#2C2C2E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                  <span>Username</span>
                  <span>Bet Total</span>
                  <span>Direct Rebate</span>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="grid grid-cols-3 p-3.5 text-xs text-center items-center">
                    <span className="font-mono text-white font-bold">UID_48293*</span>
                    <span className="text-[#10b981] font-bold">Rs 0.00</span>
                    <span className="text-[#ffa502] font-black">Rs 0.00</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto text-[#ffa502]">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-400">You haven't invited anyone yet. Copy your link below to start earning commission!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
