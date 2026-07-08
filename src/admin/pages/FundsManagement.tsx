import { useEffect, useMemo, useState } from "react";
import { Check, X, Clock, RefreshCw, Search, Eye } from "lucide-react";
import { adminSupabase } from "../../lib/adminSupabase";
import { useAdmin } from "../context/AdminContext";

type RequestStatus = "pending" | "approved" | "processing" | "rejected" | "completed" | "failed";

interface FundsRequest {
  id: string;
  userId: string;
  phone: string;
  invite_code: string;
  is_agent: boolean;
  amount: number;
  method: string;
  account_name: string;
  account_number: string;
  status: RequestStatus;
  type: "withdraw" | "deposit";
  label: string;
  gateway_ref: string | null;
  reason: string | null;
  remarks: string | null;
  created_at: string;
}

const S: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400 border border-amber-500/40",
  approved:  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
  completed: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
  rejected:  "bg-red-500/20 text-red-400 border border-red-500/40",
  failed:    "bg-red-500/20 text-red-400 border border-red-500/40",
};

const sb = adminSupabase as any;

export function FundsManagement({ type }: { type: "withdraw" | "deposit" }) {
  const { adminRole } = useAdmin();
  const isSubAdmin = adminRole === "sub-admin";
  const [requests, setRequests]           = useState<FundsRequest[]>([]);
  const [filtered, setFiltered]           = useState<FundsRequest[]>([]);
  const [selected, setSelected]           = useState<FundsRequest | null>(null);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState<"all" | RequestStatus>("all");
  const [showReject, setShowReject]       = useState(false);
  const [rejectReason, setRejectReason]   = useState("");
  const [loading, setLoading]             = useState(false);
  const [acting, setActing]               = useState(false);
  const [error, setError]                 = useState("");

  // ── Realtime subscription for live withdrawal updates ──────────
  useEffect(() => {
    if (type !== "withdraw") return;
    const channel = sb
      .channel("admin-withdrawals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_history" },
        () => { void fetchRequests(); }
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const fetchRequests = async (keepSelected = false) => {
    setLoading(true); setError("");
    if (!keepSelected) setSelected(null);
    try {
      let rows: any[] = [];

      if (type === "withdraw") {
        const { data, error: e } = await sb
          .from("withdrawal_history")
          .select("id, user_id, amount, method, account_name, account_no, bank_name, status, gateway_ref, reason, remarks, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (e) throw e;
        rows = data || [];
      } else {
        const { data, error: e } = await sb
          .from("deposit_history")
          .select(
            "id, user_id, amount, status, gateway_ref, created_at, updated_at, method, order_id, gateway_ref, remarks"
          )
          .order("created_at", { ascending: false })
          .limit(500);
        if (e) throw e;
        rows = data || [];
      }

      // Batch-enrich with user info
      const uids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      const userMap: Record<string, { phone: string; invite_code: string; is_agent: boolean }> = {};

      if (uids.length > 0) {
        const { data: users } = await sb
          .from("users")
          .select("id, phone_number, invite_code, is_agent")
          .in("id", uids);
        (users || []).forEach((u: any) => {
          userMap[u.id] = {
            phone:       u.phone_number || "—",
            invite_code: u.invite_code  || "—",
            is_agent:    Boolean(u.is_agent),
          };
        });
      }

      const enriched: FundsRequest[] = rows.map((row: any) => {
        const u = userMap[row.user_id] || { phone: "—", invite_code: "—", is_agent: false };
        return {
          id:           row.id,
          userId:       row.user_id,
          phone:        u.phone,
          invite_code:  u.invite_code,
          is_agent:     u.is_agent,
          amount:       Number(row.amount ?? 0),
          method:       row.method || row.bank_name || "Manual",
          account_name: row.account_name || "—",
          account_number: row.account_number || (row.order_id ? String(row.order_id) : (row.gateway_ref || "—")),
          status:       (row.status as RequestStatus) || "pending",
          type,
          label:        type === "deposit" ? "Deposit" : u.is_agent ? "Agent Salary" : "Withdrawal",
          gateway_ref:  row.gateway_ref ?? null,
          reason:       row.reason ?? null,
          remarks:      row.remarks ?? null,
          created_at:   row.created_at || "",
        };
      });

      setRequests(enriched);
      
      if (keepSelected && selected) {
        const updated = enriched.find(r => r.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [type]);

  // ── Polling fallback for withdrawals stuck in "processing" ─────
  // If the webhook URL is not configured or PKPay didn't deliver,
  // this polls the gateway status to sync the withdrawal.
  useEffect(() => {
    if (type !== "withdraw") return;
    
    const intervalId = setInterval(async () => {
      const processingRequests = requests.filter(r => r.status === "processing");
      if (processingRequests.length === 0) return;
      
      console.log(`[poll] Checking ${processingRequests.length} stuck processing withdrawals...`);
      
      for (const req of processingRequests) {
        try {
          // Call the payout endpoint with status-check flag
          const response = await fetch("/api/payout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              withdrawal_id: req.id,
              adminSecretToken: import.meta.env.VITE_ADMIN_INTERNAL_MUTATION_KEY,
              __check_only: true,  // signal to backend: just check status, don't resend
            }),
          });
          
          const data = await response.json();
          if (data.success) {
            console.log(`[poll] Withdrawal ${req.id} resolved: ${data.message}`);
            await fetchRequests();  // Refresh the list
            break;  // One update at a time
          }
        } catch (err) {
          console.warn(`[poll] Error checking ${req.id}:`, err);
        }
      }
    }, 10000);  // Poll every 10 seconds
    
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, requests]);

  // Filter
  useEffect(() => {
      let r = requests;
    if (statusFilter !== "all") r = r.filter(x => x.status === statusFilter || (statusFilter === "approved" && x.status === "completed"));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        String(x.userId).toLowerCase().includes(q) ||
        x.invite_code.toLowerCase().includes(q) ||
        x.phone.includes(q) ||
        String(x.account_number || "").toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q)
      );
    }
    setFiltered(r);
  }, [search, statusFilter, requests]);

  const handleApprove = async () => {
    if (!selected || isSubAdmin) return;
    setActing(true); setError("");

    const requestId = selected.id;
    const currentStatus = selected.status;

    try {
      if (selected.type === "deposit") {
        // ── DEPOSIT APPROVAL ────────────────────────────────────────
        const { error: updateDepositErr } = await sb
          .from("deposit_history")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        if (updateDepositErr) throw new Error(`Deposit update error: ${updateDepositErr.message}`);
        setError(`✅ Deposit approved. Rs ${selected.amount.toLocaleString()} credited to main_balance.`);
        setTimeout(() => setError(""), 8000);

      } else {
        if (currentStatus === "pending") {
          const { error: updateErr } = await sb
            .from("withdrawal_history")
            .update({
              status: "processing",
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (updateErr) throw new Error(`Update error: ${updateErr.message}`);
          
          setRequests((prevList: any[]) =>
            prevList.map(item =>
              item.id === requestId ? { ...item, status: "processing" as RequestStatus } : item
            )
          );
          setSelected((prev) => prev?.id === requestId ? { ...prev, status: "processing" as RequestStatus } : prev);
          
          setError(`✅ Withdrawal moved to processing.`);
          setTimeout(() => setError(""), 8000);
          await fetchRequests(true);

        } else if (currentStatus === "processing") {
          try {
            const { data: approveData, error: approveErr } = await sb.rpc("approve_withdrawal", { p_withdrawal_id: requestId });
            
            if (approveErr) {
              const errMsg = (approveErr?.message || "").toLowerCase();
              if (!errMsg.includes("already_processed") && !errMsg.includes("already finalized")) {
                throw new Error(`RPC Error: ${approveErr.message}`);
              }
            }
          } catch (rpcErr) {
            console.warn("RPC call failed, continuing with payout...", rpcErr);
          }

          const adminSecretToken = import.meta.env.VITE_ADMIN_INTERNAL_MUTATION_KEY;
          if (!adminSecretToken) throw new Error("Admin secret token not configured");

          try {
            const payoutResponse = await fetch("/api/payout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                withdrawal_id: requestId,
                adminSecretToken: adminSecretToken,
              }),
            });

            const payoutResult = await payoutResponse.json();
            if (!payoutResponse.ok || !payoutResult.success) {
              console.warn("Payout API warning:", payoutResult.error);
            }
          } catch (payoutErr) {
            console.warn("Payout API call failed, continuing with status update...", payoutErr);
          }

          const { error: submitErr } = await sb
            .from("withdrawal_history")
            .update({
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (submitErr) throw new Error(`Submit error: ${submitErr.message}`);
          
          setRequests((prevList: any[]) =>
            prevList.map(item =>
              item.id === requestId ? { ...item, status: "completed" as RequestStatus, reason: null } : item
            )
          );
          setSelected((prev) => prev?.id === requestId ? { ...prev, status: "completed" as RequestStatus, reason: null } : prev);
          
          setError(`✅ Withdrawal submitted and completed.`);
          setTimeout(() => setError(""), 8000);
          await fetchRequests(true);
        }
      }

    } catch (err: any) {
      setError(err?.message || "Action failed");
      await fetchRequests(true);
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim() || isSubAdmin) { setError("Enter a rejection reason."); return; }
    setActing(true); setError("");
    try {
      if (selected.type === "withdraw") {
        // Refund balance via RPC
        await sb.rpc("fail_withdrawal", {
          p_withdrawal_id: selected.id,
          p_reason: rejectReason,
        });
        // Override status to 'rejected' with reason
        await sb.from("withdrawal_history").update({
          status: "rejected",
          reason: rejectReason,
          remarks: `Admin Rejected: ${rejectReason}`,
          updated_at: new Date().toISOString(),
        }).eq("id", selected.id);

        // Also insert into transactions for record
        await sb.from("transactions").insert({
          user_id:     selected.userId,
          type:        "withdraw",
          amount:      selected.amount,
          status:      "failed",
          gateway_ref: `Rejected: ${rejectReason}`,
          created_at:  new Date().toISOString(),
        });
      } else {
        // Reject deposit → update deposit_history status = 'failed'
        await sb.from("deposit_history").update({
          status: "failed",
          remarks: `Admin Rejected: ${rejectReason}`,
          updated_at: new Date().toISOString(),
        }).eq("id", selected.id);
      }
      setShowReject(false); setRejectReason("");
      await fetchRequests();
    } catch (err: any) {
      setError(err?.message || "Reject failed");
    } finally { setActing(false); }
  };

  const stats = useMemo(() => ({
    pending:  requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved" || r.status === "completed").length,
    rejected: requests.filter(r => r.status === "rejected" || r.status === "failed").length,
    total:    requests.reduce((s, r) => s + r.amount, 0),
  }), [requests]);

  // ── Shared detail panel content ────────────────────────────────────
  const DetailContent = ({ req }: { req: FundsRequest }) => (
    <>
      <div className="space-y-3 mb-5 text-sm">
        <div className="bg-[#0f3460] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">UID</p>
          <p className="text-amber-400 font-black text-2xl font-mono tracking-widest">{req.invite_code}</p>
        </div>
        <div className="flex justify-between"><span className="text-gray-400">Phone</span><span className="text-white font-mono">+92{req.phone}</span></div>
        <div><p className="text-gray-400 text-xs mb-0.5">User ID</p><p className="text-gray-500 font-mono text-[10px] break-all">{req.userId}</p></div>
        <div className="flex justify-between items-center"><span className="text-gray-400">Amount</span><span className="text-amber-400 font-black text-lg">Rs {req.amount.toLocaleString()}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="text-white font-bold">{req.method}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Account Name</span><span className="text-white">{req.account_name}</span></div>
        <div className="bg-[#0f3460] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Account Number</p>
          <p className="text-white font-mono font-bold">{req.account_number}</p>
        </div>
        <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-gray-300 text-xs">{new Date(req.created_at).toLocaleString()}</span></div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Status</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${S[req.status]}`}>{req.status}</span>
        </div>
        {/* Show gateway error logs when failed/pending with error */}
        {(req.status === "failed" || req.status === "pending") && req.remarks && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-xs font-bold mb-1">Gateway Error Details</p>
            <p className="text-gray-300 text-xs">{req.remarks}</p>
          </div>
        )}
        {/* Show gateway_error_logs if set (contains extra error context from payout backend) */}
        {(req.status === "pending" || req.status === "failed") && req.reason && req.reason !== req.remarks && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
            <p className="text-amber-400 text-[10px] font-bold mb-0.5">Gateway Error Log</p>
            <p className="text-gray-400 text-[10px]">{req.reason}</p>
          </div>
        )}
      </div>
      {(req.status === "pending" || req.status === "processing") && (
        <div className="space-y-2">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mb-3">
            <p className="text-blue-400 text-xs font-bold">Withdrawal Flow</p>
            <p className="text-blue-300 text-[10px] mt-1">
              {req.status === "pending" 
                ? "Step 1/2: Approve withdrawal request" 
                : "Step 2/2: Send payment to user's account"}
            </p>
          </div>
          <button onClick={() => handleApprove()} disabled={acting || isSubAdmin}
            className={`w-full py-3 rounded-lg font-black text-sm min-h-[44px] flex items-center justify-center gap-2 ${
              isSubAdmin
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-50"
                : "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:brightness-110 disabled:opacity-50"
            }`}>
            {isSubAdmin ? <Eye className="w-4 h-4" /> : null}
            {isSubAdmin ? "View Only (Read-Only Mode)" : acting ? "Processing..." : req.status === "pending" ? (req.type === "withdraw" ? (req.is_agent ? "✓ Approve Agent Salary" : "✓ Approve Withdrawal") : "✓ Approve Deposit") : "✓ Send Payment"}
          </button>
          {req.status === "pending" && (
            <button onClick={() => setShowReject(true)} disabled={acting || isSubAdmin}
              className={`w-full py-3 rounded-lg font-black text-sm min-h-[44px] ${
                isSubAdmin
                  ? "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-50"
                  : "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              }`}>
              ✗ Reject
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b] min-h-screen">
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-white">{type === "withdraw" ? "Withdrawals" : "Deposits"}</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-0.5">{type === "withdraw" ? "Approve or reject withdrawal requests" : "Review and approve deposit transactions"}</p>
          </div>
          <button onClick={() => fetchRequests()} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-[#1a1a2e] border border-[#0f3460] text-gray-300 rounded-lg hover:border-amber-500/50 text-sm min-h-[44px]">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
          {[
            { label: "Pending",  value: stats.pending,                color: "text-amber-400",   border: "border-amber-500/30" },
            { label: "Approved", value: stats.approved,               color: "text-emerald-400", border: "border-emerald-500/30" },
            { label: "Rejected", value: stats.rejected,               color: "text-red-400",     border: "border-red-500/30" },
            { label: "Total Rs", value: stats.total.toLocaleString(), color: "text-white",       border: "border-white/10" },
          ].map((s, i) => (
            <div key={i} className={`bg-[#1a1a2e] rounded-xl p-3 md:p-4 border ${s.border}`}>
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-lg md:text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">{error}</div>}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phone, UID, ID..."
              className="w-full bg-[#1a1a2e] border border-[#0f3460] text-white pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {(["all", "pending", "approved", "rejected", "failed"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all whitespace-nowrap min-h-[44px] ${
                  statusFilter === s ? "bg-amber-500 text-black border-amber-500" : "bg-[#1a1a2e] text-gray-400 border-[#0f3460]"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* MOBILE: Card list */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No requests found.</div>
          ) : filtered.map(req => (
            <div key={req.id} onClick={() => setSelected(req === selected ? null : req)}
              className={`bg-[#1a1a2e] rounded-xl border p-4 cursor-pointer transition-all ${
                selected?.id === req.id ? "border-amber-500/60" : "border-[#0f3460]"
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    req.is_agent ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                  }`}>{req.label}</span>
                  <span className="text-amber-400 font-black font-mono text-sm">{req.invite_code}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${S[req.status] || ""}`}>
                  {req.status === "pending" && <Clock className="w-3 h-3" />}
                  {(req.status === "approved" || req.status === "completed") && <Check className="w-3 h-3" />}
                  {(req.status === "rejected" || req.status === "failed") && <X className="w-3 h-3" />}
                  {req.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">{req.phone} · {req.method}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{new Date(req.created_at).toLocaleString()}</p>
                </div>
                <p className="text-amber-400 font-black text-lg">Rs {req.amount.toLocaleString()}</p>
              </div>
              {selected?.id === req.id && (
                <div className="mt-4 pt-4 border-t border-[#0f3460]">
                  <DetailContent req={req} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DESKTOP: Table + Detail panel */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#1a1a2e] rounded-xl border border-[#0f3460] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f3460] border-b border-[#1a5f7a]">
                    {["Type","UID","Phone","Amount","Method","Date","Status"].map(h => (
                      <th key={h} className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">No requests found.</td></tr>
                  ) : filtered.map(req => (
                    <tr key={req.id} onClick={() => setSelected(req)}
                      className={`border-b border-[#0f3460]/60 cursor-pointer transition-all ${selected?.id === req.id ? "bg-[#0f3460]" : "hover:bg-[#0f3460]/50"}`}>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${req.is_agent ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"}`}>{req.label}</span>
                      </td>
                      <td className="py-3 px-4 text-amber-400 font-black font-mono text-sm">{req.invite_code}</td>
                      <td className="py-3 px-4 text-gray-300 text-xs font-mono">{req.phone}</td>
                      <td className="py-3 px-4 text-amber-400 font-black">Rs {req.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-300 text-xs">{req.method}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{new Date(req.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${S[req.status] || ""}`}>
                          {req.status === "pending" && <Clock className="w-3 h-3" />}
                          {(req.status === "approved" || req.status === "completed") && <Check className="w-3 h-3" />}
                          {(req.status === "rejected" || req.status === "failed") && <X className="w-3 h-3" />}
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="bg-[#1a1a2e] rounded-xl border border-[#0f3460] p-5 h-fit">
            {selected ? (
              <>
                <h3 className="text-white font-black text-base mb-4 uppercase tracking-wider">Request Details</h3>
                <DetailContent req={selected} />
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
      {showReject && selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#1a1a2e] border border-[#0f3460] rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-1">Reject Request</h3>
            <p className="text-gray-400 text-sm mb-3">UID: <span className="text-amber-400 font-black">{selected.invite_code}</span> · Rs {selected.amount.toLocaleString()}</p>
            {selected.type === "withdraw" && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 mb-3">
                Rs {selected.amount.toLocaleString()} will be refunded to user's balance.
              </p>
            )}
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..."
              className="w-full h-24 bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-4 text-sm resize-none" />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowReject(false); setRejectReason(""); setError(""); }}
                className="flex-1 py-2 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] text-sm">Cancel</button>
              <button onClick={handleReject} disabled={acting}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-sm disabled:opacity-50">
                {acting ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}