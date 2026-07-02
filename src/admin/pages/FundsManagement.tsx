import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock, RefreshCw, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type RequestStatus = "pending" | "approved" | "rejected" | "completed";
type RequestType = "withdraw" | "deposit";

interface UserInfo {
  phone: string;
  invite_code: string;
  is_agent: boolean;
  main_balance: number;
}

interface FundsRequest {
  id: string;
  userId: string;
  // enriched from public.users
  phone: string;
  invite_code: string;
  is_agent: boolean;
  // request fields
  amount: number;
  method: string;
  account_name: string;
  account_number: string;
  status: RequestStatus;
  type: RequestType;
  request_type_label: string; // "Agent Salary Release" | "Member Withdrawal" | "Deposit"
  gateway_ref: string | null;
  reason: string | null;
  created_at: string;
}

interface FundsManagementProps {
  type: "withdraw" | "deposit";
}

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400 border border-amber-500/40",
  approved:  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
  completed: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
  rejected:  "bg-red-500/20 text-red-400 border border-red-500/40",
};

export function FundsManagement({ type }: FundsManagementProps) {
  const [requests, setRequests]               = useState<FundsRequest[]>([]);
  const [filtered, setFiltered]               = useState<FundsRequest[]>([]);
  const [selected, setSelected]               = useState<FundsRequest | null>(null);
  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState<"all" | RequestStatus>("all");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [loading, setLoading]                 = useState(false);
  const [actionLoading, setActionLoading]     = useState(false);
  const [error, setError]                     = useState("");

  // ── Fetch & enrich ────────────────────────────────────────────
  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      let rows: any[] = [];

      if (type === "withdraw") {
        const { data, error: e } = await supabase
          .from("withdraw_requests" as any)
          .select("id, user_id, amount, bank_name, account_name, account_number, status, created_at, reason")
          .order("created_at", { ascending: false })
          .limit(200);
        if (e) throw e;
        rows = data || [];
      } else {
        const { data, error: e } = await supabase
          .from("transactions")
          .select("id, user_id, amount, status, gateway_ref, created_at")
          .eq("type", "deposit")
          .order("created_at", { ascending: false })
          .limit(200);
        if (e) throw e;
        rows = data || [];
      }

      // Enrich with user info in one batch query
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      let userMap: Record<string, UserInfo> = {};

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, phone_number, invite_code, is_agent, main_balance")
          .in("id", userIds);

        (users || []).forEach((u: any) => {
          userMap[u.id] = {
            phone:       u.phone_number || "—",
            invite_code: u.invite_code  || "—",
            is_agent:    Boolean(u.is_agent),
            main_balance: Number(u.main_balance ?? 0),
          };
        });
      }

      const enriched: FundsRequest[] = rows.map((row: any) => {
        const user = userMap[row.user_id] || { phone: "—", invite_code: "—", is_agent: false, main_balance: 0 };
        const isAgent = user.is_agent;

        let request_type_label = type === "deposit" ? "Deposit" : isAgent ? "Agent Salary Release" : "Member Withdrawal";

        return {
          id:                 row.id,
          userId:             row.user_id,
          phone:              user.phone,
          invite_code:        user.invite_code,
          is_agent:           isAgent,
          amount:             Number(row.amount ?? 0),
          method:             row.bank_name || (row.gateway_ref ? "Payment Gateway" : "Manual"),
          account_name:       row.account_name || "—",
          account_number:     row.account_number || row.gateway_ref || "—",
          status:             (row.status as RequestStatus) || "pending",
          type:               type,
          request_type_label,
          gateway_ref:        row.gateway_ref ?? null,
          reason:             row.reason ?? null,
          created_at:         row.created_at || "",
        };
      });

      setRequests(enriched);
      setFiltered(enriched);
    } catch (err: any) {
      setError(err?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [type]);

  // ── Search + filter ───────────────────────────────────────────
  useEffect(() => {
    let result = requests;
    if (statusFilter !== "all") {
      result = result.filter(r => r.status === statusFilter || (statusFilter === "approved" && r.status === "completed"));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.invite_code.includes(q) ||
        r.userId.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, requests]);

  // ── Approve ───────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError("");
    try {
      if (selected.type === "withdraw") {
        // Mark approved — balance was already deducted when user submitted
        const { error: e } = await (supabase.from("withdraw_requests") as any)
          .update({ status: "approved" })
          .eq("id", selected.id);
        if (e) throw e;
      } else {
        // Deposit: mark completed + credit user balance
        const { data: userRow } = await supabase
          .from("users")
          .select("main_balance")
          .eq("id", selected.userId)
          .maybeSingle();

        const bonus = parseFloat((selected.amount * 0.02).toFixed(2));
        const newBal = Number(userRow?.main_balance ?? 0) + selected.amount + bonus;

        const { error: balErr } = await supabase
          .from("users")
          .update({ main_balance: newBal })
          .eq("id", selected.userId);
        if (balErr) throw balErr;

        const { error: txErr } = await supabase
          .from("transactions")
          .update({ status: "completed" })
          .eq("id", selected.id);
        if (txErr) throw txErr;
      }

      await fetchRequests();
    } catch (err: any) {
      setError(err?.message || "Approve failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject (refund balance for withdrawals) ───────────────────
  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      if (selected.type === "withdraw") {
        // Refund the amount back to user's main_balance
        const { data: userRow } = await supabase
          .from("users")
          .select("main_balance")
          .eq("id", selected.userId)
          .maybeSingle();

        const refunded = Number(userRow?.main_balance ?? 0) + selected.amount;
        await supabase.from("users").update({ main_balance: refunded }).eq("id", selected.userId);

        await (supabase.from("withdraw_requests") as any)
          .update({ status: "rejected", reason: rejectReason })
          .eq("id", selected.id);
      } else {
        await supabase
          .from("transactions")
          .update({ status: "failed", gateway_ref: rejectReason })
          .eq("id", selected.id);
      }

      setShowRejectModal(false);
      setRejectReason("");
      await fetchRequests();
    } catch (err: any) {
      setError(err?.message || "Reject failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending:   requests.filter(r => r.status === "pending").length,
    approved:  requests.filter(r => r.status === "approved" || r.status === "completed").length,
    rejected:  requests.filter(r => r.status === "rejected").length,
    total:     requests.reduce((s, r) => s + r.amount, 0),
    agents:    requests.filter(r => r.is_agent).length,
  }), [requests]);

  const title = type === "withdraw" ? "Withdrawal Requests" : "Deposit Requests";

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b] min-h-screen">
      <div className="p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {type === "withdraw" ? "Approve or reject withdrawal requests from members and agents" : "Review and approve deposit transactions"}
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#0f3460] text-gray-300 rounded-lg hover:border-amber-500/50 transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: "Pending",  value: stats.pending,                        color: "text-amber-400",   bg: "border-amber-500/30" },
            { label: "Approved", value: stats.approved,                       color: "text-emerald-400", bg: "border-emerald-500/30" },
            { label: "Rejected", value: stats.rejected,                       color: "text-red-400",     bg: "border-red-500/30" },
            { label: "Agents",   value: stats.agents,                         color: "text-blue-400",    bg: "border-blue-500/30" },
            { label: "Total Rs", value: `${stats.total.toLocaleString()}`,    color: "text-white",       bg: "border-white/10" },
          ].map((s, i) => (
            <div key={i} className={`bg-[#1a1a2e] rounded-xl p-4 border ${s.bg}`}>
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Search + Filter */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone, invite code, or request ID..."
              className="w-full bg-[#1a1a2e] border border-[#0f3460] text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          {(["all", "pending", "approved", "rejected"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all border ${
                statusFilter === s
                  ? "bg-amber-500 text-black border-amber-500"
                  : "bg-[#1a1a2e] text-gray-400 border-[#0f3460] hover:border-amber-500/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Table + Detail Panel */}
        <div className="grid grid-cols-3 gap-6">

          {/* Table */}
          <div className="col-span-2 bg-[#1a1a2e] rounded-xl border border-[#0f3460] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f3460] border-b border-[#1a5f7a]">
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">UID</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Phone</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Method</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">No requests found.</td></tr>
                  ) : (
                    filtered.map(req => (
                      <tr
                        key={req.id}
                        onClick={() => setSelected(req)}
                        className={`border-b border-[#0f3460]/60 cursor-pointer transition-all ${
                          selected?.id === req.id ? "bg-[#0f3460]" : "hover:bg-[#0f3460]/50"
                        }`}
                      >
                        {/* Type label */}
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            req.is_agent ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                          }`}>
                            {req.request_type_label}
                          </span>
                        </td>
                        {/* UID = invite_code */}
                        <td className="py-3 px-4">
                          <span className="text-amber-400 font-black font-mono text-sm">
                            {req.invite_code}
                          </span>
                        </td>
                        {/* Phone */}
                        <td className="py-3 px-4 text-gray-300 text-xs font-mono">{req.phone}</td>
                        {/* Amount */}
                        <td className="py-3 px-4 text-amber-400 font-black">Rs {req.amount.toLocaleString()}</td>
                        {/* Method */}
                        <td className="py-3 px-4 text-gray-300 text-xs">{req.method}</td>
                        {/* Date */}
                        <td className="py-3 px-4 text-gray-500 text-xs">{new Date(req.created_at).toLocaleString()}</td>
                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${STATUS_STYLE[req.status] || ""}`}>
                            {req.status === "pending"   && <Clock className="w-3 h-3" />}
                            {(req.status === "approved" || req.status === "completed") && <Check className="w-3 h-3" />}
                            {req.status === "rejected"  && <X className="w-3 h-3" />}
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="bg-[#1a1a2e] rounded-xl border border-[#0f3460] p-5 h-fit">
            {selected ? (
              <>
                <h3 className="text-white font-black text-base mb-5 uppercase tracking-wider">Request Details</h3>

                <div className="space-y-3 mb-5 text-sm">

                  {/* Type badge */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Request Type</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      selected.is_agent ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                    }`}>
                      {selected.request_type_label}
                    </span>
                  </div>

                  {/* UID */}
                  <div className="bg-[#0f3460] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">UID (Invite Code)</p>
                    <p className="text-amber-400 font-black text-2xl font-mono tracking-widest">{selected.invite_code}</p>
                  </div>

                  {/* Phone */}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone</span>
                    <span className="text-white font-mono">+92{selected.phone}</span>
                  </div>

                  {/* User UUID */}
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">User ID</p>
                    <p className="text-gray-500 font-mono text-[10px] break-all">{selected.userId}</p>
                  </div>

                  {/* Amount */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-amber-400 font-black text-lg">Rs {selected.amount.toLocaleString()}</span>
                  </div>

                  {/* Method */}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Method</span>
                    <span className="text-white font-bold">{selected.method}</span>
                  </div>

                  {/* Account Name */}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Name</span>
                    <span className="text-white">{selected.account_name}</span>
                  </div>

                  {/* Account Number */}
                  <div className="bg-[#0f3460] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Account Number</p>
                    <p className="text-white font-mono font-bold">{selected.account_number}</p>
                  </div>

                  {/* Date */}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Requested</span>
                    <span className="text-gray-300 text-xs">{new Date(selected.created_at).toLocaleString()}</span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[selected.status]}`}>
                      {selected.status}
                    </span>
                  </div>

                  {/* Rejection reason */}
                  {selected.status === "rejected" && selected.reason && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-400 text-xs font-bold mb-1">Rejection Reason</p>
                      <p className="text-gray-300 text-xs">{selected.reason}</p>
                    </div>
                  )}
                </div>

                {/* Action buttons — only for pending */}
                {selected.status === "pending" && (
                  <div className="space-y-2">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black rounded-lg hover:brightness-110 transition-all disabled:opacity-50 text-sm"
                    >
                      {actionLoading ? "Processing..." : selected.type === "withdraw"
                        ? (selected.is_agent ? "✓ Release Agent Salary" : "✓ Approve Withdrawal")
                        : "✓ Approve Deposit"}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-red-500/20 text-red-400 border border-red-500/40 font-black rounded-lg hover:bg-red-500/30 transition-all text-sm"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <Clock className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Select a request to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#1a1a2e] border border-[#0f3460] rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-1">Reject Request</h3>
            <p className="text-gray-400 text-sm mb-4">
              UID: <span className="text-amber-400 font-black">{selected.invite_code}</span>
              {" · "}Amount: <span className="text-amber-400 font-black">Rs {selected.amount.toLocaleString()}</span>
            </p>
            {selected.type === "withdraw" && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 mb-4">
                Rs {selected.amount.toLocaleString()} will be refunded to user's main balance.
              </p>
            )}
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-24 bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-4 text-sm resize-none"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); setError(""); }}
                className="flex-1 py-2 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-red-500 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-bold text-sm disabled:opacity-50"
              >
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
