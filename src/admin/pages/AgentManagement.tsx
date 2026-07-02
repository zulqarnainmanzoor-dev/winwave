import React, { useState, useEffect } from "react";
import { UserPlus, Target, CheckCircle, Copy, Check } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface AgentData {
  id: string;
  phone: string;
  main_balance: number;
  game_balance: number;
  vip_level: number;
  invite_code: string;
  referral_code: string;
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
  promotedDate: string;
  realMembers: number;
  totalReferrals: number;
  totalCommission: number;
  status: "active" | "suspended";
  main_balance: number;
  game_balance: number;
}

export function AgentManagement() {
  const [agentUID, setAgentUID] = useState('');
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      setAgentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, phone_number, invite_code, main_balance, game_balance, created_at, vip_level, is_agent')
          .eq('is_agent', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const normalized = (data || []).map((row: any) => ({
          id: row.id,
          phone: row.phone_number || '',
          username: `AGENT_${(row.invite_code || row.id.replace(/-/g,'').slice(0,6)).toUpperCase()}`,
          uid: row.invite_code || row.id.replace(/-/g,'').slice(0,6).toUpperCase(),
          promotedDate: row.created_at || '',
          realMembers: 0,
          totalReferrals: 0,
          totalCommission: 0,
          status: 'active' as const,
          main_balance: Number(row.main_balance ?? 0),
          game_balance: Number(row.game_balance ?? 0),
        }));
        setAgents(normalized);
      } catch (err) {
        console.warn('Failed to load live agents', err);
      } finally {
        setAgentsLoading(false);
      }
    };
    void fetchAgents();
  }, []);

  const handleFetchAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAgentData(null);
    setLoading(true);

    try {
      const trimmed = agentUID.trim();

      // Search by: full UUID, invite_code (6-digit), or phone_number
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
      const isPhone = /^\d{10,11}$/.test(trimmed);
      const isInviteCode = /^\d{6}$/.test(trimmed);

      let query = supabase
        .from('users')
        .select('id, phone_number, invite_code, inviter_code, main_balance, game_balance, vip_level, created_at, is_agent');

      if (isUUID) {
        query = query.eq('id', trimmed);
      } else if (isInviteCode) {
        query = query.eq('invite_code', trimmed);
      } else if (isPhone) {
        query = query.eq('phone_number', trimmed);
      } else {
        // fallback: try invite_code or phone
        query = query.or(`invite_code.eq.${trimmed},phone_number.eq.${trimmed}`);
      }

      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError || !data) {
        setError('User not found. Try their phone number, 6-digit invite code, or full UUID.');
        setLoading(false);
        return;
      }

      const { count: directMembersCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', data.id);

      const agentInfo: AgentData = {
        id: data.id,
        phone: data.phone_number || '',
        main_balance: Number(data.main_balance ?? 0),
        game_balance: Number(data.game_balance ?? 0),
        vip_level: data.vip_level || 0,
        invite_code: data.invite_code || '',
        referral_code: data.invite_code || '',
        total_bets: 0,
        created_at: data.created_at || '',
        direct_members: Number(directMembersCount ?? 0),
        team_members: 0,
        yesterday_commission: 0,
        status: 'active',
        is_agent: Boolean(data.is_agent),
      };

      setAgentData(agentInfo);
    } catch (err) {
      setError('Failed to fetch user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyUID = () => {
    // Copy the 6-digit invite_code (digits only, no UUID)
    const code = agentData?.invite_code || '';
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConvertToAgent = async () => {
    if (!agentData) return;
    setConverting(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_agent: true })
        .eq('id', agentData.id);

      if (error) throw error;

      setAgentData({ ...agentData, is_agent: true });
      // Refresh agent list
      setAgents(prev => {
        const exists = prev.find(a => a.id === agentData.id);
        if (exists) return prev;
        return [{
          id: agentData.id,
          phone: agentData.phone,
          username: `AGENT_${agentData.invite_code.toUpperCase()}`,
          uid: agentData.invite_code,
          promotedDate: agentData.created_at,
          realMembers: agentData.direct_members,
          totalReferrals: 0,
          totalCommission: 0,
          status: 'active' as const,
          main_balance: agentData.main_balance,
          game_balance: agentData.game_balance,
        }, ...prev];
      });
      alert(`✅ Account converted to agent! Invite code: ${agentData.invite_code}`);
    } catch (err: any) {
      alert('Failed to convert: ' + (err?.message || 'Unknown error'));
    } finally {
      setConverting(false);
    }
  };

  const handleGiveSalary = async () => {
    if (!agentData || !salaryAmount) return;

    try {
      // Add salary to agent's main balance
      const newBalance = agentData.main_balance + parseFloat(salaryAmount);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ main_balance: newBalance })
        .eq('id', agentData.id);

      if (!updateError) {
        setAgentData({ ...agentData, main_balance: newBalance });
        setSalaryAmount('');
        setShowSalaryModal(false);
        alert('Salary transferred successfully!');
      }
    } catch (err) {
      alert('Failed to transfer salary');
    }
  };

  const handleGiveAdvance = async () => {
    if (!agentData || !advanceAmount) return;

    try {
      // Add advance to agent's game balance
      const newBalance = agentData.game_balance + parseFloat(advanceAmount);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ game_balance: newBalance })
        .eq('id', agentData.id);

      if (!updateError) {
        setAgentData({ ...agentData, game_balance: newBalance });
        setAdvanceAmount('');
        setShowAdvanceModal(false);
        alert('Advance released successfully!');
      }
    } catch (err) {
      alert('Failed to release advance');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b] min-h-screen">
      <div className="w-full p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Agent Management</h1>
          <p className="text-gray-400">Search, manage agents, and handle commissions</p>
        </div>

        <div className="grid grid-cols-4 gap-8 h-[calc(100vh-180px)]">
          {/* Search & Input Panel */}
          <div className="col-span-1 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-4">Find Agent</h3>
            
            <form onSubmit={handleFetchAgent} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-2">Phone / Invite Code / UUID</label>
                <input
                  type="text"
                  value={agentUID}
                  onChange={(e) => setAgentUID(e.target.value)}
                  placeholder="Phone, 6-digit code, or full UUID"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2 rounded-lg focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-50 transition-all"
              >
                {loading ? 'Searching...' : 'Search Agent'}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Live Agent Accounts</h4>
              <div className="space-y-2">
                {agentsLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : agents.length === 0 ? (
                  <p className="text-sm text-gray-500">No agent rows yet.</p>
                ) : (
                  agents.map((agent) => (
                    <div key={agent.id} className="rounded-lg border border-[#1a5f7a] bg-[#0f3460]/70 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">{agent.username}</p>
                          <p className="text-gray-400 text-xs">{agent.phone}</p>
                        </div>
                        <span className="text-xs text-amber-400">{agent.uid}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Agent Details Panel */}
          {agentData ? (
            <div className="col-span-3 space-y-6">
              {/* Agent Info Card */}
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] grid grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">UID (Invite Code)</p>
                  <p className="text-amber-400 font-black text-2xl tracking-widest font-mono">{agentData.invite_code || '------'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">VIP Level</p>
                  <p className="text-amber-500 font-bold text-lg">{agentData.vip_level}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Member Since</p>
                  <p className="text-white font-bold text-lg">{new Date(agentData.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Status</p>
                  <p className="text-green-400 font-bold text-lg">Active</p>
                </div>
              </div>

              {/* Referral & Commission Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-2">Direct Members</p>
                  <p className="text-white font-bold text-3xl">{agentData.direct_members}</p>
                  <p className="text-gray-500 text-xs mt-2">People who joined via this agent's link</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-2">Team Members</p>
                  <p className="text-white font-bold text-3xl">{agentData.team_members}</p>
                  <p className="text-gray-500 text-xs mt-2">Indirect referrals (team's referrals)</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-2">Yesterday Commission</p>
                  <p className="text-amber-500 font-bold text-3xl">Rs {agentData.yesterday_commission.toLocaleString()}</p>
                  <button
                    className="w-full mt-3 py-2 bg-amber-500/30 text-amber-400 border border-amber-500/50 rounded-lg hover:bg-amber-500/40 transition-all text-sm font-bold"
                  >
                    Claim
                  </button>
                </div>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-2">Main Balance</p>
                  <p className="text-white font-bold text-2xl">Rs {agentData.main_balance.toLocaleString()}</p>
                  <button
                    onClick={() => setShowSalaryModal(true)}
                    className="w-full mt-3 py-2 bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/40 transition-all text-sm font-bold"
                  >
                    Give Salary
                  </button>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                  <p className="text-gray-400 text-sm mb-2">Game Balance</p>
                  <p className="text-white font-bold text-2xl">Rs {agentData.game_balance.toLocaleString()}</p>
                  <button
                    onClick={() => setShowAdvanceModal(true)}
                    className="w-full mt-3 py-2 bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/40 transition-all text-sm font-bold"
                  >
                    Release Advance
                  </button>
                </div>
              </div>

              {/* Invitation Link */}
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                <p className="text-gray-400 text-sm mb-3">Invite Code (UID)</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2 rounded-lg flex items-center gap-3">
                    <span className="text-gray-400 text-sm">UID |</span>
                    <span className="text-amber-400 font-black text-xl tracking-widest font-mono">
                      {agentData.invite_code || '------'}
                    </span>
                  </div>
                  <button
                    onClick={copyUID}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-amber-500/30 text-amber-400 border border-amber-500/50 hover:bg-amber-500/40'
                    }`}
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
                <button
                  onClick={handleConvertToAgent}
                  disabled={converting}
                  className="mt-4 w-full py-2.5 rounded-lg font-bold text-sm transition-all border"
                  style={agentData.is_agent
                    ? { background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', borderColor: 'rgba(16,185,129,0.4)', cursor: 'default' }
                    : { background: 'rgba(16,185,129,0.15)', color: '#34d399', borderColor: 'rgba(16,185,129,0.5)', cursor: 'pointer' }
                  }
                >
                  {converting ? 'Converting...' : agentData.is_agent ? '✓ Already an Agent' : '⚡ Convert to Agent'}
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-3 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460]">
              <p className="text-gray-500 text-lg">Enter an agent UID or phone to view details</p>
            </div>
          )}
        </div>

        {/* Salary Modal */}
        {showSalaryModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-[#0f3460] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
              <h3 className="text-white font-bold text-xl mb-4">Give Salary to Agent</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Amount (Rs)</label>
                  <input
                    type="number"
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSalaryModal(false);
                    setSalaryAmount('');
                  }}
                  className="flex-1 py-2 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-red-500 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGiveSalary}
                  disabled={!salaryAmount}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all font-bold"
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advance Modal */}
        {showAdvanceModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-[#0f3460] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
              <h3 className="text-white font-bold text-xl mb-4">Release Advance to Agent</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Advance Amount (Rs)</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2 rounded-lg focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAdvanceModal(false);
                    setAdvanceAmount('');
                  }}
                  className="flex-1 py-2 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-red-500 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGiveAdvance}
                  disabled={!advanceAmount}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all font-bold"
                >
                  Release
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
