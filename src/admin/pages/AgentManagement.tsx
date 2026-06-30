import React, { useState } from "react";
import { UserPlus, Target, CheckCircle } from "lucide-react";

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
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedForPromotion, setSelectedForPromotion] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Agent Management</h1>
          <p className="text-gray-400">Manage agents, track referrals, and approve withdrawals</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Agents List */}
          <div className="col-span-2 space-y-6">
            {/* Promote User Card */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg">Promote User to Agent</h3>
              </div>
              <button
                onClick={() => setShowPromoteModal(true)}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
              >
                Select Member to Promote
              </button>
            </div>

            {/* Agents Table */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
              <div className="p-6 border-b border-[#0f3460]">
                <h3 className="text-white font-bold text-lg">Active Agents ({MOCK_AGENTS.length})</h3>
              </div>
              <div className="divide-y divide-[#0f3460]">
                {MOCK_AGENTS.map((agent) => (
                  <div
                    key={agent.uid}
                    onClick={() => setSelectedAgent(agent)}
                    className={`p-6 cursor-pointer transition-all ${
                      selectedAgent?.uid === agent.uid
                        ? "bg-[#0f3460] border-l-4 border-[#e94560]"
                        : "hover:bg-[#0f3460]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-white font-bold text-lg">{agent.username}</p>
                        <p className="text-gray-400 text-sm">{agent.uid} • {agent.phone}</p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          agent.status === "active"
                            ? "bg-[#4ade80]/20 text-[#4ade80]"
                            : "bg-[#ef4444]/20 text-[#ef4444]"
                        }`}
                      >
                        {agent.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-[#0f3460] rounded p-3">
                        <p className="text-gray-400 text-xs">Real Members</p>
                        <p className="text-white font-bold">{agent.realMembers}</p>
                      </div>
                      <div className="bg-[#0f3460] rounded p-3">
                        <p className="text-gray-400 text-xs">Fake Members</p>
                        <p className="text-white font-bold">{agent.fakeMembers}</p>
                      </div>
                      <div className="bg-[#0f3460] rounded p-3">
                        <p className="text-gray-400 text-xs">Total Referrals</p>
                        <p className="text-white font-bold">{agent.totalReferrals}</p>
                      </div>
                      <div className="bg-[#0f3460] rounded p-3">
                        <p className="text-gray-400 text-xs">Commission</p>
                        <p className="text-[#fbbf24] font-bold">Rs {agent.totalCommission.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Details Panel */}
          {selectedAgent && (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6 h-fit">
              <h3 className="text-white font-bold text-lg mb-6">Agent Details</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-gray-400 text-sm">Username</p>
                  <p className="text-white font-bold">{selectedAgent.username}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Phone</p>
                  <p className="text-white">{selectedAgent.phone}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Promoted On</p>
                  <p className="text-white">{selectedAgent.promotedDate}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-[#0f3460] rounded-lg p-4 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Real Members:</span>
                  <span className="text-white font-bold">{selectedAgent.realMembers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fake Members:</span>
                  <span className="text-white font-bold">{selectedAgent.fakeMembers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Referrals:</span>
                  <span className="text-white font-bold">{selectedAgent.totalReferrals}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#1a5f7a]">
                  <span className="text-gray-400">Total Commission:</span>
                  <span className="text-[#fbbf24] font-bold">Rs {selectedAgent.totalCommission.toLocaleString()}</span>
                </div>
              </div>

              {/* Pending Withdrawals */}
              {selectedAgent.withdrawalsPending > 0 && (
                <div className="bg-[#fbbf24]/20 border border-[#fbbf24]/50 rounded-lg p-4 mb-6">
                  <p className="text-[#fbbf24] font-bold mb-2">Pending Withdrawals: {selectedAgent.withdrawalsPending}</p>
                  <button className="w-full py-2 text-sm bg-[#fbbf24]/30 text-[#fbbf24] rounded hover:bg-[#fbbf24]/40 transition-all font-medium">
                    Review Pending
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button className="w-full py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium text-sm">
                  View Referrals
                </button>
                <button className="w-full py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium text-sm">
                  View Commission History
                </button>
                <button className="w-full py-2 px-4 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 hover:bg-[#ef4444]/30 transition-all font-medium text-sm">
                  Suspend Agent
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Promote Modal */}
        {showPromoteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] max-w-2xl w-full mx-4">
              <h3 className="text-white font-bold text-lg mb-6">Select Member to Promote</h3>

              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {MOCK_MEMBERS_TO_PROMOTE.map((member) => (
                  <div
                    key={member.uid}
                    onClick={() => setSelectedForPromotion(member.uid)}
                    className={`p-4 rounded-lg cursor-pointer transition-all border ${
                      selectedForPromotion === member.uid
                        ? "bg-[#e94560]/20 border-[#e94560]"
                        : "bg-[#0f3460] border-[#1a5f7a] hover:border-[#e94560]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold">{member.username}</p>
                        <p className="text-gray-400 text-sm">{member.uid} • {member.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{member.referrals} referrals</p>
                        <p className="text-[#fbbf24] text-sm">Rs {member.commission.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPromoteModal(false);
                    setSelectedForPromotion(null);
                  }}
                  className="flex-1 py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedForPromotion}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-white rounded-lg hover:shadow-lg disabled:opacity-50 transition-all font-medium"
                >
                  Promote to Agent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
