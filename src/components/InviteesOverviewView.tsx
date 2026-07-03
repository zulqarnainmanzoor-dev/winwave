import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Search, Calendar, ChevronDown, X, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useUser } from "../context/UserContext";

interface SubStats {
  deposit_count:       number;
  deposit_amount:      number;
  total_bet:           number;
  bettor_count:        number;
  first_deposit_count: number;
  first_deposit_amount:number;
}

interface InviteeRow {
  id: string;
  phone_number: string | null;
  invite_code:  string | null;
  total_bets:   number;
  account_status: string | null;
}

const DATE_OPTIONS = ["All", "Today", "Yesterday", "This Week", "This Month", "Last Month"];
const LEVEL_OPTIONS = ["All", "Level 1", "Level 2", "Level 3"];

function getDateRange(opt: string): { from: string; to: string } | null {
  const now = new Date();
  const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  if (opt === "Today")      return { from: today.toISOString(),                                  to: tomorrow.toISOString() };
  if (opt === "Yesterday")  return { from: new Date(today.getTime() - 86400000).toISOString(),   to: today.toISOString() };
  if (opt === "This Week") {
    const dow = now.getUTCDay();
    const weekStart = new Date(today.getTime() - dow * 86400000);
    return { from: weekStart.toISOString(), to: tomorrow.toISOString() };
  }
  if (opt === "This Month") return { from: utc(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString(), to: tomorrow.toISOString() };
  if (opt === "Last Month") {
    const s = utc(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const e = utc(now.getUTCFullYear(), now.getUTCMonth(), 1);
    return { from: s.toISOString(), to: e.toISOString() };
  }
  return null;
}

export default function InviteesOverviewView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab]           = useState<"subordinate" | "invitees">("subordinate");
  const [searchId, setSearchId]             = useState("");
  const [selectedDate, setSelectedDate]     = useState("All");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLevel, setSelectedLevel]   = useState("All");
  const [showLevelDrop, setShowLevelDrop]   = useState(false);
  const [stats, setStats]                   = useState<SubStats | null>(null);
  const [invitees, setInvitees]             = useState<InviteeRow[]>([]);
  const [loading, setLoading]               = useState(false);
  const [actionMsg, setActionMsg]           = useState<string | null>(null);

  // ── Fetch subordinate stats ──────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!uid) return;
    setLoading(true);

    // Build level filter: collect IDs at requested depth
    const { data: l1 } = await supabase.from("users").select("id").eq("referred_by", uid);
    const l1ids = (l1 ?? []).map((r: any) => r.id as string);

    let targetIds: string[] = [];
    if (selectedLevel === "All" || selectedLevel === "Level 1") targetIds.push(...l1ids);

    if ((selectedLevel === "All" || selectedLevel === "Level 2") && l1ids.length) {
      const { data: l2 } = await supabase.from("users").select("id").in("referred_by", l1ids);
      const l2ids = (l2 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l2ids);

      if ((selectedLevel === "All" || selectedLevel === "Level 3") && l2ids.length) {
        const { data: l3 } = await supabase.from("users").select("id").in("referred_by", l2ids);
        targetIds.push(...(l3 ?? []).map((r: any) => r.id as string));
      }
    }

    if (!targetIds.length) {
      setStats({ deposit_count: 0, deposit_amount: 0, total_bet: 0, bettor_count: 0, first_deposit_count: 0, first_deposit_amount: 0 });
      setLoading(false);
      return;
    }

    const dateRange = getDateRange(selectedDate);

    // Deposit stats
    let depQ = supabase.from("deposit_history").select("user_id, amount").in("user_id", targetIds).eq("status", "success");
    if (dateRange) depQ = depQ.gte("created_at", dateRange.from).lt("created_at", dateRange.to);
    const { data: deps } = await depQ;

    const depRows = deps ?? [];
    const uniqueDepositors = new Set(depRows.map((d: any) => d.user_id));
    const depAmount = depRows.reduce((s: number, d: any) => s + Number(d.amount), 0);

    // First deposit per user
    const firstDepMap: Record<string, number> = {};
    for (const d of depRows) {
      if (!firstDepMap[d.user_id]) firstDepMap[d.user_id] = Number(d.amount);
    }
    const firstDepCount  = Object.keys(firstDepMap).length;
    const firstDepAmount = Object.values(firstDepMap).reduce((s, v) => s + v, 0);

    // Bet stats
    let betQ = supabase.from("betting_history").select("user_id, amount").in("user_id", targetIds);
    if (dateRange) betQ = betQ.gte("created_at", dateRange.from).lt("created_at", dateRange.to);
    const { data: bets } = await betQ;

    const betRows = bets ?? [];
    const uniqueBettors = new Set(betRows.map((b: any) => b.user_id));
    const totalBet = betRows.reduce((s: number, b: any) => s + Number(b.amount), 0);

    setStats({
      deposit_count:        uniqueDepositors.size,
      deposit_amount:       depAmount,
      total_bet:            totalBet,
      bettor_count:         uniqueBettors.size,
      first_deposit_count:  firstDepCount,
      first_deposit_amount: firstDepAmount,
    });
    setLoading(false);
  }, [uid, selectedDate, selectedLevel]);

  // ── Fetch invitees list ──────────────────────────────────────────
  const fetchInvitees = useCallback(async () => {
    if (!uid) return;
    let q = supabase
      .from("users")
      .select("id, phone_number, invite_code, total_bets, account_status")
      .eq("referred_by", uid)
      .order("created_at", { ascending: false });
    
    // Search by phone number OR invite_code (UID) for better subordinate lookup
    if (searchId.trim()) {
      const searchTerm = searchId.trim();
      q = q.or(`phone_number.ilike.%${searchTerm}%,invite_code.ilike.%${searchTerm}%`);
    }
    
    const { data } = await q;
    setInvitees((data as InviteeRow[]) ?? []);
  }, [uid, searchId]);

  useEffect(() => { void fetchStats(); },   [fetchStats]);
  useEffect(() => { void fetchInvitees(); }, [fetchInvitees]);

  const handleAccountAction = async (userId: string, action: "suspended" | "banned") => {
    const { error } = await supabase.from("users").update({ account_status: action }).eq("id", userId);
    if (error) { setActionMsg("Action failed: " + error.message); return; }
    setActionMsg(`User ${action} successfully.`);
    setTimeout(() => setActionMsg(null), 3000);
    void fetchInvitees();
  };

  const maskPhone = (p: string | null) => p ? p.slice(0, 4) + "****" + p.slice(-2) : "---";
  const fmt = (n: number) => `Rs ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">Invitees Overview</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
        {/* Tab toggle */}
        <div className="flex bg-[#1C1C1E] p-1.5 rounded-full border border-white/5 gap-1.5 select-none">
          {(["subordinate", "invitees"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2.5 px-4 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
                activeTab === t ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg" : "bg-transparent text-gray-400 hover:text-white"
              }`}>
              {t === "subordinate" ? "Subordinate Data" : "Invitees"}
            </button>
          ))}
        </div>

        {actionMsg && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3 text-sm text-orange-300">{actionMsg}</div>
        )}

        {activeTab === "subordinate" ? (
          <>
            {/* Filters */}
            <div className="grid grid-cols-2 gap-3 relative z-20">
              <div className="relative">
                <button onClick={() => { setShowDatePicker(!showDatePicker); setShowLevelDrop(false); }}
                  className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl py-3 px-4 flex items-center justify-between text-xs font-black text-gray-300 cursor-pointer">
                  <span className={selectedDate !== "All" ? "text-orange-500" : ""}>{selectedDate === "All" ? "Select Date" : selectedDate}</span>
                  <Calendar className="w-4 h-4 text-gray-500" />
                </button>
                {showDatePicker && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 z-30">
                    {DATE_OPTIONS.map((opt) => (
                      <button key={opt} onClick={() => { setSelectedDate(opt); setShowDatePicker(false); }}
                        className={`w-full text-left py-2.5 px-4 text-xs font-bold transition-colors ${selectedDate === opt ? "bg-orange-500/10 text-orange-500" : "text-gray-400 hover:bg-white/5"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => { setShowLevelDrop(!showLevelDrop); setShowDatePicker(false); }}
                  className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl py-3 px-4 flex items-center justify-between text-xs font-black text-gray-300 cursor-pointer">
                  <span className={selectedLevel !== "All" ? "text-orange-500" : ""}>{selectedLevel}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {showLevelDrop && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 z-30">
                    {LEVEL_OPTIONS.map((lvl) => (
                      <button key={lvl} onClick={() => { setSelectedLevel(lvl); setShowLevelDrop(false); }}
                        className={`w-full text-left py-2.5 px-4 text-xs font-bold transition-colors ${selectedLevel === lvl ? "bg-orange-500/10 text-orange-500" : "text-gray-400 hover:bg-white/5"}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats card */}
            {loading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-5 shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
                <div className="grid grid-cols-2 text-center divide-x divide-white/5 gap-y-6">
                  <div className="space-y-4 pr-1">
                    <div>
                      <span className="text-xl font-black text-white block">{stats?.deposit_count ?? 0}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5">Deposit number</span>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                      <span className="text-xl font-black text-[#10b981] block">{stats?.bettor_count ?? 0}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5">Number of bettors</span>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                      <span className="text-xl font-black text-[#ffa502] block">{stats?.first_deposit_count ?? 0}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">First deposit users</span>
                    </div>
                  </div>
                  <div className="space-y-4 pl-1">
                    <div>
                      <span className="text-xl font-black text-white block">{fmt(stats?.deposit_amount ?? 0)}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5">Deposit amount</span>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                      <span className="text-xl font-black text-[#10b981] block">{fmt(stats?.total_bet ?? 0)}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5">Total Bet</span>
                    </div>
                    <div className="border-t border-white/5 pt-4">
                      <span className="text-xl font-black text-[#ffa502] block">{fmt(stats?.first_deposit_amount ?? 0)}</span>
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5 leading-tight">First deposit amount</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Invitees tab */
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input type="text" placeholder="Search by phone number" value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-white/5 rounded-full py-3 pl-10 pr-4 text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
              {searchId && (
                <button onClick={() => setSearchId("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-4 text-center">
              <span className="text-xs font-bold text-gray-400 block uppercase">Total Direct Invitees</span>
              <span className="text-3xl font-black text-[#ffa502] block mt-1.5">{invitees.length} Players</span>
            </div>

            {invitees.length === 0 ? (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-[#ffa502]" />
                </div>
                <p className="text-xs font-bold text-gray-400">No invitees found.</p>
              </div>
            ) : (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
                <div className="grid grid-cols-4 bg-[#2C2C2E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                  <span>Phone</span>
                  <span>Total Bet</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {invitees.map((u) => (
                  <div key={u.id} className="grid grid-cols-4 p-3 text-xs text-center items-center gap-1">
                    <span className="font-mono text-white font-bold">{maskPhone(u.phone_number)}</span>
                    <span className="text-[#10b981] font-bold">Rs {Number(u.total_bets ?? 0).toFixed(0)}</span>
                    <span className={`text-[10px] font-black uppercase ${
                      u.account_status === "banned"    ? "text-red-500" :
                      u.account_status === "suspended" ? "text-yellow-500" : "text-green-400"
                    }`}>
                      {u.account_status ?? "active"}
                    </span>
                    <div className="flex flex-col gap-1 items-center">
                      <button onClick={() => handleAccountAction(u.id, "suspended")}
                        disabled={u.account_status === "suspended"}
                        className="w-full py-1 rounded-lg text-[10px] font-black bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Suspend
                      </button>
                      <button onClick={() => handleAccountAction(u.id, "banned")}
                        disabled={u.account_status === "banned"}
                        className="w-full py-1 rounded-lg text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Ban
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
