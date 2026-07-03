import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface DepositRecord {
  id: string;
  amount: number;
  bonus: number;
  method: string;
  status: string;
  gateway_ref: string | null;
  created_at: string;
}

export default function DepositHistoryView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("7days");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeposits = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const daysMap = { "1day": 1, "7days": 7, "30days": 30 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[activeTab]);

      // Query deposit_history table directly with correct columns:
      // id, amount, bonus, method, status, gateway_ref, created_at
      const { data, error } = await (supabase as any)
        .from("deposit_history")
        .select("id, amount, bonus, method, status, gateway_ref, created_at")
        .eq("user_id", uid)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rawData = (data || []) as any[];
      setDeposits(
        rawData.map((tx: any) => ({
          id: tx.id,
          amount: Number(tx.amount ?? 0),
          bonus: Number(tx.bonus ?? 0),
          method: tx.method || "Gateway",
          status: tx.status === "success" ? "Completed" : tx.status === "failed" ? "Failed" : "Pending",
          gateway_ref: tx.gateway_ref || null,
          created_at: tx.created_at,
        }))
      );
    } catch (e) {
      console.error("fetchDeposits error:", e);
    } finally {
      setLoading(false);
    }
  }, [uid, activeTab]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const totalSum = deposits.reduce((acc, d) => acc + d.amount, 0);
  const totalBonus = deposits.reduce((acc, d) => acc + d.bonus, 0);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const tabLabel = { "1day": "1 Day", "7days": "7 Days", "30days": "30 Days" };

  // Status badge renderer
  const getStatusStyle = (status: string) => {
    if (status === "Completed") return "text-emerald-400";
    if (status === "Failed") return "text-red-400";
    return "text-amber-400";
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

      {/* Tabs */}
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

      {/* Summary */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0">
        <span>{deposits.length} record{deposits.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-3">
          <span>
            Amount: <span className="text-[#ffa502]">Rs {totalSum.toLocaleString()}</span>
          </span>
          <span>
            Bonus: <span className="text-blue-400">Rs {totalBonus.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* List */}
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
          deposits.map((dep) => (
            <div
              key={dep.id}
              className="bg-[#161618] border border-white/5 rounded-2xl p-4 shadow-lg space-y-3"
            >
              {/* Row 1: Date + Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#ffa502]/10 flex items-center justify-center flex-shrink-0 border border-[#ffa502]/20">
                    <Clock className="w-4.5 h-4.5 text-[#ffa502]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="text-blue-400 font-bold text-[12px] tracking-tight">
                      {new Date(dep.created_at).toLocaleString()}
                    </span>
                    {dep.gateway_ref && (
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        Order: {dep.gateway_ref.substring(0, 12)}...
                        <button onClick={() => handleCopy(dep.gateway_ref!)} className="ml-1 inline align-middle hover:text-white">
                          {copiedId === dep.gateway_ref ? (
                            <Check className="w-3 h-3 text-emerald-400 inline" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400 hover:text-white inline" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <span className={`font-black text-[10px] uppercase tracking-wider ${getStatusStyle(dep.status)}`}>
                  {dep.status}
                </span>
              </div>

              {/* Row 2: Amount + Bonus */}
              <div className="flex items-center justify-between bg-[#0A0A0B]/50 rounded-xl px-3 py-2.5 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Amount</span>
                  <span className="text-[#ffa502] font-black text-base leading-tight">
                    +Rs {dep.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Method</span>
                  <div className="font-bold text-xs text-gray-200 uppercase">
                    {dep.method}
                  </div>
                  {dep.bonus > 0 && (
                    <div className="text-[11px] font-bold text-blue-400 mt-0.5">
                      Bonus: +Rs {dep.bonus.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">— end —</div>
      </div>
    </div>
  );
}