import React, { useState } from "react";
import { Check, X, Clock } from "lucide-react";

interface FundsRequest {
  id: string;
  uid: string;
  userName: string;
  amount: number;
  method: string;
  account: string;
  dateRequested: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
}

interface FundsManagementProps {
  type: "withdraw" | "deposit";
}

const MOCK_WITHDRAW_REQUESTS: FundsRequest[] = [
  {
    id: "WTH#001",
    uid: "UID#12345",
    userName: "Player_Alpha",
    amount: 50000,
    method: "Jazzcash",
    account: "03001234567",
    dateRequested: "2026-06-29 10:30",
    status: "pending",
  },
  {
    id: "WTH#002",
    uid: "UID#67890",
    userName: "Player_Beta",
    amount: 75000,
    method: "Easypaisa",
    account: "3001234567",
    dateRequested: "2026-06-29 09:15",
    status: "approved",
  },
  {
    id: "WTH#003",
    uid: "UID#11111",
    userName: "Player_Gamma",
    amount: 25000,
    method: "USDT",
    account: "TRx123...789",
    dateRequested: "2026-06-29 08:45",
    status: "rejected",
    reason: "Invalid account address",
  },
];

const MOCK_DEPOSIT_REQUESTS: FundsRequest[] = [
  {
    id: "DEP#001",
    uid: "UID#22222",
    userName: "Player_Delta",
    amount: 100000,
    method: "Jazzcash",
    account: "03009876543",
    dateRequested: "2026-06-29 11:20",
    status: "pending",
  },
  {
    id: "DEP#002",
    uid: "UID#33333",
    userName: "Player_Echo",
    amount: 50000,
    method: "Easypaisa",
    account: "3009876543",
    dateRequested: "2026-06-29 10:10",
    status: "approved",
  },
];

export function FundsManagement({ type }: FundsManagementProps) {
  const requests = type === "withdraw" ? MOCK_WITHDRAW_REQUESTS : MOCK_DEPOSIT_REQUESTS;
  const [selectedRequest, setSelectedRequest] = useState<FundsRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const title = type === "withdraw" ? "Withdrawal Requests" : "Deposit Requests";
  const description =
    type === "withdraw"
      ? "Approve or reject user withdrawal requests"
      : "Manage and process deposit requests";

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-400">{description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Pending", value: pendingCount, color: "from-[#fbbf24]" },
            {
              label: "Approved",
              value: requests.filter((r) => r.status === "approved").length,
              color: "from-[#4ade80]",
            },
            {
              label: "Rejected",
              value: requests.filter((r) => r.status === "rejected").length,
              color: "from-[#ef4444]",
            },
            {
              label: "Total Amount",
              value: `Rs ${requests.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}`,
              color: "from-[#3b82f6]",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460]"
            >
              <p className="text-gray-400 text-sm mb-2">{stat.label}</p>
              <p className={`text-2xl font-bold text-white`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-8">
          {/* Requests List */}
          <div className="col-span-2">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0f3460] border-b border-[#1a5f7a]">
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">Request ID</th>
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">User</th>
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">Amount</th>
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">Method</th>
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">Date</th>
                      <th className="text-left text-gray-400 font-semibold py-4 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr
                        key={request.id}
                        onClick={() => setSelectedRequest(request)}
                        className={`border-b border-[#0f3460] cursor-pointer transition-all ${
                          selectedRequest?.id === request.id
                            ? "bg-[#0f3460] border-l-4 border-[#e94560]"
                            : "hover:bg-[#0f3460]"
                        }`}
                      >
                        <td className="text-white font-bold py-4 px-6">{request.id}</td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white font-medium">{request.userName}</p>
                            <p className="text-gray-400 text-xs">{request.uid}</p>
                          </div>
                        </td>
                        <td className="text-[#fbbf24] font-bold py-4 px-6">
                          Rs {request.amount.toLocaleString()}
                        </td>
                        <td className="text-gray-300 py-4 px-6">{request.method}</td>
                        <td className="text-gray-400 text-xs py-4 px-6">{request.dateRequested}</td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                              request.status === "pending"
                                ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                                : request.status === "approved"
                                  ? "bg-[#4ade80]/20 text-[#4ade80]"
                                  : "bg-[#ef4444]/20 text-[#ef4444]"
                            }`}
                          >
                            {request.status === "pending" && <Clock className="w-3 h-3" />}
                            {request.status === "approved" && <Check className="w-3 h-3" />}
                            {request.status === "rejected" && <X className="w-3 h-3" />}
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Details Panel */}
          {selectedRequest && (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6 h-fit">
              <h3 className="text-white font-bold text-lg mb-6">Request Details</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-gray-400 text-sm">Request ID</p>
                  <p className="text-white font-bold">{selectedRequest.id}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">User</p>
                  <p className="text-white">{selectedRequest.userName}</p>
                  <p className="text-gray-500 text-xs">{selectedRequest.uid}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Amount Requested</p>
                  <p className="text-[#fbbf24] font-bold text-lg">
                    Rs {selectedRequest.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Payment Method</p>
                  <p className="text-white">{selectedRequest.method}</p>
                </div>
                <div className="bg-[#0f3460] rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">{type === "withdraw" ? "Destination" : "Source"} Account</p>
                  <p className="text-white font-mono text-sm">{selectedRequest.account}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Requested On</p>
                  <p className="text-white">{selectedRequest.dateRequested}</p>
                </div>
              </div>

              {selectedRequest.status === "rejected" && selectedRequest.reason && (
                <div className="bg-[#ef4444]/20 border border-[#ef4444]/50 rounded-lg p-3 mb-6">
                  <p className="text-[#ef4444] text-sm font-bold mb-1">Rejection Reason</p>
                  <p className="text-gray-300 text-sm">{selectedRequest.reason}</p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <div className="space-y-3">
                  <button className="w-full py-2 px-4 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium">
                    ✓ Approve Request
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="w-full py-2 px-4 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 hover:bg-[#ef4444]/30 transition-all font-medium"
                  >
                    ✗ Reject Request
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] max-w-md w-full mx-4">
              <h3 className="text-white font-bold text-lg mb-4">Reject Request</h3>
              <p className="text-gray-400 text-sm mb-4">
                Request ID: <span className="text-white">{selectedRequest.id}</span>
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-24 bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
                  }}
                  className="flex-1 py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all"
                >
                  Cancel
                </button>
                <button className="flex-1 py-2 px-4 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-all font-medium">
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
