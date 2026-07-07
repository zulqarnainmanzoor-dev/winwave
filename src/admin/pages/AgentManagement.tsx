import React, { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { adminSupabase } from "../../lib/adminSupabase";

interface AgentData {
  id: string;
  phone: string;
  main_balance: number;
  game_balance: number;
  vip_level: number;
  invite_code: string;
  total_bets: number;
  created_at: string;
  direct_members: number;
  team_members: number;
  yesterday_commission: number;
  status: "active" | "suspended";
  is_agent?: boolean;
  invited_members?: Array<{
    id: string;
    invite_code: string;
    phone_number: string;
    created_at: string;
    total_deposit: number;
    total_bets: number;
  }>;
}

interface Agent {
  id: string;
  phone: string;
  username: string;
  uid: string;
  main_balance: number;
  game_balance: number;
}

// ── Modal ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-[#0f3460] rounded-t-2xl sm:rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function AgentManagement() {
  const [agentUID, setAgentUID]           = useState("");
  const [agentData, setAgentData]         = useState<AgentData | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [salaryAmount, setSalaryAmount]   = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [showSalaryModal, setShowSalaryModal]   = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [agents, setAgents]               = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [converting, setConverting]       = useState(false);
  // Mobile: toggle between search panel and details
  const [mobileTab, setMobileTab]         = useState<"search" | "details">("search");
  // Mobile: collapsible agent list
  const [agentListOpen, setAgentListOpen] = useState(false);
  // Agent Fraud Analysis
  const [fraudResult, setFraudResult]     = useState<any>(null);
  const [fraudLoading, setFraudLoading]   = useState(false);
  const [showFraudModal, setShowFraudModal] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      setAgentsLoading(true);
      try {
        const { data, error } = await (adminSupabase as any)
          .from("users")
          .select("id, phone_number, referral_code, main_balance, game_balance, created_at, is_agent")
          .eq("is_agent", true)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        setAgents((data || []).map((row: any) => {
          const realUID = row.referral_code || '';
          return {
            id:           row.id,
            phone:        row.phone_number || "",
            username:     realUID,
            uid:          realUID,
            main_balance: Number(row.main_balance ?? 0),
            game_balance: Number(row.game_balance ?? 0),
          };
        }));
      } catch (err) {
        console.warn("Failed to load agents", err);
      } finally {
        setAgentsLoading(false);
      }
    };
    void fetchAgents();
  }, []);

  const handleFetchAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setAgentData(null); setLoading(true);
    try {
      const trimmed = agentUID.trim();

      // Guard: empty input would produce an invalid query (id=eq. → 400)
      if (!trimmed) {
        setError("Please enter a UID, phone number, or invite code.");
        return;
      }

      const isUUID       = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      const isPhone      = /^\d{10,15}$/.test(trimmed);
      const isInviteCode = /^[a-zA-Z0-9]{4,12}$/.test(trimmed) && !isUUID && !isPhone;

      let q = (adminSupabase as any)
        .from("users")
        .select("id, phone_number, referral_code, main_balance, game_balance, vip_level, created_at, is_agent");

      let data: any = null;
      let fetchErr: any = null;

      if (isUUID) {
        const result = await q.eq("id", trimmed).maybeSingle();
        ({ data, error: fetchErr } = result);
      } else if (isInviteCode) {
        const result = await q.eq("referral_code", trimmed).maybeSingle();
        ({ data, error: fetchErr } = result);
      } else if (isPhone) {
        const result = await q.eq("phone_number", trimmed).maybeSingle();
        ({ data, error: fetchErr } = result);
      } else {
        const baseSelect = "id, phone_number, referral_code, main_balance, game_balance, vip_level, created_at, is_agent";
        const [idResult, codeResult, phoneResult] = await Promise.all([
          (adminSupabase as any).from("users").select(baseSelect).eq("id", trimmed).maybeSingle(),
          (adminSupabase as any).from("users").select(baseSelect).eq("referral_code", trimmed).maybeSingle(),
          (adminSupabase as any).from("users").select(baseSelect).eq("phone_number", trimmed).maybeSingle()
        ]);
        data = idResult.data || codeResult.data || phoneResult.data;
        if (!idResult.data && !codeResult.data && !phoneResult.data) {
          fetchErr = idResult.error || codeResult.error || phoneResult.error;
        }
      }

      if (fetchErr) throw fetchErr;
      if (!data) { 
        setError("User not found. Try phone, 6-digit invite code, or UUID."); 
        return; 
      }
      const user = data as any;

      // Fetch dashboard stats using RPC (resilient: never throw on missing function)
      let stats: { total_bets?: number; total_members?: number; today_commission?: number } = {};
      try {
        const { data: dashStats, error: dashError } = await (adminSupabase as any)
          .rpc("get_agent_stats_simple", { p_agent_id: user.id });
        
        if (!dashError && dashStats && dashStats.length > 0) {
          stats = dashStats[0];
        } else if (dashError) {
          // Fallback to old function
          const { data: oldStats, error: oldError } = await (adminSupabase as any)
            .rpc("get_agent_dashboard_stats", { p_agent_id: user.id });
          
          if (!oldError && oldStats && oldStats.length > 0) {
            stats = oldStats[0];
          } else {
            console.warn('Dashboard stats RPC unavailable, using defaults:', oldError?.message || dashError?.message);
          }
        }
      } catch (err) {
        console.warn('Error fetching dashboard stats:', err);
      }

      // Fetch invited members (resilient: fall back to direct query on any error)
      let invitedMembers: any[] | null = null;
      try {
        const { data: members, error: membersError } = await (adminSupabase as any)
          .rpc('get_agent_members_with_deposits', { p_agent_id: user.id });
        if (!membersError && members) {
          invitedMembers = members;
        } else {
          console.warn('get_agent_members_with_deposits unavailable, using direct query:', membersError?.message);
        }
      } catch (err) {
        console.warn('Error fetching invited members via RPC:', err);
      }

      // If RPC failed, fall back to a direct query against the users table
      if (invitedMembers === null) {
        const { data: simpleMembers } = await (adminSupabase as any)
          .from("users")
          .select("id, referral_code, phone_number, created_at, total_deposit, total_bets")
          .eq("referred_by", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        invitedMembers = (simpleMembers || []).map((m: any) => ({
          member_id:     m.id,
          member_uid:    m.referral_code || "",
          member_phone:  m.phone_number || "",
          joined_at:     m.created_at || "",
          lifetime_deposit: Number(m.total_deposit || 0),
          total_bets:    Number(m.total_bets || 0),
        }));
      }

      setAgentData({
        id:                   user.id,
        phone:                user.phone_number || "",
        main_balance:         Number(user.main_balance ?? 0),
        game_balance:         Number(user.game_balance ?? 0),
        vip_level:            user.vip_level || 0,
        invite_code:          user.referral_code || "",
        total_bets:           Number(stats.total_bets ?? 0),
        created_at:           user.created_at || "",
        direct_members:       Number(stats.total_members ?? 0),
        team_members:         Number(stats.total_members ?? 0),
        yesterday_commission: Number(stats.today_commission ?? 0),
        status:               "active",
        is_agent:             Boolean(user.is_agent),
        invited_members:      (invitedMembers || []).map((m: any) => ({
          id:            m.member_id ?? m.id,
          invite_code:   m.member_uid ?? m.referral_code ?? "",
          phone_number:  m.member_phone ?? m.phone_number ?? "",
          created_at:    m.joined_at ?? m.created_at ?? "",
          total_deposit: Number(m.lifetime_deposit ?? m.total_deposit ?? 0),
          total_bets:    Number(m.total_bets ?? m.total_bets ?? 0),
        })),
      });
      setMobileTab("details");
    } catch (err: any) {
      console.error("Error fetching agent:", err);
      setError("Failed to fetch user data. " + (err?.message ? `(${err.message})` : ""));
    } finally {
      setLoading(false);
    }
  };

  const copyUID = () => {
    if (!agentData?.invite_code) return;
    navigator.clipboard.writeText(agentData.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConvertToAgent = async () => {
    if (!agentData) return;
    setConverting(true);
    try {
      const { error } = await (adminSupabase as any).from("users").update({ is_agent: true }).eq("id", agentData.id);
      if (error) throw error;
      setAgentData({ ...agentData, is_agent: true });
      setAgents(prev => {
        if (prev.find(a => a.id === agentData.id)) return prev;
        const realUID = agentData.invite_code || '';
        return [{ id: agentData.id, phone: agentData.phone, username: realUID, uid: realUID, main_balance: agentData.main_balance, game_balance: agentData.game_balance }, ...prev];
      });
    } catch (err: any) {
      alert("Failed to convert: " + (err?.message || "Unknown error"));
    } finally {
      setConverting(false);
    }
  };

  const handleGiveSalary = async () => {
    if (!agentData || !salaryAmount) return;
    const newBal = agentData.main_balance + parseFloat(salaryAmount);
    const { error } = await (adminSupabase as any).from("users").update({ main_balance: newBal }).eq("id", agentData.id);
    if (!error) { setAgentData({ ...agentData, main_balance: newBal }); setSalaryAmount(""); setShowSalaryModal(false); }
  };

  const handleGiveAdvance = async () => {
    if (!agentData || !advanceAmount) return;
    const newBal = agentData.main_balance + parseFloat(advanceAmount);
    const { error } = await (adminSupabase as any).from("users").update({ main_balance: newBal }).eq("id", agentData.id);
    if (!error) { setAgentData({ ...agentData, main_balance: newBal }); setAdvanceAmount(""); setShowAdvanceModal(false); }
  };

  // ── Agent Fraud Network Analysis ─────────────────────────────────
  const handleAnalyzeFraud = async () => {
    if (!agentData) return;
    setFraudLoading(true); setFraudResult(null);
    try {
      // Call the fixed analyze_agent_network_fraud RPC
      const { data, error } = await (adminSupabase as any)
        .rpc("analyze_agent_network_fraud", { p_agent_id: agentData.id });
      
      if (error) throw error;

      // The RPC returns an array with one row
      const result = data?.[0] || {};
      
      setFraudResult({
        total_network_accounts: result.total_network_accounts || 0,
        unique_genuine_profiles: result.unique_genuine_profiles || 0,
        today_deposits: result.today_deposits || 0,
        today_withdrawals: result.today_withdrawals || 0,
        lifetime_deposits: result.lifetime_deposits || 0,
        lifetime_withdrawals: result.lifetime_withdrawals || 0,
        flagged_accounts: result.flagged_accounts || []
      });
      setShowFraudModal(true);
    } catch (err: any) {
      alert("Fraud analysis failed: " + (err?.message || "Unknown error"));
    } finally {
      setFraudLoading(false);
    }
  };

  // ── Multi-UID Scanner ─────────────────────────────────────────────
  const [scanUIDs, setScanUIDs]             = useState("");
  const [scanResults, setScanResults]       = useState<any[]>([]);
  const [scanLoading, setScanLoading]       = useState(false);

  const handleMultiUIDScan = async () => {
    if (!scanUIDs.trim()) return;
    setScanLoading(true); setScanResults([]);
    const uids = scanUIDs.split("\n").map(u => u.trim()).filter(Boolean);
    try {
      // Fetch all users by invite_code in one query
      const { data: users, error: usersErr } = await (adminSupabase as any)
        .from("users")
        .select("invite_code, referred_by, registered_ip, main_balance, game_balance, phone_number")
        .in("invite_code", uids);
      if (usersErr) throw usersErr;

      // Build a map of invite_code -> user data
      const userMap = new Map((users || []).map((u: any) => [u.invite_code, u]));

      // For each UID, fetch deposit and withdrawal totals from transactions
      const results = await Promise.all(
        uids.map(async (uid) => {
          const user = userMap.get(uid) as any;
          if (!user) {
            return { uid, error: "Not found", parent_uid: "—", invite_url: "—", total_deposit: 0, total_withdrawal: 0, duplicate_ips: [] };
          }

          // Get total deposits
          const { data: deposits } = await (adminSupabase as any)
            .from("transactions")
            .select("amount")
            .eq("user_id", user.id)
            .eq("type", "deposit")
            .eq("status", "completed");

          // Get total withdrawals
          const { data: withdrawals } = await (adminSupabase as any)
            .from("transactions")
            .select("amount")
            .eq("user_id", user.id)
            .eq("type", "withdrawal")
            .eq("status", "completed");

          const totalDeposit = (deposits || []).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
          const totalWithdrawal = (withdrawals || []).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

          // Find duplicate IPs: find all users with same registered_ip
          let duplicateIPs: string[] = [];
          if (user.registered_ip) {
            const { data: sameIPUsers } = await (adminSupabase as any)
              .from("users")
              .select("invite_code, phone_number")
              .eq("registered_ip", user.registered_ip)
              .neq("id", user.id)
              .limit(10);
            duplicateIPs = (sameIPUsers || []).map((u: any) => u.invite_code || u.phone_number || "Unknown");
          }

          return {
            uid,
            parent_uid: user.referred_by || "None",
            invite_url: `${window.location.origin}/register?ref=${user.invite_code || uid}`,
            total_deposit: totalDeposit,
            total_withdrawal: totalWithdrawal,
            duplicate_ips: duplicateIPs,
            phone: user.phone_number || "—",
          };
        })
      );

      setScanResults(results);
    } catch (err: any) {
      alert("Scan failed: " + (err?.message || "Unknown error"));
    } finally {
      setScanLoading(false);
    }
  };

  // ── Shared: Agent Details content ────────────────────────────────
  const AgentDetails = () => agentData ? (
    <div className="space-y-4">
      {/* Info strip */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><p className="text-gray-400 text-xs mb-1">UID</p><p className="text-orange-500 font-black text-xl font-mono">{agentData.invite_code || "------"}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">VIP</p><p className="text-orange-500 font-bold text-lg">{agentData.vip_level}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">Since</p><p className="text-white font-bold text-sm">{new Date(agentData.created_at).toLocaleDateString()}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">Status</p><p className="text-green-400 font-bold">Active</p></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Direct Members", value: agentData.direct_members, color: "text-white" },
          { label: "Active Members",   value: agentData.team_members,   color: "text-green-400" },
          { label: "Today Commission",     value: `Rs ${agentData.yesterday_commission.toLocaleString()}`, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
            <p className="text-gray-400 text-xs mb-1">{s.label}</p>
            <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
          <p className="text-gray-400 text-xs mb-1">Main Balance</p>
          <p className="text-white font-bold text-xl mb-3">Rs {agentData.main_balance.toLocaleString()}</p>
          <button onClick={() => setShowSalaryModal(true)}
            className="w-full py-2.5 bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg text-sm font-bold min-h-[44px]">
            Give Salary
          </button>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
          <p className="text-gray-400 text-xs mb-1">Game Balance</p>
          <p className="text-white font-bold text-xl mb-3">Rs {agentData.game_balance.toLocaleString()}</p>
          <button onClick={() => setShowAdvanceModal(true)}
            className="w-full py-2.5 bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg text-sm font-bold min-h-[44px]">
            Release Advance
          </button>
        </div>
      </div>

      {/* Invite code + convert */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
        <p className="text-gray-400 text-xs mb-2">Invite Code (UID)</p>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-[#0f3460] border border-[#1a5f7a] px-4 py-2.5 rounded-lg flex items-center gap-2">
            <span className="text-gray-400 text-sm">UID |</span>
            <span className="text-orange-500 font-black text-lg tracking-widest font-mono">{agentData.invite_code || "------"}</span>
          </div>
          <button onClick={copyUID}
            className={`px-4 rounded-lg font-bold transition-all min-h-[44px] min-w-[44px] ${copied ? "bg-green-500 text-white" : "bg-orange-500/30 text-orange-400 border border-orange-500/50"}`}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <button onClick={handleConvertToAgent} disabled={converting || agentData.is_agent}
          className="w-full py-2.5 rounded-lg font-bold text-sm border min-h-[44px] transition-all"
          style={agentData.is_agent
            ? { background: "rgba(16,185,129,0.1)", color: "#6ee7b7", borderColor: "rgba(16,185,129,0.4)", cursor: "default" }
            : { background: "rgba(16,185,129,0.15)", color: "#34d399", borderColor: "rgba(16,185,129,0.5)" }}>
          {converting ? "Converting..." : agentData.is_agent ? "✓ Already an Agent" : "⚡ Convert to Agent"}
        </button>

        {/* Agent Fraud Analysis Button */}
        <button onClick={handleAnalyzeFraud} disabled={fraudLoading}
          className="w-full py-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/40 rounded-lg font-bold text-sm hover:bg-red-500/30 disabled:opacity-50 min-h-[44px] mt-3">
          {fraudLoading ? "🔍 Analyzing Network..." : "🛡️ Analyze Agent Fraud Network"}
        </button>
      </div>

      {/* Invited Members List */}
      {agentData.invited_members && agentData.invited_members.length > 0 && (
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
          <h3 className="text-white font-bold text-sm mb-3">Invited Members ({agentData.invited_members.length})</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {agentData.invited_members.map((member) => (
              <div key={member.id} className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-orange-500 font-bold text-xs font-mono">UID: {member.invite_code || '000000000'}</span>
                  <span className="text-gray-400 text-[10px]">{new Date(member.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-gray-300 text-xs mb-1">Phone: {member.phone_number || "N/A"}</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-gray-500">Deposit:</span>
                    <span className="text-green-400 font-bold ml-1">Rs {member.total_deposit.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bets:</span>
                    <span className="text-white font-bold ml-1">Rs {member.total_bets.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
      Search an agent to view details
    </div>
  );

  // ── Search panel content ──────────────────────────────────────────
  const SearchPanel = () => (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-5 border border-[#0f3460] shadow-lg">
      <h3 className="text-white font-bold text-base mb-4">Find Agent</h3>
      <form onSubmit={handleFetchAgent} className="space-y-3">
        <input type="text" value={agentUID} onChange={e => setAgentUID(e.target.value)}
          placeholder="Search by UID, phone, or invite code..."
          className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2.5 rounded-lg focus:border-orange-500 focus:outline-none text-sm" />
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg disabled:opacity-50 min-h-[44px]">
          {loading ? "Searching..." : "Search Agent"}
        </button>
      </form>
      {error && <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm">{error}</div>}

      {/* Collapsible agent list */}
      <div className="mt-5">
        <button onClick={() => setAgentListOpen(o => !o)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 mb-2">
          <span>Live Agent Accounts ({agents.length})</span>
          {agentListOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {agentListOpen && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {agentsLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-gray-500">No agents yet.</p>
            ) : agents.map(agent => (
              <button key={agent.id}
                onClick={() => { setAgentUID(agent.uid); setAgentListOpen(false); }}
                className="w-full rounded-lg border border-[#1a5f7a] bg-[#0f3460]/70 p-3 text-left hover:border-orange-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{agent.username}</p>
                    <p className="text-gray-400 text-xs">{agent.phone}</p>
                  </div>
                  <span className="text-xs text-orange-500 font-mono">{agent.uid}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b] min-h-screen">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-orange-500 mb-1">Agent Management</h1>
          <p className="text-gray-400 text-sm">Search, manage agents, and handle commissions</p>
        </div>

        {/* ── MOBILE layout ─────────────────────────────────────────── */}
        <div className="md:hidden">
          {/* Tab switcher */}
          <div className="flex gap-2 mb-4">
            {(["search", "details"] as const).map(tab => (
              <button key={tab} onClick={() => setMobileTab(tab)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm min-h-[44px] transition-all capitalize ${
                  mobileTab === tab
                    ? "bg-orange-500 text-black"
                    : "bg-[#1a1a2e] text-gray-400 border border-[#0f3460]"
                }`}>
                {tab === "search" ? "🔍 Search" : `📋 Details${agentData ? ` · ${agentData.invite_code}` : ""}`}
              </button>
            ))}
          </div>

          {mobileTab === "search" ? <SearchPanel /> : (
            <div className="bg-[#0a0a0b]">
              {agentData ? <AgentDetails /> : (
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-8 text-center text-gray-500 text-sm">
                  Search an agent first to see details here
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DESKTOP layout ────────────────────────────────────────── */}
        <div className="hidden md:block">
          {/* Search Panel - Side Aligned */}
          <div className="mb-6">
            <SearchPanel />
          </div>

          {/* Details Panel - Side Aligned */}
          {agentData ? (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] shadow-2xl p-6">
              <AgentDetails />
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] shadow-2xl p-12 text-center">
              <p className="text-gray-500 text-lg">Enter an agent UID or phone to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Salary Modal */}
      {showSalaryModal && (
        <Modal title="Give Salary to Agent" onClose={() => { setShowSalaryModal(false); setSalaryAmount(""); }}>
          <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)}
            placeholder="Amount in Rs"
            className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-3 rounded-lg focus:border-blue-500 focus:outline-none mb-4" />
          <div className="flex gap-3">
            <button onClick={() => { setShowSalaryModal(false); setSalaryAmount(""); }}
              className="flex-1 py-3 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] min-h-[44px]">Cancel</button>
            <button onClick={handleGiveSalary} disabled={!salaryAmount}
              className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50 min-h-[44px]">Transfer</button>
          </div>
        </Modal>
      )}

      {/* Advance Modal */}
      {showAdvanceModal && (
        <Modal title="Release Advance to Agent" onClose={() => { setShowAdvanceModal(false); setAdvanceAmount(""); }}>
          <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
            placeholder="Advance amount in Rs"
            className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-3 rounded-lg focus:border-green-500 focus:outline-none mb-4" />
          <div className="flex gap-3">
            <button onClick={() => { setShowAdvanceModal(false); setAdvanceAmount(""); }}
              className="flex-1 py-3 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] min-h-[44px]">Cancel</button>
            <button onClick={handleGiveAdvance} disabled={!advanceAmount}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg font-bold disabled:opacity-50 min-h-[44px]">Release</button>
          </div>
        </Modal>
      )}

      {/* Fraud Analysis Modal */}
      {showFraudModal && fraudResult && (
        <Modal title="🛡️ Agent Fraud Network Analysis" onClose={() => { setShowFraudModal(false); setFraudResult(null); }}>
          <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto">
            {/* Original Fraud Analysis Results */}
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs font-bold mb-1">Total Multi-Account Network Base</p>
                <p className="text-white font-black text-xl">{fraudResult.total_network_accounts ?? "—"}</p>
                <p className="text-gray-400 text-xs">Identical registration IP clusters</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <p className="text-emerald-400 text-xs font-bold mb-1">Verified Unique Genuine Profiles</p>
                <p className="text-white font-black text-xl">{fraudResult.unique_genuine_profiles ?? "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-400 text-xs font-bold mb-1">Today's Deposits</p>
                  <p className="text-white font-bold">Rs {(fraudResult.today_deposits ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-400 text-xs font-bold mb-1">Today's Withdrawals</p>
                  <p className="text-white font-bold">Rs {(fraudResult.today_withdrawals ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-400 text-xs font-bold mb-1">Lifetime Deposits</p>
                  <p className="text-white font-bold">Rs {(fraudResult.lifetime_deposits ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                  <p className="text-pink-400 text-xs font-bold mb-1">Lifetime Withdrawals</p>
                  <p className="text-white font-bold">Rs {(fraudResult.lifetime_withdrawals ?? 0).toLocaleString()}</p>
                </div>
              </div>
              {fraudResult.flagged_accounts && fraudResult.flagged_accounts.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-bold mb-2">Flagged Accounts</p>
                  {fraudResult.flagged_accounts.map((acc: any, idx: number) => (
                    <div key={idx} className="text-xs text-gray-300 mb-1">
                      • {acc.phone || acc.invite_code} — {acc.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-UID Scanner */}
            <div className="border-t border-[#0f3460] pt-4">
              <h4 className="text-white font-bold text-base mb-3">🔍 Multi-UID Scanner</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs font-bold mb-2 block">
                    Paste Agent UIDs to Scan (one per line)
                  </label>
                  <textarea
                    value={scanUIDs}
                    onChange={e => setScanUIDs(e.target.value)}
                    placeholder="Enter UIDs, one per line...&#10;123456&#10;789012&#10;345678"
                    className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-3 rounded-lg focus:border-orange-500 focus:outline-none text-sm min-h-[120px] resize-y"
                  />
                </div>
                <button
                  onClick={handleMultiUIDScan}
                  disabled={scanLoading || !scanUIDs.trim()}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg disabled:opacity-50 min-h-[44px]">
                  {scanLoading ? "🔍 Scanning..." : "Start Scan"}
                </button>

                {/* Scan Results */}
                {scanResults.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-gray-400 text-xs font-bold">Scan Results ({scanResults.length})</p>
                    {scanResults.map((result, idx) => (
                      <div key={idx} className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg p-3 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-orange-500 font-bold font-mono">UID: {result.uid}</span>
                          {result.error && <span className="text-red-400">{result.error}</span>}
                        </div>
                        {!result.error && (
                          <>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <p className="text-gray-500 text-[10px]">Parent UID</p>
                                <p className="text-white font-mono">{result.parent_uid}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px]">Total Deposit</p>
                                <p className="text-green-400 font-bold">Rs {result.total_deposit.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px]">Total Withdrawal</p>
                                <p className="text-red-400 font-bold">Rs {result.total_withdrawal.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px]">Phone</p>
                                <p className="text-gray-300">{result.phone}</p>
                              </div>
                            </div>
                            <div className="mb-2">
                              <p className="text-gray-500 text-[10px]">Invite URL</p>
                              <p className="text-blue-400 break-all">{result.invite_url}</p>
                            </div>
                            {result.duplicate_ips.length > 0 && (
                              <div>
                                <p className="text-red-400 text-[10px] font-bold mb-1">⚠️ Duplicate IPs ({result.duplicate_ips.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {result.duplicate_ips.map((ip: string, i: number) => (
                                    <span key={i} className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[10px]">
                                      {ip}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}