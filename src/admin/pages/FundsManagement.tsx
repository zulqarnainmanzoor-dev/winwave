import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "rejected" | "completed";

interface FundsRequest {
  id: string;
  userId: string;
  uid: string;
  userName: string;
  amount: number;
  method: string;
  account: string;
  dateRequested: string;
  status: RequestStatus;
  type: "withdraw" | "deposit";
  gatewayRef?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  reason?: string;
}

interface FundsManagementProps {
  type: "withdraw" | "deposit";
}

export function FundsManagement({ type }: FundsManagementProps) {
  const [requests, setRequests] = useState<FundsRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FundsRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const title = type === "withdraw" ? "Withdrawal Requests" : "Deposit Requests";
  const description =
    type === "withdraw"
      ? "Approve or reject user withdrawal requests"
      : "Review deposit activity and update transaction status";

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    setSelectedRequest(null);

    try {
      if (type === "withdraw") {
        const withdrawRequests = supabase.from("withdraw_requests") as any;
        const { data, error } = await withdrawRequests
          .select("id,user_id,amount,bank_name,account_name,account_number,status,created_at,reason")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const userIds = Array.from(new Set((data || []).map((row: any) => row?.user_id).filter(Boolean)));
        let bankData: any[] = [];

        if (userIds.length > 0) {
          const { data: banks, error: bankError } = await supabase
            .from("user_banks")
            .select("user_id,bank_name,account_name,account_number")
            .in("user_id", userIds);

          if (!bankError && banks) {
            bankData = banks;
          }
        }

        setRequests(
          (data || []).map((row: any) => {
            const bank = bankData.find((item) => item.user_id === row.user_id);
            const method = row.bank_name || bank?.bank_name || "Bank Transfer";
            const account = row.account_number || row.account_name || bank?.account_number || bank?.account_name || "-";

            return {
              id: row.id,
              userId: row.user_id,
              uid: row.user_id,
              userName: row.user_id,
              amount: Number(row.amount || 0),
              method,
              account,
              dateRequested: row.created_at || "",
              status: (row.status as RequestStatus) || "pending",
              type: "withdraw",
              bankName: row.bank_name ?? bank?.bank_name ?? null,
              accountName: row.account_name ?? bank?.account_name ?? null,
              accountNumber: row.account_number ?? bank?.account_number ?? null,
              reason: row.reason ?? null,
            } as any;
          }),
        );
      } else {
        const transactionsTable = supabase.from("transactions") as any;
        const { data, error } = await transactionsTable
          .select("id,user_id,amount,status,gateway_ref,created_at")
          .eq("type", "deposit")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        setRequests(
          (data || []).map((row) => ({
            id: row.id,
            userId: row.user_id,
            uid: row.user_id,
            userName: row.user_id,
            amount: row.amount,
            method: row.gateway_ref ? "Payment Gateway" : "Deposit",
            account: row.gateway_ref || "Manual",
            dateRequested: row.created_at,
            status: (row.status as RequestStatus) || "pending",
            type: "deposit",
            gatewayRef: row.gateway_ref,
          })),
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const updateWithdrawRequest = async (requestId: string, status: "approved" | "rejected", reason?: string) => {
    const withdrawRequests = supabase.from("withdraw_requests") as any;
    const payload: any = { status };
    if (reason) payload.reason = reason;
    const { error } = await withdrawRequests
      .update(payload)
      .eq("id", requestId);

    if (error) throw error;
  };

  const refundUserForWithdraw = async (request: FundsRequest) => {
    const usersTable = supabase.from("users") as any;
    const { data: userRow, error: userError } = await usersTable
      .select("main_balance")
      .eq("id", request.userId)
      .maybeSingle();

    if (userError) throw userError;

    const currentBalance = Number(userRow?.main_balance || 0);
    const newBalance = currentBalance + request.amount;

    const usersUpdateTable = supabase.from("users") as any;
    const { error: userUpdateError } = await usersUpdateTable
      .update({ main_balance: newBalance })
      .eq("id", request.userId);

    if (userUpdateError) throw userUpdateError;

    const walletsTable = supabase.from("wallets") as any;
    const { data: walletRow, error: walletError } = await walletsTable
      .select("main_balance")
      .eq("user_id", request.userId)
      .maybeSingle();

    if (walletError) {
      console.warn("Failed to read wallet row for refund:", walletError);
      return;
    }

    if (walletRow) {
      const walletBalance = Number(walletRow.main_balance || 0);
      const walletsTable = supabase.from("wallets") as any;
      const { error: walletUpdateError } = await walletsTable
        .update({ main_balance: walletBalance + request.amount })
        .eq("user_id", request.userId);

      if (walletUpdateError) {
        console.warn("Failed to refund wallet row:", walletUpdateError);
      }
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setLoading(true);
    setError("");

    try {
      if (selectedRequest.type === "withdraw") {
        await updateWithdrawRequest(selectedRequest.id, "approved");
      } else {
        const transactionsTable = supabase.from("transactions") as any;
        const { error } = await transactionsTable
          .update({ status: "completed" })
          .eq("id", selectedRequest.id);

        if (error) throw error;
      }

      await fetchRequests();
      setSelectedRequest((prev) => prev && { ...prev, status: selectedRequest.type === "withdraw" ? "approved" : "completed" });
    } catch (err: any) {
      setError(err?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || selectedRequest.type !== "withdraw") return;
    if (!rejectReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await refundUserForWithdraw(selectedRequest);
      await updateWithdrawRequest(selectedRequest.id, "rejected", rejectReason);

      // Insert a failed transaction record so it appears in the user's transaction history with remarks
      try {
        const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const { error: txError } = await supabase.from("transactions").insert([{ id: txId, user_id: selectedRequest.userId, type: 'withdraw', amount: selectedRequest.amount, status: 'failed', gateway_ref: rejectReason }]);
        if (txError) console.warn('Failed to insert transaction record for rejection', txError);
      } catch (e) {
        console.warn(e);
      }
      setShowRejectModal(false);
      setRejectReason("");
      await fetchRequests();
      setSelectedRequest((prev) => prev && { ...prev, status: "rejected", reason: rejectReason });
    } catch (err: any) {
      setError(err?.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

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
              value: requests.filter((r) => r.status === "approved" || r.status === "completed").length,
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

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

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
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          Loading requests...
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          No requests found.
                        </td>
                      </tr>
                    ) : (
                      requests.map((request) => (
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
                                  : request.status === "approved" || request.status === "completed"
                                    ? "bg-[#4ade80]/20 text-[#4ade80]"
                                    : "bg-[#ef4444]/20 text-[#ef4444]"
                              }`}
                            >
                              {request.status === "pending" && <Clock className="w-3 h-3" />}
                              {(request.status === "approved" || request.status === "completed") && <Check className="w-3 h-3" />}
                              {request.status === "rejected" && <X className="w-3 h-3" />}
                              {request.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
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
                {selectedRequest.type === "deposit" && selectedRequest.gatewayRef && (
                  <div>
                    <p className="text-gray-400 text-sm">Gateway Reference</p>
                    <p className="text-white font-mono text-sm">{selectedRequest.gatewayRef}</p>
                  </div>
                )}
              </div>

              {selectedRequest.status === "rejected" && selectedRequest.reason && (
                <div className="bg-[#ef4444]/20 border border-[#ef4444]/50 rounded-lg p-3 mb-6">
                  <p className="text-[#ef4444] text-sm font-bold mb-1">Rejection Reason</p>
                  <p className="text-gray-300 text-sm">{selectedRequest.reason}</p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <div className="space-y-3">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium disabled:opacity-50"
                  >
                    ✓ {selectedRequest.type === "withdraw" ? "Approve Request" : "Mark Completed"}
                  </button>
                  {selectedRequest.type === "withdraw" && (
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="w-full py-2 px-4 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 hover:bg-[#ef4444]/30 transition-all font-medium"
                    >
                      ✗ Reject Request
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-[#0f3460] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
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
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-all font-medium disabled:opacity-50"
                >
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
