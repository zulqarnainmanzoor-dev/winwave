import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw, Gamepad2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface GameRound {
  id: string;
  period: string;
  game_type: string;
  mode: string;
  result_number: number | null;
  result_size: string | null;
  result_color: string | null;
  total_big: number;
  total_small: number;
  status: string;
  started_at: string;
  ends_at: string;
  created_at: string;
}

const modeLabels: Record<string, string> = {
  "30s": "30s",
  "1m": "1 Min",
  "3m": "3 Min",
  "5m": "5 Min",
};

export default function GameHistoryView({ onBack }: { onBack: () => void }) {
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [records, setRecords] = useState<GameRound[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("game_rounds")
        .select("id, period, game_type, mode, result_number, result_size, result_color, total_big, total_small, status, started_at, ends_at, created_at")
        .eq("game_type", "wingo")
        .order("created_at", { ascending: false })
        .limit(200);

      if (modeFilter !== "all") {
        query = query.eq("mode", modeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (e) {
      console.error("fetchRounds error:", e);
    } finally {
      setLoading(false);
    }
  }, [modeFilter]);

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

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

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const modes = ["all", "30s", "1m", "3m", "5m"];

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-black tracking-widest text-base uppercase">Game History</h1>
        <RefreshCw
          className={`w-5 h-5 text-[#ffa502] cursor-pointer ${loading ? "animate-spin" : ""}`}
          onClick={fetchRounds}
        />
      </div>

      {/* Mode filter chips */}
      <div className="flex gap-1.5 px-4 py-3 bg-[#0A0A0B] border-b border-white/5 overflow-x-auto flex-shrink-0">
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => setModeFilter(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
              modeFilter === mode
                ? "bg-[#ffa502] text-black border-[#ffa502]"
                : "bg-[#161618] text-gray-400 border-white/10 hover:border-white/20"
            }`}
          >
            {mode === "all" ? "All Modes" : modeLabels[mode] || mode}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0 border-b border-white/5">
        <span>{records.length} round{records.length !== 1 ? "s" : ""}</span>
        <span>{records.filter((r) => r.status === "completed").length} completed</span>
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
            <p className="text-sm">No rounds found</p>
          </div>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#161618] border border-white/5 rounded-2xl p-4 shadow-lg space-y-3"
            >
              {/* Row 1: Period + Mode + Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#ffa502]/10 flex items-center justify-center flex-shrink-0 border border-[#ffa502]/20">
                    <Gamepad2 className="w-4.5 h-4.5 text-[#ffa502]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-[12px] tracking-tight font-mono">
                        {rec.period}
                      </span>
                      <button
                        onClick={() => handleCopy(rec.period, `period-${rec.id}`)}
                        className="hover:text-white transition-colors"
                      >
                        {copiedField === `period-${rec.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(rec.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-[10px] font-bold">
                    {modeLabels[rec.mode] || rec.mode}
                  </span>
                  {rec.status === "completed" ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Completed
                    </span>
                  ) : rec.status === "active" ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 text-[10px] font-bold">
                      {rec.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Result output */}
              {rec.result_number !== null && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${getBgColorClass(rec.result_color)}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Result</span>
                    <span className={`font-black text-2xl ${getResultColorClass(rec.result_color)}`}>
                      {rec.result_number}
                    </span>
                    <div className="flex flex-col">
                      <span className={`font-bold text-sm ${getResultColorClass(rec.result_color)}`}>
                        {rec.result_size?.toUpperCase()}
                      </span>
                      <span className={`text-[10px] font-semibold ${getResultColorClass(rec.result_color)}`}>
                        {rec.result_color?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[11px]">
                    <div className="text-gray-400">
                      Big: <span className="text-white font-bold">Rs {rec.total_big.toLocaleString()}</span>
                    </div>
                    <div className="text-gray-400">
                      Small: <span className="text-white font-bold">Rs {rec.total_small.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Time range */}
              <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                <span>Start: {new Date(rec.started_at).toLocaleString()}</span>
                <span>End: {new Date(rec.ends_at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">— end —</div>
      </div>
    </div>
  );
}