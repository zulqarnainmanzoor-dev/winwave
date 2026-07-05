import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../context/AdminContext";
import { GameController } from "../components/GameController";
import { adminSupabase } from "../../lib/adminSupabase";
import { RefreshCw } from "lucide-react";

interface Round {
  id: string;
  period: string;
  mode: string;
  started_at: string | null;
  ends_at: string | null;
  result_number: number | null;
  result_size: string | null;
  result_color: string | null;
  target_result: string | null;
  total_big: number;
  total_small: number;
  status: string;
}

interface GamePageProps {
  gameType: "wingo" | "k3" | "trx" | "5d";
  gameTitle: string;
  gameDescription: string;
}

// Color dot for result_color
function ColorDot({ color }: { color: string | null }) {
  const bg =
    color === "red"    ? "#ff4757" :
    color === "green"  ? "#2ed573" :
    color === "violet" ? "#9c27b0" : "#6b7280";
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-white/20"
      style={{ background: bg }}
    />
  );
}

export function GamePage({ gameType, gameTitle, gameDescription }: GamePageProps) {
  const { gameSettings } = useAdmin();
  const settings = gameSettings[gameType];

  const [recentRounds, setRecentRounds] = useState<Round[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const fetchRounds = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await adminSupabase
        .from("game_rounds")
        .select("id,period,mode,started_at,ends_at,result_number,result_size,result_color,target_result,total_big,total_small,status")
        .eq("game_type", gameType)
        .order("ends_at", { ascending: false })
        .limit(100);
      if (e) throw e;
      setRecentRounds(data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load rounds.");
    } finally {
      setLoading(false);
    }
  }, [gameType]);

  useEffect(() => {
    void fetchRounds();

    const channel = adminSupabase
      .channel(`gamepage-rounds-${gameType}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "game_rounds", filter: `game_type=eq.${gameType}` },
        () => void fetchRounds()
      )
      .subscribe();

    return () => { void adminSupabase.removeChannel(channel); };
  }, [gameType, fetchRounds]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{gameTitle}</h1>
          <p className="text-gray-400">{gameDescription}</p>
        </div>

        {/* Mode overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {Object.entries(settings.modes).map(([mode, ms]) => (
            <div key={mode} className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-lg p-4 border border-[#0f3460]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold">{mode} Mode</h3>
                <div className={`w-3 h-3 rounded-full ${ms.enabled ? "bg-[#4ade80]" : "bg-[#ef4444]"}`} />
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="text-gray-400">Big Limit: <span className="text-[#fba846]">Rs {ms.bigBetLimit.toLocaleString()}</span></p>
                <p className="text-gray-400">Small Limit: <span className="text-[#5c9df5]">Rs {ms.smallBetLimit.toLocaleString()}</span></p>
                <p className="text-gray-400">Smart Risk: <span className={ms.smartRiskEnabled ? "text-[#4ade80]" : "text-[#ef4444]"}>{ms.smartRiskEnabled ? "ON" : "OFF"}</span></p>
              </div>
            </div>
          ))}
        </div>

        {/* Game Controller (force outcome + live round) */}
        <GameController gameType={gameType} />

        {/* Recent Rounds Table */}
        <div className="mt-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">Recent Rounds</h3>
              <p className="text-gray-400 text-sm">Last 10 rounds from <code className="text-amber-300">game_rounds</code> table</p>
            </div>
            <button onClick={fetchRounds} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0f3460] text-gray-400 text-xs uppercase">
                  <th className="text-left py-3 px-3">Period</th>
                  <th className="text-left py-3 px-3">Mode</th>
                  <th className="text-left py-3 px-3">Result</th>
                  <th className="text-left py-3 px-3">Color</th>
                  <th className="text-left py-3 px-3">Forced</th>
                  <th className="text-right py-3 px-3">Big Rs</th>
                  <th className="text-right py-3 px-3">Small Rs</th>
                  <th className="text-left py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-8">Loading…</td></tr>
                ) : recentRounds.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-8">
                    No rounds yet. Rounds are created automatically when users play.
                  </td></tr>
                ) : recentRounds.map((row) => (
                  <tr key={row.id} className="border-b border-[#0f3460]/60 hover:bg-[#0f3460]/40 transition-colors">
                    <td className="py-3 px-3 text-white font-mono text-xs">{row.period}</td>
                    <td className="py-3 px-3 text-gray-300">{row.mode}</td>
                    <td className="py-3 px-3">
                      {row.result_number != null ? (
                        <span className={`font-black ${row.result_size === "Big" ? "text-[#fba846]" : "text-[#5c9df5]"}`}>
                          {row.result_number} · {row.result_size}
                        </span>
                      ) : (
                        <span className="text-gray-600">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <ColorDot color={row.result_color} />
                        <span className="text-gray-400 text-xs capitalize">{row.result_color ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {row.target_result ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          row.target_result === "BIG"
                            ? "bg-[#fba846]/20 text-[#fba846]"
                            : "bg-[#5c9df5]/20 text-[#5c9df5]"
                        }`}>{row.target_result}</span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right text-[#fba846] font-bold">
                      {Number(row.total_big).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-[#5c9df5] font-bold">
                      {Number(row.total_small).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
