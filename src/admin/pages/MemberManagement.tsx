import React, { useState } from "react";
import { Search, TrendingUp, TrendingDown, Lock, ExternalLink } from "lucide-react";

interface Member {
  uid: string;
  phone: string;
  email: string;
  username: string;
  joined: string;
  deposits: number;
  withdrawals: number;
  balance: number;
  winLoss: number;
  lastActive: string;
  ipAddresses: string[];
  deviceIds: string[];
  status: "active" | "suspended" | "banned";
}

const MOCK_MEMBERS: Member[] = [
  {
    uid: "UID#100234",
    phone: "03001234567",
    email: "user1@email.com",
    username: "Player_Alpha",
    joined: "2026-05-15",
    deposits: 125000,
    withdrawals: 89000,
    balance: 36000,
    winLoss: 15000,
    lastActive: "2026-06-29 14:30",
    ipAddresses: ["192.168.1.1", "192.168.1.5"],
    deviceIds: ["DEV#ABC123", "DEV#XYZ789"],
    status: "active",
  },
  {
    uid: "UID#100235",
    phone: "03009876543",
    email: "user2@email.com",
    username: "Player_Beta",
    joined: "2026-04-10",
    deposits: 250000,
    withdrawals: 180000,
    balance: 70000,
    winLoss: -45000,
    lastActive: "2026-06-28 22:15",
    ipAddresses: ["192.168.2.10"],
    deviceIds: ["DEV#DEF456"],
    status: "active",
  },
  {
    uid: "UID#100236",
    phone: "03105555555",
    email: "user3@email.com",
    username: "Player_Gamma",
    joined: "2026-03-22",
    deposits: 500000,
    withdrawals: 520000,
    balance: 15000,
    winLoss: -35000,
    lastActive: "2026-06-25 10:45",
    ipAddresses: ["192.168.3.20", "192.168.3.21", "192.168.3.22"],
    deviceIds: ["DEV#GHI789", "DEV#JKL012"],
    status: "suspended",
  },
];

export function MemberManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"uid" | "phone" | "email">("uid");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");

  const filteredMembers = MOCK_MEMBERS.filter((member) => {
    if (!searchQuery) return true;
    if (searchType === "uid") return member.uid.toLowerCase().includes(searchQuery.toLowerCase());
    if (searchType === "phone") return member.phone.includes(searchQuery);
    if (searchType === "email") return member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Member Management</h1>
          <p className="text-gray-400">Search, manage, and monitor user accounts</p>
        </div>

        {/* Search Section */}
        <div className="mb-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <h3 className="text-white font-bold mb-4">Advanced Search</h3>
          <div className="flex gap-4">
            {/* Search Type Selector */}
            <div className="flex gap-2">
              {["uid", "phone", "email"].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSearchType(type as "uid" | "phone" | "email");
                    setSearchQuery("");
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    searchType === type
                      ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white"
                      : "bg-[#0f3460] text-gray-400 hover:text-white"
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search by ${searchType}...`}
                className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] focus:ring-2 focus:ring-[#e94560]/20 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Members List */}
          <div className="col-span-2">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
              <div className="p-6 border-b border-[#0f3460]">
                <h3 className="text-white font-bold">
                  Members Found: <span className="text-[#e94560]">{filteredMembers.length}</span>
                </h3>
              </div>
              <div className="divide-y divide-[#0f3460]">
                {filteredMembers.map((member) => (
                  <div
                    key={member.uid}
                    onClick={() => setSelectedMember(member)}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedMember?.uid === member.uid
                        ? "bg-[#0f3460] border-l-4 border-[#e94560]"
                        : "hover:bg-[#0f3460]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-bold">{member.username}</p>
                        <p className="text-gray-400 text-sm">{member.uid}</p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          member.status === "active"
                            ? "bg-[#4ade80]/20 text-[#4ade80]"
                            : "bg-[#ef4444]/20 text-[#ef4444]"
                        }`}
                      >
                        {member.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-400">
                        Phone: <span className="text-[#fbbf24]">{member.phone}</span>
                      </p>
                      <p className="text-gray-400">
                        Balance: <span className="text-[#3b82f6]">Rs {member.balance.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Member Details Panel */}
          {selectedMember && (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6 h-fit">
              <h3 className="text-white font-bold text-lg mb-6">Member Profile</h3>

              {/* Profile Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-gray-400 text-sm">Username</p>
                  <p className="text-white font-bold">{selectedMember.username}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Phone</p>
                  <p className="text-white">{selectedMember.phone}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white text-sm break-all">{selectedMember.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Member Since</p>
                  <p className="text-white">{selectedMember.joined}</p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-[#0f3460] rounded-lg p-4 mb-6">
                <h4 className="text-white font-bold mb-3 text-sm">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deposits:</span>
                    <span className="text-[#4ade80]">Rs {selectedMember.deposits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Withdrawals:</span>
                    <span className="text-[#ef4444]">Rs {selectedMember.withdrawals.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Balance:</span>
                    <span className="text-[#3b82f6] font-bold">Rs {selectedMember.balance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1a5f7a]">
                    <span className="text-gray-400">Win/Loss:</span>
                    <span className={selectedMember.winLoss >= 0 ? "text-[#4ade80]" : "text-[#ef4444]"}>
                      Rs {selectedMember.winLoss.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Info */}
              <div className="bg-[#0f3460] rounded-lg p-4 mb-6">
                <h4 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Security
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1">IP Addresses ({selectedMember.ipAddresses.length})</p>
                    <p className="text-gray-300 font-mono bg-[#1a1a2e] px-2 py-1 rounded">
                      {selectedMember.ipAddresses.join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Device IDs ({selectedMember.deviceIds.length})</p>
                    <p className="text-gray-300 font-mono bg-[#1a1a2e] px-2 py-1 rounded">
                      {selectedMember.deviceIds.join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowAdjustmentModal(true)}
                  className="w-full py-2 px-4 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium text-sm"
                >
                  Adjust Balance
                </button>
                <button className="w-full py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium text-sm">
                  View Full Profile
                </button>
                <button className="w-full py-2 px-4 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 hover:bg-[#ef4444]/30 transition-all font-medium text-sm">
                  Suspend Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Adjustment Modal */}
        {showAdjustmentModal && selectedMember && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-[#0f3460] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
              <h3 className="text-white font-bold text-lg mb-4">Adjust Balance</h3>
              <p className="text-gray-400 text-sm mb-4">
                Current Balance: <span className="text-[#3b82f6] font-bold">Rs {selectedMember.balance.toLocaleString()}</span>
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  {["add", "deduct"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setAdjustmentType(type as "add" | "deduct")}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                        adjustmentType === type
                          ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white"
                          : "bg-[#0f3460] text-gray-400"
                      }`}
                    >
                      {type === "add" ? "Add" : "Deduct"}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="Amount in Rs"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentAmount("");
                  }}
                  className="flex-1 py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all"
                >
                  Cancel
                </button>
                <button className="flex-1 py-2 px-4 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-white rounded-lg hover:shadow-lg transition-all font-medium">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
