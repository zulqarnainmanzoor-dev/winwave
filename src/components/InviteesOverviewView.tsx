import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Search, Calendar, ChevronDown, X, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
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
  referral_code: string | null;
  invite_code: string | null;
  total_bets: number;
  account_status: string | null;
  created_at: string;
  referred_by: string | null;
}

interface SubordinateRow {
  id: string;
  uid: string;
  level: number;
  deposit_amount: number;
  commission: number;
  created_at: string;
  phone_number?: string;
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
  
  // DEBUG: Log uid on every render
  console.log('🔍 [InviteesOverview] Component render - uid:', uid, 'type:', typeof uid, 'length:', uid?.length);
  
  const [activeTab, setActiveTab]           = useState<"subordinate" | "invitees">("subordinate");
  const [searchId, setSearchId]             = useState("");
  const [selectedDate, setSelectedDate]     = useState("All");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLevel, setSelectedLevel]   = useState("All");
  const [showLevelDrop, setShowLevelDrop]   = useState(false);
  const [stats, setStats]                   = useState<SubStats | null>(null);
  const [invitees, setInvitees]             = useState<InviteeRow[]>([]);
  const [directIds, setDirectIds]           = useState<string[]>([]);
  const [loading, setLoading]               = useState(false);
  const [actionMsg, setActionMsg]           = useState<string | null>(null);
  const [subordinates, setSubordinates]     = useState<SubordinateRow[]>([]);
  const [subordinatesLoading, setSubordinatesLoading] = useState(false);
  
  const effectiveUid = uid;

  // ── Fetch subordinate stats ──────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!effectiveUid) {
      console.warn('⚠️ [InviteesOverview] No effectiveUid available, skipping fetchStats');
      return;
    }
    setLoading(true);

    console.log('📊 [InviteesOverview] Fetching stats for effectiveUid:', effectiveUid);

    // Build level filter: collect IDs at requested depth (Team A-G corresponds to Level 0-6)
    const { data: l1 } = await supabase.from("users").select("id").eq("referred_by", effectiveUid);
    const l1ids = (l1 ?? []).map((r: any) => r.id as string);

    let targetIds: string[] = [];
    let currentLevelIds = l1ids;
    
    // Team A = Level 1 (direct referrals)
    if (selectedLevel === "All" || selectedLevel === "Team A") targetIds.push(...l1ids);

    // Team B = Level 2
    if ((selectedLevel === "All" || selectedLevel === "Team B") && l1ids.length) {
      const { data: l2 } = await supabase.from("users").select("id").in("referred_by", l1ids);
      const l2ids = (l2 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l2ids);
      currentLevelIds = l2ids;
    }

    // Team C = Level 3
    if ((selectedLevel === "All" || selectedLevel === "Team C") && currentLevelIds.length) {
      const { data: l3 } = await supabase.from("users").select("id").in("referred_by", currentLevelIds);
      const l3ids = (l3 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l3ids);
      currentLevelIds = l3ids;
    }

    // Team D = Level 4
    if ((selectedLevel === "All" || selectedLevel === "Team D") && currentLevelIds.length) {
      const { data: l4 } = await supabase.from("users").select("id").in("referred_by", currentLevelIds);
      const l4ids = (l4 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l4ids);
      currentLevelIds = l4ids;
    }

    // Team E = Level 5
    if ((selectedLevel === "All" || selectedLevel === "Team E") && currentLevelIds.length) {
      const { data: l5 } = await supabase.from("users").select("id").in("referred_by", currentLevelIds);
      const l5ids = (l5 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l5ids);
      currentLevelIds = l5ids;
    }

    // Team F = Level 6
    if ((selectedLevel === "All" || selectedLevel === "Team F") && currentLevelIds.length) {
      const { data: l6 } = await supabase.from("users").select("id").in("referred_by", currentLevelIds);
      const l6ids = (l6 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l6ids);
      currentLevelIds = l6ids;
    }

    // Team G = Level 7
    if ((selectedLevel === "All" || selectedLevel === "Team G") && currentLevelIds.length) {
      const { data: l7 } = await supabase.from("users").select("id").in("referred_by", currentLevelIds);
      const l7ids = (l7 ?? []).map((r: any) => r.id as string);
      targetIds.push(...l7ids);
    }

    if (!targetIds.length) {
      setStats({ deposit_count: 0, deposit_amount: 0, total_bet: 0, bettor_count: 0, first_deposit_count: 0, first_deposit_amount: 0 });
      setLoading(false);
      return;
    }

    const dateRange = getDateRange(selectedDate);

    // Deposit stats
    let depQ = (supabase as any).from("deposit_history").select("user_id, amount, status").in("user_id", targetIds);
    if (dateRange) depQ = depQ.gte("created_at", dateRange.from).lt("created_at", dateRange.to);
    const { data: deps } = await depQ;

    const depRows = (deps ?? []).filter((d: any) =>
      ['success', 'completed', 'approved', 'done'].includes(String(d?.status || '').toLowerCase())
    );
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
    let betQ = (supabase as any).from("betting_history").select("user_id, amount").in("user_id", targetIds);
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
    if (!effectiveUid) {
      console.warn('⚠️ [InviteesOverview] No effectiveUid available, skipping fetchInvitees');
      return;
    }
    
    console.log('🔍 [InviteesOverview] Fetching invitees for effectiveUid:', effectiveUid);
    console.log('🔍 [InviteesOverview] Search term:', searchId.trim());
    
    // Always fetch direct invitees separately (independent of search)
    console.log('🔍 [InviteesOverview] Fetching DIRECT invitees for effectiveUid:', effectiveUid);
    const { data: directInvitees, error: directError } = await supabase
      .from("users")
      .select("id, phone_number, referral_code, invite_code, total_bets, created_at, referred_by")
      .eq('referred_by', effectiveUid)
      .order("created_at", { ascending: false });
    
    if (directError) {
      console.error('❌ [InviteesOverview] Error fetching direct invitees:', directError);
    }
    
    console.log('🔍 [InviteesOverview] Direct invitees found:', directInvitees?.length || 0);
    
    // If searching, perform separate searches for each field
    let searchResults: any[] = [];
    if (searchId.trim()) {
      const searchTerm = searchId.trim();
      console.log('🔍 [InviteesOverview] Executing search query for:', searchTerm);
      
      // Normalize search term for UID matching
      const normalizedSearch = searchTerm.replace(/-/g, '').toUpperCase();
      
      try {
        // Search 1: Match by id (exact or partial)
        const { data: idMatches, error: idError } = await supabase
          .from("users")
          .select("id, phone_number, referral_code, invite_code, total_bets, account_status, created_at, referred_by")
          .ilike('id', `%${searchTerm}%`);
        
        if (idError) throw idError;
        console.log('🔍 [InviteesOverview] ID matches:', idMatches?.length || 0);
        
        // Search 2: Match by referral_code
        const { data: codeMatches, error: codeError } = await supabase
          .from("users")
          .select("id, phone_number, referral_code, invite_code, total_bets, account_status, created_at, referred_by")
          .ilike('referral_code', `%${searchTerm}%`);
        
        if (codeError) throw codeError;
        console.log('🔍 [InviteesOverview] Code matches:', codeMatches?.length || 0);
        
        // Search 3: Match by phone_number
        const { data: phoneMatches, error: phoneError } = await supabase
          .from("users")
          .select("id, phone_number, referral_code, invite_code, total_bets, account_status, created_at, referred_by")
          .ilike('phone_number', `%${searchTerm}%`);
        
        if (phoneError) throw phoneError;
        console.log('🔍 [InviteesOverview] Phone matches:', phoneMatches?.length || 0);
        
        // Search 4: Match by referred_by (normalized)
        const { data: referredMatches, error: referredError } = await supabase
          .from("users")
          .select("id, phone_number, referral_code, invite_code, total_bets, account_status, created_at, referred_by")
          .ilike('referred_by', `%${normalizedSearch}%`);
        
        if (referredError) throw referredError;
        console.log('🔍 [InviteesOverview] Referred_by matches:', referredMatches?.length || 0);
        
        // Merge all results and remove duplicates
        const allMatches = [
          ...(idMatches || []),
          ...(codeMatches || []),
          ...(phoneMatches || []),
          ...(referredMatches || [])
        ];
        
        // Remove duplicates by id
        const uniqueMatches = Array.from(
          new Map(allMatches.map((item: any) => [item.id, item])).values()
        );
        
        searchResults = uniqueMatches;
        console.log('🔍 [InviteesOverview] Total unique search results:', searchResults.length);
        
      } catch (err: any) {
        console.error('❌ [InviteesOverview] Search error:', err);
        console.error('❌ [InviteesOverview] Error details:', err.message);
        // Fallback to direct invitees on error
        searchResults = directInvitees || [];
      }
    }
    
    // Use search results if searching, otherwise use direct invitees
    const finalInvitees = searchId.trim() ? searchResults : (directInvitees || []);
    
    console.log('🔍 [InviteesOverview] Final results:', finalInvitees.length);
    console.log('🔍 [InviteesOverview] First 5 results:', finalInvitees.slice(0, 5));
    
    // Get direct IDs for member type classification
    const directIdsList = (finalInvitees ?? []).filter((u: any) => u.referred_by === uid).map((u: any) => u.id);
    setDirectIds(directIdsList);
    
    setInvitees((finalInvitees ?? []) as InviteeRow[]);
    
    console.log('🔍 [InviteesOverview] Total invitees set:', (finalInvitees ?? []).length);
  }, [uid, searchId]);

  // ── Fetch subordinates list ──────────────────────────────────────
  const fetchSubordinates = useCallback(async () => {
    if (!effectiveUid) {
      console.warn('⚠️ [InviteesOverview] No effectiveUid available, skipping fetchSubordinates');
      return;
    }
    
    setSubordinatesLoading(true);
    console.log('🔍 [InviteesOverview] Fetching subordinates for effectiveUid:', effectiveUid);
    console.log('🔍 [InviteesOverview] Search filter:', searchId.trim());
    
    try {
      // Step 1: Get all direct members (Level 1) - users referred by current user
      const { data: directMembers, error: directError } = await supabase
        .from("users")
        .select("id, referral_code, invite_code, total_deposit, total_bets, created_at, phone_number, referred_by")
        .eq("referred_by", effectiveUid);
      
      if (directError) throw directError;
      
      console.log('🔍 [InviteesOverview] Direct members found:', directMembers?.length || 0);
      
      // Step 2: Get all team members (Level 2) - users referred by direct members
      const directMemberIds = (directMembers || []).map((m: any) => m.id);
      let teamMembers: any[] = [];
      
      if (directMemberIds.length > 0) {
        const { data: teamData, error: teamError } = await supabase
          .from("users")
          .select("id, referral_code, invite_code, total_deposit, total_bets, created_at, phone_number, referred_by")
          .in("referred_by", directMemberIds);
        
        if (teamError) throw teamError;
        teamMembers = teamData || [];
        
        console.log('🔍 [InviteesOverview] Team members found:', teamMembers.length);
      }
      
      // Step 3: Combine and process all subordinates
      const directMapped = (directMembers || []).map((m: any) => ({ ...m, level: 1 }));
      const teamMapped = teamMembers.map((m: any) => ({ ...m, level: 2 }));
      let allSubordinates = [
        ...directMapped,
        ...teamMapped
      ];
      
      // Step 4: Filter by search UID if provided
      if (searchId.trim()) {
        const searchTerm = searchId.trim().toUpperCase();
        console.log('🔍 [InviteesOverview] Filtering subordinates by search term:', searchTerm);
        
        allSubordinates = allSubordinates.filter((sub: any) => {
          const codeMatch = (sub.referral_code || '').toUpperCase().includes(searchTerm);
          const idMatch = sub.id.toUpperCase().includes(searchTerm);
          return codeMatch || idMatch;
        });
        
        console.log('🔍 [InviteesOverview] Filtered subordinates:', allSubordinates.length);
      }
      
      const memberIds = allSubordinates.map((sub: any) => sub.id).filter(Boolean);
      let commissionMap: Record<string, number> = {};
      if (memberIds.length > 0) {
        const { data: commissionRows, error: commissionError } = await supabase
          .from("referral_commissions")
          .select("inviter_id, amount")
          .in("inviter_id", memberIds);

        if (!commissionError) {
          for (const row of commissionRows || []) {
            commissionMap[row.inviter_id] = (commissionMap[row.inviter_id] || 0) + Number(row.amount || 0);
          }
        }
      }

      // Step 5: Map to SubordinateRow format - use referral_code as uid
      const mappedSubordinates: SubordinateRow[] = allSubordinates.map((sub: any) => ({
        id: sub.id,
        uid: sub.invite_code || sub.referral_code || sub.id.replace(/-/g, '').slice(0, 9),
        level: sub.level,
        deposit_amount: Number(sub.total_deposit || 0),
        commission: commissionMap[sub.id] || 0,
        created_at: sub.created_at,
        phone_number: sub.phone_number
      }));
      
      console.log('🔍 [InviteesOverview] Total subordinates set:', mappedSubordinates.length);
      setSubordinates(mappedSubordinates);
      
    } catch (err: any) {
      console.error('❌ [InviteesOverview] Error fetching subordinates:', err);
      console.error('❌ [InviteesOverview] Error details:', err.message);
      setSubordinates([]);
    } finally {
      setSubordinatesLoading(false);
    }
  }, [uid, searchId]);

  useEffect(() => { void fetchStats(); },   [fetchStats, effectiveUid]);
  useEffect(() => { void fetchInvitees(); }, [fetchInvitees, effectiveUid]);
  useEffect(() => { void fetchSubordinates(); }, [fetchSubordinates, effectiveUid]);

  const handleAccountAction = async (userId: string, action: "suspended" | "banned") => {
    const { error } = await (supabase as any).from("users").update({ account_status: action }).eq("id", userId);
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
                  {/* Table Header */}
                  <div className="grid grid-cols-5 bg-[#252528] p-2.5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <span className="text-center">UID</span>
                    <span className="text-center">Level</span>
                    <span className="text-center">Deposit Amount</span>
                    <span className="text-center">Commission</span>
                    <span className="text-center">Time</span>
                  </div>
                  
                  {/* Table Rows */}
                  {subordinates.map((sub) => (
                    <div key={sub.id} className="grid grid-cols-5 p-3 text-xs text-center items-center hover:bg-white/[0.02] transition-colors">
                      <span className="font-mono text-white font-bold text-[11px]">{sub.uid}</span>
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
              <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
                <div className="grid grid-cols-4 bg-[#2C2C2E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
                  <span>UID / Phone</span>
                  <span>Reg. Date</span>
                  <span>Member Type</span>
                  <span>Status</span>
                </div>
                {invitees.map((u: any) => {
                  const memberType = u.referred_by === uid ? "Direct" : "Team";
                  const statusLabel = u.account_status === "banned" ? "Banned" : u.account_status === "suspended" ? "Suspended" : "Active";
                  const statusClass = u.account_status === "banned" ? "text-red-500" : u.account_status === "suspended" ? "text-yellow-500" : "text-green-400";
                  const displayCode = u.invite_code || u.referral_code || "—";
                  return (
                    <div key={u.id} className="grid grid-cols-4 p-3 text-xs text-center items-center gap-1">
                      <div className="min-w-0">
                        <div className="font-mono text-white font-bold truncate">{maskPhone(u.phone_number)}</div>
                        <div className="text-[10px] text-gray-500 truncate">{displayCode}</div>
                      </div>
                      <span className="text-gray-400 text-[10px]">{new Date(u.created_at).toLocaleDateString()}</span>
                      <span className={`text-[10px] font-black uppercase ${memberType === "Direct" ? "text-[#ffa502]" : "text-green-400"}`}>
                        {memberType}
                      </span>
                      <span className={`text-[10px] font-black uppercase ${statusClass}`}>
                        {statusLabel}
                      </span>
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
