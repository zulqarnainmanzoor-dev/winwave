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
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-[#0f3460] rounded-t-2xl sm:rounded-2xl p-6">
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
          .select("id, phone_number, invite_code, main_balance, game_balance, created_at, is_agent")
          .eq("is_agent", true)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        setAgents((data || []).map((row: any) => ({
          id:           row.id,
          phone:        row.phone_number || "",
          username:     `AGENT_${(row.invite_code || row.id.replace(/-/g, "").slice(0, 6)).toUpperCase()}`,
          uid:          row.invite_code || row.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
          main_balance: Number(row.main_balance ?? 0),
          game_balance: Number(row.game_balance ?? 0),
        })));
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
      const isUUID       = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      const isPhone      = /^\d{10,11}$/.test(trimmed);
      const isInviteCode = /^\d{6}$/.test(trimmed);

      let q = (adminSupabase as any)
        .from("users")
        .select("id, phone_number, invite_code, main_balance, game_balance, vip_level, created_at, is_agent");

      if (isUUID)            q = q.eq("id", trimmed);
      else if (isInviteCode) q = q.eq("invite_code", trimmed);
      else if (isPhone)      q = q.eq("phone_number", trimmed);
      else                   q = q.or(`invite_code.eq.${trimmed},phone_number.eq.${trimmed}`);

      const { data, error: fetchErr } = await q.maybeSingle();
      if (fetchErr || !data) { setError("User not found. Try phone, 6-digit invite code, or UUID."); return; }
      const user = data as any;

      // Count direct members via referred_by
      const { count: directCount } = await (adminSupabase as any)
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user.id);

      setAgentData({
        id:                   user.id,
        phone:                user.phone_number || "",
        main_balance:         Number(user.main_balance ?? 0),
        game_balance:         Number(user.game_balance ?? 0),
        vip_level:            user.vip_level || 0,
        invite_code:          user.invite_code || "",
        total_bets:           0,
        created_at:           user.created_at || "",
        direct_members:       Number(directCount ?? 0),
        team_members:         0,
        yesterday_commission: 0,
        status:               "active",
        is_agent:             Boolean(user.is_agent),
      });
      setMobileTab("details");
    } catch {
      setError("Failed to fetch user data.");
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
        return [{ id: agentData.id, phone: agentData.phone, username: `AGENT_${agentData.invite_code.toUpperCase()}`, uid: agentData.invite_code, main_balance: agentData.main_balance, game_balance: agentData.game_balance }, ...prev];
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
    const newBal = agentData.game_balance + parseFloat(advanceAmount);
    const { error } = await (adminSupabase as any).from("users").update({ game_balance: newBal }).eq("id", agentData.id);
    if (!error) { setAgentData({ ...agentData, game_balance: newBal }); setAdvanceAmount(""); setShowAdvanceModal(false); }
  };

  // ── Agent Fraud Network Analysis ─────────────────────────────────
  const handleAnalyzeFraud = async () => {
    if (!agentData) return;
    setFraudLoading(true); setFraudResult(null);
    try {
      const { data, error } = await (adminSupabase as any).rpc("analyze_agent_network_fraud", {
        p_agent_id: agentData.id,
      });
      if (error) throw error;
      setFraudResult(data);
      setShowFraudModal(true);
    } catch (err: any) {
      alert("Fraud analysis failed: " + (err?.message || "Unknown error"));
    } finally {
      setFraudLoading(false);
    }
  };

  // ── Shared: Agent Details content ────────────────────────────────
  const AgentDetails = () => agentData ? (
    <div className="space-y-4">
      {/* Info strip */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><p className="text-gray-400 text-xs mb-1">UID</p><p className="text-amber-400 font-black text-xl font-mono">{agentData.invite_code || "------"}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">VIP</p><p className="text-amber-500 font-bold text-lg">{agentData.vip_level}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">Since</p><p className="text-white font-bold text-sm">{new Date(agentData.created_at).toLocaleDateString()}</p></div>
        <div><p className="text-gray-400 text-xs mb-1">Status</p><p className="text-green-400 font-bold">Active</p></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Direct Members", value: agentData.direct_members, color: "text-white" },
          { label: "Team Members",   value: agentData.team_members,   color: "text-white" },
          { label: "Commission",     value: `Rs ${agentData.yesterday_commission.toLocaleString()}`, color: "text-amber-500" },
        ].map(s => (
          <div key={s.label} className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460]">
            <p className="text-gray-400 text-xs mb-1">{s.label}</p>
            <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460]">
          <p className="text-gray-400 text-xs mb-1">Main Balance</p>
          <p className="text-white font-bold text-xl mb-3">Rs {agentData.main_balance.toLocaleString()}</p>
          <button onClick={() => setShowSalaryModal(true)}
            className="w-full py-2.5 bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg text-sm font-bold min-h-[44px]">
            Give Salary
          </button>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460]">
          <p className="text-gray-400 text-xs mb-1">Game Balance</p>
          <p className="text-white font-bold text-xl mb-3">Rs {agentData.game_balance.toLocaleString()}</p>
          <button onClick={() => setShowAdvanceModal(true)}
            className="w-full py-2.5 bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg text-sm font-bold min-h-[44px]">
            Release Advance
          </button>
        </div>
      </div>

      {/* Invite code + convert */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460]">
        <p className="text-gray-400 text-xs mb-2">Invite Code (UID)</p>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-[#0f3460] border border-[#1a5f7a] px-4 py-2.5 rounded-lg flex items-center gap-2">
            <span className="text-gray-400 text-sm">UID |</span>
            <span className="text-amber-400 font-black text-lg tracking-widest font-mono">{agentData.invite_code || "------"}</span>
          </div>
          <button onClick={copyUID}
            className={`px-4 rounded-lg font-bold transition-all min-h-[44px] min-w-[44px] ${copied ? "bg-green-500 text-white" : "bg-amber-500/30 text-amber-400 border border-amber-500/50"}`}>
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
    </div>
  ) : (
    <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
      Search an agent to view details
    </div>
  );

  // ── Search panel content ──────────────────────────────────────────
  const SearchPanel = () => (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-5 border border-[#0f3460]">
      <h3 className="text-white font-bold text-base mb-4">Find Agent</h3>
      <form onSubmit={handleFetchAgent} className="space-y-3">
        <input type="text" value={agentUID} onChange={e => setAgentUID(e.target.value)}
          placeholder="Phone, 6-digit code, or UUID"
          className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2.5 rounded-lg focus:border-amber-500 focus:outline-none text-sm" />
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-lg disabled:opacity-50 min-h-[44px]">
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
                className="w-full rounded-lg border border-[#1a5f7a] bg-[#0f3460]/70 p-3 text-left hover:border-amber-500/50 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{agent.username}</p>
                    <p className="text-gray-400 text-xs">{agent.phone}</p>
                  </div>
                  <span className="text-xs text-amber-400 font-mono">{agent.uid}</span>
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
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-1">Agent Management</h1>
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
                    ? "bg-amber-500 text-black"
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
        <div className="hidden md:grid grid-cols-4 gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>
          {/* Left panel */}
          <div className="col-span-1 overflow-y-auto">
            <SearchPanel />
          </div>

          {/* Right panel */}
          <div className="col-span-3 overflow-y-auto">
            {agentData ? <AgentDetails /> : (
              <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460]">
                <p className="text-gray-500 text-lg">Enter an agent UID or phone to view details</p>
              </div>
            )}
          </div>
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
          <div className="space-y-3 text-sm">
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
        </Modal>
      )}
    </div>
  );
}
