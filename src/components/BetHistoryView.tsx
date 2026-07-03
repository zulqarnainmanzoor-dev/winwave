import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw, Target } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface BetRecord {
  id: string;
  amount: number;
  period: string;
  bet_type: string | null;
  bet_value: string | null;
  result_number: number | null;
  result_size: string | null;
  result_color: string | null;
  payout: number | null;
  created_at: string;
  status: string;
}

export default function BetHistoryView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("7days");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [records, setRecords] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const daysMap = { "1day": 1, "7days": 7, "30days": 30 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[activeTab]);

      // Query betting_history with joined game_rounds data for result_number, result_size, result_color
      const { data, error } = await supabase
        .from("betting_history")
        .select(`
          id, amount, period, bet_type, bet_value, payout, status, created_at,
          game_round:round_id (result_number, result_size, result_color)
        `)
        .eq("user_id", uid)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        amount: Number(r.amount ?? 0),
        period: r.period || "—",
        bet_type: r.bet_type || null,
        bet_value: r.bet_value || null,
        result_number: r.game_round?.result_number ?? null,
        result_size: r.game_round?.result_size ?? null,
        result_color: r.game_round?.result_color ?? null,
        payout: r.payout ? Number(r.payout) : null,
        status: r.status || "pending",
        created_at: r.created_at,
      }));

      setRecords(mapped);
    } catch (e) {
      console.error("fetchBets error:", e);
    } finally {
      setLoading(false);
    }
  }, [uid, activeTab]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  const totalBet = records.reduce((acc, r) => acc + r.amount, 0);
  const totalPayout = records.reduce((acc, r) => acc + (r.payout || 0), 0);
  const tabLabel = { "1day": "1 Day", "7days": "7 Days", "30days": "30 Days" };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Render the bet selection as human-readable text
  const renderSelection = (rec: BetRecord): string => {
    // bet_type = 'size' → bet_value is 'Big' | 'Small'
    // bet_type = 'number' → bet_value is a digit 0-9
    if (rec.bet_type === "size") return rec.bet_value === "Big" ? "Big" : "Small";
    if (rec.bet_type === "number") return `Number ${rec.bet_value}`;
    return rec.bet_value || "—";
  };

  const getResultColorClass = (color: string | null): string => {
    switch (color?.toLowerCase()) {
      case "red": return "text-red-400";
      case "green": return "text-emerald-400";
      case "violet": return "text-purple-400";
      default: return "text-gray-400";
    }
  };

  const getBgColorClass = (color: string | null): string => {
    switch (color?.toLowerCase()) {
      case "red": return "bg-red-500/10 border-red-500/20";
      case "green": return "bg-emerald-500/10 border-emerald-500/20";
      case "violet": return "bg-purple-500/10 border-purple-500/20";
      default: return "bg-white/5 border-white/10";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-black tracking-widest text-base uppercase">Bet History</h1>
        <RefreshCw
          className={`w-5 h-5 text-[#ffa502] cursor-pointer ${loading ? "animate-spin" : ""}`}
          onClick={fetchBets}
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

      {/* Summary bar */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0 border-b border-white/5">
        <span>{records.length} bet{records.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-4">
          <span>
            Bet: <span className="text-[#ffa502]">Rs {totalBet.toLocaleString()}</span>
          </span>
          <span>
            Payout: <span className="text-emerald-400">Rs {totalPayout.toLocaleString()}</span>
          </span>
        </div>
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
            <p className="text-sm">No bets found</p>
          </div>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#161618] border border-white/5 rounded-2xl p-4 shadow-lg space-y-3"
            >
              {/* Row 1: Date + Period + Win/Loss indicator */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#ffa502]/10 flex items-center justify-center flex-shrink-0 border border-[#ffa502]/20">
                    <Target className="w-4.5 h-4.5 text-[#ffa502]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="text-blue-400 font-bold text-[12px] tracking-tight">
                      {new Date(rec.created_at).toLocaleString()}
                    </span>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      Period: {rec.period}
                      <button
                        onClick={() => handleCopy(rec.period, `period-${rec.id}`)}
                        className="ml-1 inline align-middle hover:text-white transition-colors"
                      >
                        {copiedField === `period-${rec.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400 inline" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 hover:text-white inline" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Win/Loss badge */}
                {rec.payout !== null && rec.payout > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase">
                    Won
                  </span>
                )}
              </div>

              {/* Row 2: Bet Selection + Amount */}
              <div className="flex items-center justify-between bg-[#0A0A0B]/50 rounded-xl px-3 py-2.5 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Selection</span>
                  <span className="text-white font-bold text-sm leading-tight">
                    {renderSelection(rec)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Bet Amount</span>
                  <div className="font-black text-base text-[#ffa502] leading-tight">
                    -Rs {rec.amount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Row 3: Result / Game Outcome */}
              {rec.result_number !== null && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${getBgColorClass(rec.result_color)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Result</span>
                    <span className={`font-black text-lg ${getResultColorClass(rec.result_color)}`}>
                      {rec.result_number}
                    </span>
                    <span className={`text-[11px] font-bold ${getResultColorClass(rec.result_color)}`}>
                      {rec.result_size?.toUpperCase()}
                    </span>
                  </div>
                  {rec.payout !== null && rec.payout > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Payout</span>
                      <div className="font-black text-sm text-emerald-400 leading-tight">
                        +Rs {rec.payout.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">— end —</div>
      </div>
    </div>
  );
}