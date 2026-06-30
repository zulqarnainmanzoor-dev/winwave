import React from "react";
import { useAdmin } from "../context/AdminContext";
import { GameController } from "../components/GameController";

interface GamePageProps {
  gameType: "wingo" | "k3" | "trx" | "5d";
  gameTitle: string;
  gameDescription: string;
}

export function GamePage({ gameType, gameTitle, gameDescription }: GamePageProps) {
  const { gameSettings } = useAdmin();
  const settings = gameSettings[gameType];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{gameTitle}</h1>
          <p className="text-gray-400">{gameDescription}</p>
        </div>

        {/* Game Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-8">
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

        {/* Additional Game Management Features */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          {/* Win/Loss Statistics */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6">Win/Loss Statistics (24h)</h3>
            <div className="space-y-4">
              {[
                { label: "Total Bets Placed", value: 45234, color: "from-[#3b82f6]" },
                { label: "Big Wins", value: 21456, color: "from-[#4ade80]" },
                { label: "Small Wins", value: 23778, color: "from-[#3b82f6]" },
                { label: "Platform Margin", value: "8.2%", color: "from-[#fbbf24]" },
              ].map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-[#0f3460] rounded-lg">
                  <span className="text-gray-400">{stat.label}</span>
                  <span className="text-white font-bold">{stat.value.toLocaleString?.() || stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full py-3 px-4 bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-medium">
                View Game Logs
              </button>
              <button className="w-full py-3 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium">
                Export Statistics
              </button>
              <button className="w-full py-3 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium">
                Ban/Suspend Players
              </button>
              <button className="w-full py-3 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium">
                Manage Prize Pool
              </button>
            </div>
          </div>
        </div>

        {/* Game History Table */}
        <div className="mt-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <h3 className="text-white font-bold text-lg mb-6">Latest {gameTitle} Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0f3460]">
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Time</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Round ID</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Total Big Bets</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Total Small Bets</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Result</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Margin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    time: "14:23:45",
                    round: "WG#2024-001",
                    big: "Rs 125,450",
                    small: "Rs 89,230",
                    result: "Big Won",
                    margin: "+8.2%",
                  },
                  {
                    time: "14:24:15",
                    round: "WG#2024-002",
                    big: "Rs 98,500",
                    small: "Rs 156,890",
                    result: "Small Won",
                    margin: "+9.5%",
                  },
                  {
                    time: "14:24:45",
                    round: "WG#2024-003",
                    big: "Rs 234,120",
                    small: "Rs 45,600",
                    result: "Big Won",
                    margin: "-2.1%",
                  },
                  {
                    time: "14:25:15",
                    round: "WG#2024-004",
                    big: "Rs 156,750",
                    small: "Rs 198,340",
                    result: "Small Won",
                    margin: "+7.8%",
                  },
                  {
                    time: "14:25:45",
                    round: "WG#2024-005",
                    big: "Rs 89,200",
                    small: "Rs 124,560",
                    result: "Small Won",
                    margin: "+6.3%",
                  },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-[#0f3460] hover:bg-[#0f3460] transition-colors">
                    <td className="text-gray-300 py-3 px-4">{row.time}</td>
                    <td className="text-white font-medium py-3 px-4">{row.round}</td>
                    <td className="text-[#3b82f6] py-3 px-4">{row.big}</td>
                    <td className="text-[#4ade80] py-3 px-4">{row.small}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${row.result === "Big Won" ? "text-[#3b82f6]" : "text-[#4ade80]"}`}>
                        {row.result}
                      </span>
                    </td>
                    <td className={`font-bold py-3 px-4 ${row.margin.startsWith("+") ? "text-[#4ade80]" : "text-[#ef4444]"}`}>
                      {row.margin}
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
