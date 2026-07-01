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
  total_bets: number;
  created_at: string;
  direct_members: number;
  team_members: number;
  yesterday_commission: number;
  status: "active" | "suspended";
}

interface Agent {
  uid: string;
  phone: string;
  username: string;
  promotedDate: string;
  realMembers: number;
  fakeMembers: number;
  totalReferrals: number;
  totalCommission: number;
  withdrawalsPending: number;
  status: "active" | "suspended";
}

const MOCK_AGENTS: Agent[] = [
  {
    uid: "UID#10001",
    phone: "03001111111",
    username: "Agent_Alpha",
    promotedDate: "2026-05-01",
    realMembers: 45,
    fakeMembers: 120,
    totalReferrals: 165,
    totalCommission: 245000,
    withdrawalsPending: 2,
    status: "active",
  },
  {
    uid: "UID#10002",
    phone: "03002222222",
    username: "Agent_Beta",
    promotedDate: "2026-04-15",
    realMembers: 78,
    fakeMembers: 250,
    totalReferrals: 328,
    totalCommission: 520000,
    withdrawalsPending: 1,
    status: "active",
  },
];

const MOCK_MEMBERS_TO_PROMOTE = [
  { uid: "UID#50001", phone: "03003333333", username: "Player_Top1", referrals: 50, commission: 75000 },
  { uid: "UID#50002", phone: "03004444444", username: "Player_Top2", referrals: 38, commission: 57000 },
  { uid: "UID#50003", phone: "03005555555", username: "Player_Top3", referrals: 25, commission: 37500 },
];

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

  // Fetch agent data from Supabase
  const handleFetchAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAgentData(null);
    setLoading(true);

    try {
      // Query Supabase for user by phone or invite_code
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .or(`phone.eq.${agentUID},invite_code.eq.${agentUID}`)
        .single();

      if (fetchError || !data) {
        setError('Agent not found in system');
        setLoading(false);
        return;
      }

      // Count direct members (people who used this agent's invite_code)
      const { data: directMembers, error: directError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', data.id);

      // Count team members (members of direct members)
      const { data: teamMembers, error: teamError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .neq('referred_by', null)
        .not('id', 'eq', data.id);

      const agentInfo: AgentData = {
        id: data.id,
        phone: data.phone_number || '',
        main_balance: data.main_balance || 0,
        game_balance: data.game_balance || 0,
        vip_level: data.vip_level || 0,
        invite_code: data.invite_code || '',
        total_bets: data.total_bets || 0,
        created_at: data.created_at || '',
        direct_members: directMembers?.length || 0,
        team_members: teamMembers?.length || 0,
        yesterday_commission: 0, // This would come from transactions table
        status: 'active'
      };

      setAgentData(agentInfo);
    } catch (err) {
      setError('Failed to fetch agent data');
    } finally {
      setLoading(false);
    }
  };

  const copyUID = () => {
    if (agentData?.invite_code) {
      navigator.clipboard.writeText(agentData.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
                <label className="text-gray-400 text-sm block mb-2">Agent UID or Phone</label>
                <input
                  type="text"
                  value={agentUID}
                  onChange={(e) => setAgentUID(e.target.value)}
                  placeholder="e.g., UID#10001 or 03001111111"
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
          </div>

          {/* Agent Details Panel */}
          {agentData ? (
            <div className="col-span-3 space-y-6">
              {/* Agent Info Card */}
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] grid grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Phone</p>
                  <p className="text-white font-bold text-lg">{agentData.phone}</p>
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
                <p className="text-gray-400 text-sm mb-3">Agent Invitation Code</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={agentData.invite_code}
                    readOnly
                    className="flex-1 bg-[#0f3460] border border-[#1a5f7a] text-white px-4 py-2 rounded-lg"
                  />
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
