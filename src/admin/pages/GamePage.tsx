import { useEffect, useState } from "react";
import { useAdmin } from "../context/AdminContext";
import { GameController } from "../components/GameController";
import { supabase } from "../../lib/supabaseClient";

interface RecentRound {
  id: string;
  started_at?: string | null;
  ends_at?: string | null;
  result_size?: string | null;
  forced_outcome?: string | null;
  manual_result?: string | null;
  total_big?: number | null;
  total_small?: number | null;
  status?: string | null;
}

interface GamePageProps {
  gameType: "wingo" | "k3" | "trx" | "5d";
  gameTitle: string;
  gameDescription: string;
}

export function GamePage({ gameType, gameTitle, gameDescription }: GamePageProps) {
  const { gameSettings } = useAdmin();
  const settings = gameSettings[gameType];
  const [activeRound, setActiveRound] = useState<RecentRound | null>(null);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [roundError, setRoundError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentRounds = async () => {
      setLoadingRounds(true);
      setRoundError(null);

      try {
        const tableName = "game_records";
        const [{ data: activeData, error: activeError }, { data: recentData, error: recentError }] = await Promise.all([
          supabase
            .from(tableName)
            .select("id,started_at,ends_at,result_size,forced_outcome,manual_result,total_big,total_small,status")
            .eq("game_type", gameType)
            .eq("status", "active")
            .order("started_at", { ascending: false })
            .limit(1),
          supabase
            .from(tableName)
            .select("id,started_at,ends_at,result_size,forced_outcome,manual_result,total_big,total_small,status")
            .eq("game_type", gameType)
            .neq("status", "active")
            .order("started_at", { ascending: false })
            .limit(6),
        ]);

        if (activeError) {
          console.warn("Failed to load active round", activeError);
        } else {
          setActiveRound(activeData?.[0] ?? null);
        }

        if (recentError) {
          console.warn("Failed to load recent rounds", recentError);
          setRoundError("Unable to load recent round history.");
        } else {
          setRecentRounds(recentData || []);
        }
      } catch (err: any) {
        console.error(err);
        setRoundError("Unable to load recent round history.");
      } finally {
        setLoadingRounds(false);
      }
    };

    fetchRecentRounds();

    const channel = supabase
      .channel(`game-records-${gameType}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_records",
          filter: `game_type=eq.${gameType}`,
        },
        (payload) => {
          if (payload.new) {
            setRecentRounds((prev) => [payload.new as RecentRound, ...prev].slice(0, 6));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_records",
          filter: `game_type=eq.${gameType}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as RecentRound;
            setRecentRounds((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 6));
            setActiveRound((prev) => {
              if (updated.status === "active") {
                return updated;
              }
              if (prev?.id === updated.id) {
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameType]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{gameTitle}</h1>
          <p className="text-gray-400">{gameDescription}</p>
        </div>

        {/* Game Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {Object.entries(settings.modes).map(([mode, modeSettings]) => (
            <div
              key={mode}
              className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-lg p-4 border border-[#0f3460]"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold">{mode} Mode</h3>
                <div
                  className={`w-3 h-3 rounded-full ${
                    modeSettings.enabled ? "bg-[#4ade80]" : "bg-[#ef4444]"
                  }`}
                />
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">
                  Big Limit: <span className="text-[#fbbf24]">Rs {modeSettings.bigBetLimit.toLocaleString()}</span>
                </p>
                <p className="text-gray-400">
                  Small Limit: <span className="text-[#3b82f6]">Rs {modeSettings.smallBetLimit.toLocaleString()}</span>
                </p>
                <p className="text-gray-400">
                  Smart Risk: <span className={modeSettings.smartRiskEnabled ? "text-[#4ade80]" : "text-[#ef4444]"}>
                    {modeSettings.smartRiskEnabled ? "Enabled" : "Disabled"}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Game Controller */}
        <GameController gameType={gameType} />

        {/* Active Round Status */}
        {activeRound && (
          <div className="mb-8 bg-gradient-to-br from-[#0b1320] to-[#10182d] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-2">Active Round</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#111827] rounded-xl p-4">
                <p className="text-gray-400 text-sm">Round ID</p>
                <p className="text-white font-semibold">{activeRound.id}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-4">
                <p className="text-gray-400 text-sm">Status</p>
                <p className="text-white font-semibold capitalize">{activeRound.status || 'Active'}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-4">
                <p className="text-gray-400 text-sm">Result Target</p>
                <p className={`font-semibold ${activeRound.forced_outcome === 'BIG' || activeRound.manual_result === 'BIG' ? 'text-[#3b82f6]' : activeRound.forced_outcome === 'SMALL' || activeRound.manual_result === 'SMALL' ? 'text-[#4ade80]' : 'text-gray-100'}`}>
                  {activeRound.forced_outcome || activeRound.manual_result || 'Pending manual override'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Game History Table */}
        <div className="mt-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">Recent Rounds</h3>
              <p className="text-gray-400 text-sm">Latest completed {gameTitle} rounds from Supabase.</p>
            </div>
            {roundError && <span className="text-amber-400 text-sm">{roundError}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0f3460]">
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Round ID</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Result</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Big Total</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Small Total</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingRounds ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-6">Loading recent rounds...</td>
                  </tr>
                ) : recentRounds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-6">No round history available.</td>
                  </tr>
                ) : (
                  recentRounds.map((row) => {
                    const resultColor = row.result_size === 'BIG' ? 'text-[#3b82f6]' : 'text-[#4ade80]';
                    return (
                      <tr key={row.id} className="border-b border-[#0f3460] hover:bg-[#0f3460] transition-colors">
                        <td className="text-white py-3 px-4">{row.id}</td>
                        <td className={`py-3 px-4 text-sm font-semibold ${resultColor}`}>
                          {row.result_size || row.forced_outcome || row.manual_result || 'Pending'}
                        </td>
                        <td className="text-[#fbbf24] py-3 px-4">Rs {Number(row.total_big || 0).toLocaleString()}</td>
                        <td className="text-[#38bdf8] py-3 px-4">Rs {Number(row.total_small || 0).toLocaleString()}</td>
                        <td className="text-gray-300 py-3 px-4">{row.status || 'completed'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
