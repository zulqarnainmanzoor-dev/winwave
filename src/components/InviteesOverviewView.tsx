import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Search, Calendar, ChevronDown, X, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { adminSupabase } from "../lib/adminSupabase";
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
  referral_code: string | null;
  phone_number: string | null;
  invite_code: string | null;
  total_bets: number;
  account_status: string | null;
  created_at: string;
  referred_by: string | null;
  main_balance?: number | null;
  game_balance?: number | null;
  total_deposit?: number | null;
  total_withdrawal?: number | null;
  vip_level?: number | null;
}

interface SubordinateRow {
  id: string;
  referral_code: string | null;
  phone_number?: string;
  level: number;
  deposit_amount: number;
  commission: number;
  created_at: string;
}

const DATE_OPTIONS = ["All", "Today", "Yesterday", "This Week", "This Month", "Last Month"];
const LEVEL_OPTIONS = ["All", "Team A", "Team B", "Team C", "Team D", "Team E", "Team F", "Team G"];

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
  const [subordinates, setSubordinates]     = useState<SubordinateRow[]>([]);
  const [subordinatesLoading, setSubordinatesLoading] = useState(false);

  // ── Fetch subordinate stats ──────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data: rows, error } = await adminSupabase
        .from('users')
        .select('id, total_deposit, total_bets')
        .eq('referred_by', uid);

      if (error) throw error;

      const r = (rows || []) as Array<{ id: string; total_deposit: number | null; total_bets: number | null }>;
      const depositUsers  = r.filter(u => Number(u.total_deposit || 0) > 0).length;
      const totalDeposits = r.reduce((s, u) => s + Number(u.total_deposit || 0), 0);
      const totalBets     = r.reduce((s, u) => s + Number(u.total_bets || 0), 0);

      setStats({
        deposit_count:        r.length,
        deposit_amount:       totalDeposits,
        total_bet:            totalBets,
        bettor_count:         depositUsers,
        first_deposit_count:  depositUsers,
        first_deposit_amount: totalDeposits,
      });
    } catch (err) {
      console.error('[InviteesOverview] fetchStats failed:', err);
      setStats({ deposit_count: 0, deposit_amount: 0, total_bet: 0, bettor_count: 0, first_deposit_count: 0, first_deposit_amount: 0 });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // ── Fetch invitees list (Invitees tab) ───────────────────────────
  const fetchInvitees = useCallback(async () => {
    if (!uid) return;
    try {
      const { data, error } = await adminSupabase
        .from('users')
        .select('id, referral_code, phone_number, invite_code, total_bets, account_status, created_at, referred_by, main_balance, game_balance, total_deposit, total_withdrawal, vip_level')
        .eq('referred_by', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let results = (data || []) as InviteeRow[];

      // Filter by search term (UID or phone number)
      if (searchId.trim()) {
        const searchTerm = searchId.trim().toLowerCase();
        results = results.filter((user) => {
          // Search by numeric UID (referral_code field)
          const uidMatch = (user.referral_code || '').toLowerCase().includes(searchTerm);
          
          // Search by phone number
          const phoneMatch = (user.phone_number || '').toLowerCase().includes(searchTerm);
          
          return uidMatch || phoneMatch;
        });
      }

      setInvitees(results);
    } catch (err) {
      console.error('[InviteesOverview] fetchInvitees failed:', err);
      setInvitees([]);
    }
  }, [uid, searchId]);

  // ── Fetch subordinates list (Subordinate tab) ────────────────────
  const fetchSubordinates = useCallback(async () => {
    if (!uid) return;
    setSubordinatesLoading(true);
    try {
      const { data, error } = await adminSupabase
        .from('users')
        .select('id, referral_code, phone_number, created_at, referred_by, total_deposit, vip_level')
        .eq('referred_by', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let results = (data || []).map((sub: any) => ({
        id:             sub.id,
        referral_code:  sub.referral_code,
        phone_number:   sub.phone_number,
        level:          Number(sub.vip_level || 0),
        deposit_amount: Number(sub.total_deposit || 0),
        commission:     0,
        created_at:     sub.created_at,
      }));

      // Filter by search term (UID or phone number)
      if (searchId.trim()) {
        const searchTerm = searchId.trim().toLowerCase();
        results = results.filter((sub) => {
          // Search by numeric UID (referral_code field)
          const uidMatch = (sub.referral_code || '').toLowerCase().includes(searchTerm);
          
          // Search by phone number
          const phoneMatch = (sub.phone_number || '').toLowerCase().includes(searchTerm);
          
          return uidMatch || phoneMatch;
        });
      }

      setSubordinates(results);
    } catch (err) {
      console.error('[InviteesOverview] fetchSubordinates failed:', err);
      setSubordinates([]);
    } finally {
      setSubordinatesLoading(false);
    }
  }, [uid, searchId]);

  useEffect(() => { void fetchStats(); },        [fetchStats]);
  useEffect(() => { void fetchInvitees(); },     [fetchInvitees]);
  useEffect(() => { void fetchSubordinates(); }, [fetchSubordinates]);

  const handleAccountAction = async (userId: string, action: "suspended" | "banned") => {
    const { error } = await (supabase as any).from("users").update({ account_status: action }).eq("id", userId);
    if (error) { setActionMsg("Action failed: " + error.message); return; }
    setActionMsg(`User ${action} successfully.`);
    setTimeout(() => setActionMsg(null), 3000);
    void fetchInvitees();
  };

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

            {/* Subordinates List */}
            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
              <div className="bg-[#2C2C2E] p-3 border-b border-white/5">
                <h3 className="text-xs font-black text-white uppercase tracking-wider text-center">
                  Subordinates List ({subordinates.length})
                </h3>
              </div>

              {subordinatesLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : subordinates.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-500">No subordinates found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <div className="grid grid-cols-5 bg-[#252528] p-2.5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <span className="text-center">UID</span>
                    <span className="text-center">Level</span>
                    <span className="text-center">Deposit Amount</span>
                    <span className="text-center">Commission</span>
                    <span className="text-center">Time</span>
                  </div>
                  {subordinates.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-5 p-3 text-xs text-center items-center hover:bg-white/[0.02] transition-colors">
                      <span className="font-mono text-white font-bold text-[11px]">{(sub.referral_code || '').toUpperCase()}</span>
                      <span className="text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                          sub.level === 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {sub.level}
                        </span>
                      </span>
                      <span className="text-white font-bold text-[11px]">{fmt(sub.deposit_amount)}</span>
                      <span className="text-[#ffa502] font-bold text-[11px]">{fmt(sub.commission)}</span>
                      <span className="text-gray-400 text-[10px]">{new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Invitees tab */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input type="text" placeholder="Search by UID or Phone Number" value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full bg-[#1C1C1E] border border-white/5 rounded-full py-3 pl-10 pr-4 text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
              {searchId && (
                <button onClick={() => setSearchId("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-4 text-center">
              <span className="text-xs font-bold text-gray-400 block uppercase">
                {searchId ? "Search Results" : "Total Direct Invitees"}
              </span>
              <span className="text-3xl font-black text-[#ffa502] block mt-1.5">
                {invitees.length} {searchId ? "User" : "Players"}
              </span>
            </div>

            {invitees.length === 0 ? (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-[#ffa502]" />
                </div>
                <p className="text-xs font-bold text-gray-400">
                  {searchId ? "No users found matching your search." : "No invitees found."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitees.map((u: any) => {
                  const statusLabel = u.account_status === "banned" ? "Banned" : u.account_status === "suspended" ? "Suspended" : "Active";
                  const statusClass = u.account_status === "banned" ? "text-red-500" : u.account_status === "suspended" ? "text-yellow-500" : "text-green-400";
                  const shortUid = (u.referral_code || "").toUpperCase();
                  const deposit = Number(u.total_deposit || 0);
                  const withdrawal = Number(u.total_withdrawal || 0);
                  const mainBalance = Number(u.main_balance || 0);
                  const gameBalance = Number(u.game_balance || 0);
                  const vipLevel = Number(u.vip_level || 0);
                  const registeredAt = u.created_at ? new Date(u.created_at) : null;
                  const registeredText = registeredAt ? registeredAt.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
                  return (
                    <div key={u.id} className="rounded-3xl border border-white/5 bg-[#1C1C1E] p-4 shadow-[0_8px_16px_rgba(0,0,0,0.35)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">UID</div>
                          <div className="text-sm font-black text-white">{shortUid || "—"}</div>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusClass}`}>
                          {statusLabel}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Phone</div>
                          <div className="mt-1 font-semibold text-white">{u.phone_number || "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Registered</div>
                          <div className="mt-1 font-semibold text-white">{registeredText}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Deposit</div>
                          <div className="mt-1 font-semibold text-white">{deposit.toFixed(2)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Withdraw</div>
                          <div className="mt-1 font-semibold text-white">{withdrawal.toFixed(2)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Main Balance</div>
                          <div className="mt-1 font-semibold text-white">{mainBalance.toFixed(2)}</div>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-2">
                          <div className="text-[10px] uppercase text-gray-500">Game Balance</div>
                          <div className="mt-1 font-semibold text-white">{gameBalance.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                        <span>VIP Level: {vipLevel}</span>
                        <span>Direct</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
