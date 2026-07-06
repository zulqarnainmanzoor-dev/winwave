import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface DepositRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  gateway_ref: string | null;
  order_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

export default function DepositHistoryView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("7days");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const parseStatus = (status: string): string => {
    const s = (status || "").toLowerCase().trim();
    if (s === "completed") return "completed";
    if (s === "failed") return "failed";
    return "pending";
  };

  const fetchDeposits = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const daysMap = { "1day": 1, "7days": 7, "30days": 30 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[activeTab]);

      // Use the RPC function to get complete deposit history
      const { data, error } = await supabase
        .rpc('get_user_complete_deposit_history', { p_user_id: uid })
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        // Fallback to deposit_history if RPC fails
        console.warn("RPC failed, falling back to deposit_history:", error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("deposit_history")
          .select("id, amount, method, status, gateway_ref, order_id, remarks, created_at, updated_at")
          .eq("user_id", uid)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(100);
        
        if (fallbackError) throw fallbackError;
        setDeposits(fallbackData || []);
      } else {
        setDeposits(data || []);
      }
    } catch (e) {
      console.error("fetchDeposits error:", e);
    } finally {
      setLoading(false);
    }
  }, [uid, activeTab]);

  // Initial fetch
  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  // Real-time subscription for ALL deposit sources
  useEffect(() => {
    if (!uid) return;

    const channel = supabase
      .channel(`deposit-history-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_history',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          fetchDeposits();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${uid} AND type=eq.deposit`,
        },
        () => {
          fetchDeposits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, fetchDeposits]);

  const totalSum = deposits.reduce((acc, d) => acc + d.amount, 0);
  const tabLabel = { "1day": "1 Day", "7days": "7 Days", "30days": "30 Days" };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-black tracking-widest text-base uppercase">Recharge History</h1>
        <RefreshCw
          className={`w-5 h-5 text-[#ffa502] cursor-pointer ${loading ? "animate-spin" : ""}`}
          onClick={fetchDeposits}
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
        <span>{deposits.length} record{deposits.length !== 1 ? "s" : ""}</span>
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
        ) : deposits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock className="w-10 h-10 opacity-30 mb-3" />
            <p className="text-sm">No deposits found</p>
          </div>
        ) : (
          deposits.map((dep) => {
            const normalizedStatus = parseStatus(dep.status);
            const statusInfo = statusConfig[normalizedStatus] || statusConfig.pending;

            return (
              <div
                key={dep.id}
                className="bg-[#161618] border border-white/5 rounded-2xl p-4 shadow-lg space-y-3"
              >
                {/* Row 1: Date & Status Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-[#ffa502]/10 flex items-center justify-center flex-shrink-0 border border-[#ffa502]/20">
                      <Clock className="w-4.5 h-4.5 text-[#ffa502]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-blue-400 font-bold text-[12px] tracking-tight">
                        {new Date(dep.created_at).toLocaleString()}
                      </span>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        Order: {dep.order_id ? dep.order_id.substring(0, 12) + '...' : 'N/A'}
                        {dep.order_id && (
                          <button onClick={() => handleCopy(dep.order_id!, `order-${dep.id}`)} className="ml-1 inline align-middle hover:text-white transition-colors">
                            {copiedField === `order-${dep.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400 inline" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400 hover:text-white inline" />
                            )}
                          </button>
                        )}
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
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Amount</span>
                    <span className="text-[#ffa502] font-black text-base leading-tight">
                      +Rs {dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Method</span>
                    <div className="font-bold text-[11px] text-gray-200 uppercase tracking-wide">
                      {dep.method || "PKPAY"}
                    </div>
                  </div>
                </div>

                {/* Row 3: Gateway Reference */}
                {dep.gateway_ref && (
                  <div className="text-[10px] text-gray-500 font-mono bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Gateway:</span>
                      <span className="text-gray-300">{dep.gateway_ref.substring(0, 30)}...</span>
                    </div>
                  </div>
                )}

                {/* Row 4: Remarks */}
                {dep.remarks && (
                  <div className="bg-white/5 rounded-lg px-3 py-2 text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">Remarks: </span>
                    "{dep.remarks}"
                  </div>
                )}

                {/* Row 5: View Receipt Button */}
                <button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs py-2.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Receipt
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