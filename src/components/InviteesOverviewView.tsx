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
  uid_short: string;
  phone_number: string;
  total_deposit: number;
  total_bets: number;
  created_at: string;
}

interface SubordinateRow {
  id: string;
  uid_short: string;
  level: number;
  today_deposit: number;
  today_commission: number;
  registration_date: string;
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
  const [selectedDate, setSelectedDate]     = useState("Today");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLevel, setSelectedLevel]   = useState("All");
  const [showLevelDrop, setShowLevelDrop]   = useState(false);
  const [stats, setStats]                   = useState<SubStats | null>(null);
  const [loading, setLoading]               = useState(false);
  const [actionMsg, setActionMsg]           = useState<string | null>(null);
  const [subordinates, setSubordinates]     = useState<SubordinateRow[]>([]);
  const [subordinatesLoading, setSubordinatesLoading] = useState(false);
  const [invitees, setInvitees]             = useState<InviteeRow[]>([]);
  const [inviteesLoading, setInviteesLoading] = useState(false);

  // ── Fetch CORRECT deposit stats (3,600 not 22,000) ──────────
  const fetchStats = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      console.log('[InviteesOverview] Fetching CORRECT deposit stats for uid:', uid);
      
      // Try new correct function first
      const { data, error } = await (adminSupabase as any)
        .rpc('get_correct_deposit_stats', { p_agent_id: uid });

      if (!error && data && data.length > 0) {
        const result = data[0];
        console.log('[InviteesOverview] Correct deposit stats:', result);
        
        // Show TODAY'S deposits from direct members only
        setStats({
          deposit_count:        Number(result.direct_members || 0),
          deposit_amount:       Number(result.direct_deposit_today || 0), // TODAY'S deposits
          total_bet:            0, // Not used
          bettor_count:         Number(result.direct_members || 0),
          first_deposit_count:  0, // Not used
          first_deposit_amount: 0, // Not used
        });
        return;
      }

      // Fallback: Get direct members and calculate manually
      console.log('[InviteesOverview] Using fallback calculation');
      
      const { data: members, error: membersError } = await (adminSupabase as any)
        .from("users")
        .select("id, total_deposit")
        .eq("referred_by", uid);

      if (membersError) throw membersError;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Calculate today's deposits for each member
      let todayTotal = 0;
      if (members && members.length > 0) {
        for (const member of members) {
          const { data: deposits } = await (adminSupabase as any)
            .from("deposit_history")
            .select("amount")
            .eq("user_id", member.id)
            .eq("status", "completed")
            .gte("created_at", todayStart.toISOString())
            .lt("created_at", todayEnd.toISOString());

          if (deposits) {
            todayTotal += deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
          }
        }
      }

      setStats({
        deposit_count:        members?.length || 0,
        deposit_amount:       todayTotal, // ACTUAL today's deposits
        total_bet:            0,
        bettor_count:         members?.length || 0,
        first_deposit_count:  0,
        first_deposit_amount: 0,
      });

    } catch (err) {
      console.error('[InviteesOverview] fetchStats failed:', err);
      setStats({ deposit_count: 0, deposit_amount: 0, total_bet: 0, bettor_count: 0, first_deposit_count: 0, first_deposit_amount: 0 });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // ── Fetch ALL team members with multi-level hierarchy and numeric UID ─────
  const fetchSubordinates = useCallback(async () => {
    if (!uid) return;
    setSubordinatesLoading(true);
    try {
      console.log('[InviteesOverview] Fetching team members for uid:', uid);
      
      // Use new RPC that gets today's deposits with 9-digit numeric UID
      const { data: teamMembers, error: teamError } = await (adminSupabase as any)
        .rpc('get_agent_team_today_deposits', { p_agent_id: uid });

      if (teamError) {
        console.error('[InviteesOverview] Team RPC error:', teamError);
        // Fallback to direct members only
        const { data: allMembers, error: membersError } = await (adminSupabase as any)
          .from("users")
          .select("id, referral_code, phone_number, vip_level, created_at, total_deposit")
          .eq("referred_by", uid)
          .order("created_at", { ascending: false });

        if (membersError) throw membersError;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const results = await Promise.all(
          (allMembers || []).map(async (member: any) => {
            // Get deposits today
            const { data: deposits } = await (adminSupabase as any)
              .from("deposit_history")
              .select("amount")
              .eq("user_id", member.id)
              .eq("status", "completed")
              .gte("created_at", todayStart.toISOString())
              .lt("created_at", todayEnd.toISOString());

            const todayDeposit = (deposits || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

            // Use 9-digit numeric UID from referral_code
            const numericUid = member.referral_code || '000000000';

            return {
              id: member.id,
              uid_short: numericUid,
              level: Number(member.vip_level || 0),
              today_deposit: todayDeposit,
              today_commission: 0,
              registration_date: member.created_at,
              is_direct_member: true,
            };
          })
        );
        
        let filtered = results;
        if (searchId.trim()) {
          const searchTerm = searchId.trim().toLowerCase();
          filtered = results.filter((sub) => {
            const uidMatch = (sub.uid_short || '').toLowerCase().includes(searchTerm);
            return uidMatch;
          });
        }
        setSubordinates(filtered);
        return;
      }

      console.log('[InviteesOverview] Team members found:', teamMembers?.length || 0);

      const results = (teamMembers || []).map((member: any) => ({
        id: member.member_id,
        uid_short: member.numeric_uid || '000000000',
        level: member.level || 0,
        today_deposit: Number(member.today_deposit || 0),
        today_commission: 0,
        registration_date: member.registration_date,
        is_direct_member: member.is_direct_member || false,
      }));

      let filtered = results;
      if (searchId.trim()) {
        const searchTerm = searchId.trim().toLowerCase();
        filtered = results.filter((sub) => {
          const uidMatch = (sub.uid_short || '').toLowerCase().includes(searchTerm);
          return uidMatch;
        });
      }

      console.log('[InviteesOverview] Subordinates after filter:', filtered.length);
      setSubordinates(filtered);
    } catch (err) {
      console.error('[InviteesOverview] fetchSubordinates failed:', err);
      setSubordinates([]);
    } finally {
      setSubordinatesLoading(false);
    }
  }, [uid, searchId]);

  // ── Fetch ALL invitees (lifetime) for Invitees tab with numeric UID ───────
  const fetchInvitees = useCallback(async () => {
    if (!uid) return;
    setInviteesLoading(true);
    try {
      // Use new RPC for complete invited members data
      const { data: invitedMembers, error: rpcError } = await (adminSupabase as any)
        .rpc('get_agent_invited_members_complete', { p_agent_id: uid });

      if (rpcError) {
        console.error('[InviteesOverview] RPC error:', rpcError);
        // Fallback to direct query
        const { data, error } = await (adminSupabase as any)
          .from("users")
          .select("id, referral_code, phone_number, total_deposit, total_bets, vip_level, created_at")
          .eq("referred_by", uid)
          .order("created_at", { ascending: false });

        if (error) throw error;

        let results = (data || []).map((u: any) => {
          // Use 9-digit numeric UID from referral_code
          const numericUid = u.referral_code || '000000000';
          
          return {
            id: u.id,
            uid_short: numericUid,
            original_uid: numericUid,
            phone_number: u.phone_number || '',
            total_deposit: Number(u.total_deposit || 0),
            total_bets: Number(u.total_bets || 0),
            created_at: u.created_at,
          };
        });

        if (searchId.trim()) {
          const searchTerm = searchId.trim().toLowerCase();
          results = results.filter((invitee) => {
            const uidMatch = (invitee.uid_short || '').toLowerCase().includes(searchTerm) ||
                            (invitee.original_uid || '').toLowerCase().includes(searchTerm);
            const phoneMatch = (invitee.phone_number || '').toLowerCase().includes(searchTerm);
            return uidMatch || phoneMatch;
          });
        }

        setInvitees(results);
        return;
      }

      let results = (invitedMembers || []).map((member: any) => ({
        id: member.member_id,
        uid_short: member.numeric_uid || '000000000',
        original_uid: member.numeric_uid || '000000000',
        phone_number: member.phone_number || '',
        total_deposit: Number(member.lifetime_deposit || 0),
        total_bets: Number(member.total_bets || 0),
        created_at: member.registration_date,
      }));

      if (searchId.trim()) {
        const searchTerm = searchId.trim().toLowerCase();
        results = results.filter((invitee) => {
          const uidMatch = (invitee.uid_short || '').toLowerCase().includes(searchTerm) ||
                          (invitee.original_uid || '').toLowerCase().includes(searchTerm);
          const phoneMatch = (invitee.phone_number || '').toLowerCase().includes(searchTerm);
          return uidMatch || phoneMatch;
        });
      }

      setInvitees(results);
    } catch (err) {
      console.error('[InviteesOverview] fetchInvitees failed:', err);
      setInvitees([]);
    } finally {
      setInviteesLoading(false);
    }
  }, [uid, searchId]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);
  useEffect(() => { void fetchSubordinates(); }, [fetchSubordinates]);
  useEffect(() => { void fetchInvitees(); }, [fetchInvitees]);

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
              {t === "subordinate" ? "Daily Report" : "Invitees"}
            </button>
          ))}
        </div>

        {actionMsg && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3 text-sm text-orange-300">{actionMsg}</div>
        )}

        {activeTab === "subordinate" ? (
          <>
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
                      <span className="text-[10px] font-bold text-gray-500 block uppercase mt-0.5">Deposit users</span>
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
                  All Members ({subordinates.length})
                </h3>
              </div>

              {subordinatesLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : subordinates.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-500">No members found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <div className="grid grid-cols-5 bg-[#252528] p-2.5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <span className="text-center">UID</span>
                    <span className="text-center">Level</span>
                    <span className="text-center">Today Deposit</span>
                    <span className="text-center">Commission</span>
                    <span className="text-center">Registered</span>
                  </div>
                  {subordinates.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-5 p-3 text-xs text-center items-center hover:bg-white/[0.02] transition-colors">
                      <span className="font-mono text-white font-bold text-[11px]">{sub.uid_short}</span>
                      <span className="text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                          sub.level === 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {sub.level}
                        </span>
                      </span>
                      <span className="text-green-400 font-bold text-[11px]">{fmt(sub.today_deposit)}</span>
                      <span className="text-[#ffa502] font-bold text-[11px]">{fmt(sub.today_commission)}</span>
                      <span className="text-gray-400 text-[10px]">{new Date(sub.registration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                {searchId ? "Search Results" : "Total Invitees"}
              </span>
              <span className="text-3xl font-black text-[#ffa502] block mt-1.5">
                {invitees.length}
              </span>
            </div>

            {inviteesLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : invitees.length === 0 ? (
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-10 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-gray-600 mx-auto" />
                <p className="text-xs font-bold text-gray-400">
                  {searchId ? "No invitees found matching your search." : "No invitees yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitees.map((invitee) => (
                  <div key={invitee.id} className="rounded-3xl border border-white/5 bg-[#1C1C1E] p-4 shadow-[0_8px_16px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">UID</div>
                        <div className="text-sm font-black text-white">{invitee.uid_short || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Phone</div>
                        <div className="text-sm font-black text-white">{invitee.phone_number || "—"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-2xl bg-black/20 p-2">
                        <div className="uppercase text-gray-500">Total Deposit</div>
                        <div className="mt-1 font-semibold text-green-400">{fmt(invitee.total_deposit)}</div>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-2">
                        <div className="uppercase text-gray-500">Total Bets</div>
                        <div className="mt-1 font-semibold text-white">{fmt(invitee.total_bets)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-400">
                      Registered: {new Date(invitee.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
