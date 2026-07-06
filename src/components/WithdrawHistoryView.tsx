import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface WithdrawRecord {
  id: string;
  amount: number;
  method: string;
  account_no: string | null;
  account_name: string | null;
  status: string;
  created_at: string;
  remarks: string | null;
  reason: string | null;
  user_id: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

export default function WithdrawHistoryView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("7days");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [records, setRecords] = useState<WithdrawRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const parseStatus = (status: string): string => {
    const s = (status || "").toLowerCase().trim();
    if (s === "completed" || s === "approved") return "approved";
    if (s === "rejected" || s === "failed") return "rejected";
    return "pending";
  };

  const fetchWithdrawals = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const daysMap = { "1day": 1, "7days": 7, "30days": 30 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[activeTab]);

      // Use the correct column names from the withdrawal_history table schema:
      // id, user_id, amount, method, account_name, account_number, status,
      // gateway_ref, reason, remarks, created_at, updated_at
      const { data, error } = await supabase
        .from("withdrawal_history")
        .select("id, amount, method, account_no, account_name, status, created_at, remarks, reason, user_id")
        .eq("user_id", uid)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("fetchWithdrawals error:", error);
        return;
      }
      setRecords(data || []);
    } catch (e) {
      console.error("fetchWithdrawals catch:", e);
    } finally {
      setLoading(false);
    }
  }, [uid, activeTab]);

  // Initial fetch
  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  // Real-time subscription — auto-refresh on any row change in withdrawal_history for this user
  useEffect(() => {
    if (!uid) return;

    const channel = supabase
      .channel(`withdrawal-history-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawal_history',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          fetchWithdrawals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, fetchWithdrawals]);

  const totalSum = records.reduce((acc, r) => acc + r.amount, 0);
  const tabLabel = { "1day": "1 Day", "7days": "7 Days", "30days": "30 Days" };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Render rejection reason fallback: use 'reason' column if status is rejected/failed
  const getRejectionMessage = (rec: WithdrawRecord): string | null => {
    return rec.reason || rec.remarks || null;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-black tracking-widest text-base uppercase">Withdraw History</h1>
        <RefreshCw
          className={`w-5 h-5 text-[#ffa502] cursor-pointer ${loading ? "animate-spin" : ""}`}
          onClick={fetchWithdrawals}
        />
      </div>

      {/* Tab bar */}
      <div className="flex bg-[#161618] border-b border-white/5 text-sm font-semibold select-none flex-shrink-0">
        {(["1day", "7days", "30days"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center transition-all relative ${
              activeTab === tab ? "text-[#ffa502]" : "text-gray-400 hover:text-white"
            }`}
          >
            {tabLabel[tab]}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffa502]" />}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0 border-b border-white/5">
        <span>{records.length} record{records.length !== 1 ? "s" : ""}</span>
        <span>
          Total:{" "}
          <span className="text-[#ffa502]">
            Rs {totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      </div>

      {/* Records list */}
      <div className="p-4 space-y-3 flex-1 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin opacity-40 mb-3" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock className="w-10 h-10 opacity-30 mb-3" />
            <p className="text-sm">No withdrawals found</p>
          </div>
        ) : (
          records.map((rec) => {
            const normalizedStatus = parseStatus(rec.status);
            const statusInfo = statusConfig[normalizedStatus] || statusConfig.pending;
            const rejectionMsg = getRejectionMessage(rec);

            return (
              <div
                key={rec.id}
                className="bg-[#161618] border border-white/5 rounded-2xl p-4 shadow-lg space-y-3"
              >
                {/* Row 1: Date & Status Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-[#ff4757]/10 flex items-center justify-center flex-shrink-0 border border-[#ff4757]/20">
                      <Clock className="w-4.5 h-4.5 text-[#ff4757]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-blue-400 font-bold text-[12px] tracking-tight">
                        {new Date(rec.created_at).toLocaleString()}
                      </span>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        ID: {rec.id.substring(0, 8)}...{rec.id.slice(-4)}
                        <button
                          onClick={() => handleCopy(rec.id, `id-${rec.id}`)}
                          className="ml-1 inline align-middle hover:text-white transition-colors"
                        >
                          {copiedField === `id-${rec.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400 inline" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400 hover:text-white inline" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusInfo.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                    <span className={`font-black text-[10px] uppercase tracking-wider ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Row 2: Amount + Method */}
                <div className="flex items-center justify-between bg-[#0A0A0B]/50 rounded-xl px-3 py-2.5 border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Cash</span>
                    <span className="text-[#ff4757] font-black text-base leading-tight">
                      -Rs {rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Method</span>
                    <div className="font-bold text-[11px] text-gray-200 uppercase tracking-wide">
                      METHOD: {rec.method || "—"}
                    </div>
                  </div>
                </div>

                {/* Row 3: Account Details */}
                {(rec.account_name || rec.account_number) && (
                  <div className="text-[10px] text-gray-500 font-mono bg-white/5 rounded-lg px-3 py-2">
                    {rec.account_name && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Name:</span>
                        <span className="text-gray-300 font-semibold">{rec.account_name}</span>
                      </div>
                    )}
                    {rec.account_number && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-gray-400">Acc:</span>
                        <span className="text-gray-300">{rec.account_number}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 4: User Remarks (if any) */}
                {rec.remarks && normalizedStatus === "pending" && (
                  <div className="bg-white/5 rounded-lg px-3 py-2 text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">Remarks: </span>
                    "{rec.remarks}"
                  </div>
                )}

                {/* Row 5: Rejection Reason */}
                {normalizedStatus === "rejected" && rejectionMsg && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[10px] text-red-400 uppercase tracking-wider block mb-0.5">
                          Rejection Reason
                        </span>
                        <span className="text-[11px] text-red-300/90 leading-relaxed">
                          {rejectionMsg}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 6: Submit Receipt Button — always visible */}
                <button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs py-2.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Submit Receipt
                </button>
              </div>
            );
          })
        )}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">— end —</div>
      </div>
    </div>
  );
}