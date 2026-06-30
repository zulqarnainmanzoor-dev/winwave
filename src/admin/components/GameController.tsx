import React, { useState } from "react";
import { useAdmin } from "../context/AdminContext";
import { AlertCircle, Save, RotateCcw } from "lucide-react";

interface GameControllerProps {
  gameType: "wingo" | "k3" | "trx" | "5d";
}

export function GameController({ gameType }: GameControllerProps) {
  const { gameSettings, updateGameMode, enableSmartRisk } = useAdmin();
  const settings = gameSettings[gameType];
  const [selectedMode, setSelectedMode] = useState<"30s" | "1m" | "3m" | "5m">("30s");
  const [changesSaved, setChangesSaved] = useState(false);

  const currentModeSettings = settings.modes[selectedMode];

  const handleToggleSmartRisk = () => {
    enableSmartRisk(gameType, selectedMode, !currentModeSettings.smartRiskEnabled);
    setChangesSaved(false);
  };

  const handleValueChange = (field: keyof typeof currentModeSettings, value: string | number | boolean) => {
    updateGameMode(gameType, selectedMode, { [field]: value });
    setChangesSaved(false);
  };

  const handleSave = () => {
    setChangesSaved(true);
    setTimeout(() => setChangesSaved(false), 2000);
  };

  const modes = ["30s", "1m", "3m", "5m"] as const;

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          {gameType.toUpperCase()} Game Controller
        </h2>
        <p className="text-gray-400">Configure game settings and smart risk management</p>
      </div>

      {/* Mode Selector */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Select Game Mode</h3>
        <div className="grid grid-cols-4 gap-3">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`py-3 px-4 rounded-lg font-bold transition-all duration-200 ${
                selectedMode === mode
                  ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white shadow-lg shadow-red-500/30"
                  : "bg-[#0f3460] text-gray-300 hover:bg-[#1a3a52] border border-[#1a5f7a]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Risk Management Section */}
      <div className="mb-8 bg-[#0f3460] rounded-lg p-6 border border-[#1a5f7a]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🤖</span>
            </div>
            <div>
              <h4 className="text-white font-bold text-lg">Smart Risk Management AI</h4>
              <p className="text-gray-400 text-sm">
                Automatically balance payouts when bet disparities occur
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleSmartRisk}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              currentModeSettings.smartRiskEnabled
                ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b]"
                : "bg-[#1a3a52] border border-[#1a5f7a]"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                currentModeSettings.smartRiskEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {currentModeSettings.smartRiskEnabled && (
          <div className="bg-[#1a1a2e] rounded-lg p-4 border-l-4 border-[#e94560]">
            <div className="flex gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-[#e94560] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#e94560] font-bold text-sm mb-2">How It Works:</p>
                <ul className="text-gray-300 text-xs space-y-1">
                  <li>
                    • If Big bets exceed Rs{currentModeSettings.bigBetLimit.toLocaleString()} AND
                  </li>
                  <li>
                    • Small bets are below Rs{currentModeSettings.smallBetLimit.toLocaleString()}
                  </li>
                  <li>
                    • System automatically triggers a Small win to balance payouts
                  </li>
                  <li className="text-[#ffc107] font-bold">
                    • This protects platform margin while ensuring fair gameplay
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bet Limits Configuration */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Big Bet Limit */}
        <div className="bg-[#0f3460] rounded-lg p-6 border border-[#1a5f7a]">
          <label className="block text-white font-semibold mb-3">Big Bet Limit (Rs)</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">Rs</span>
            <input
              type="number"
              value={currentModeSettings.bigBetLimit}
              onChange={(e) => handleValueChange("bigBetLimit", parseInt(e.target.value) || 0)}
              className="w-full bg-[#1a1a2e] border border-[#1a5f7a] rounded-lg px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] focus:ring-2 focus:ring-[#e94560]/20 transition-all"
              placeholder="100000"
            />
          </div>
          <p className="text-gray-400 text-xs mt-2">
            Maximum total bet allowed on Big outcome
          </p>
        </div>

        {/* Small Bet Limit */}
        <div className="bg-[#0f3460] rounded-lg p-6 border border-[#1a5f7a]">
          <label className="block text-white font-semibold mb-3">Small Bet Limit (Rs)</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">Rs</span>
            <input
              type="number"
              value={currentModeSettings.smallBetLimit}
              onChange={(e) => handleValueChange("smallBetLimit", parseInt(e.target.value) || 0)}
              className="w-full bg-[#1a1a2e] border border-[#1a5f7a] rounded-lg px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] focus:ring-2 focus:ring-[#e94560]/20 transition-all"
              placeholder="5000"
            />
          </div>
          <p className="text-gray-400 text-xs mt-2">
            Minimum threshold for Small bets before auto-win trigger
          </p>
        </div>
      </div>

      {/* Payout Settings */}
      <div className="mb-8">
        <h4 className="text-white font-semibold mb-4">Payout Configuration</h4>
        <div className="bg-[#0f3460] rounded-lg p-6 border border-[#1a5f7a]">
          <label className="block text-white font-semibold mb-3">Payout Multiplier</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={currentModeSettings.payoutMultiplier}
              onChange={(e) => handleValueChange("payoutMultiplier", parseFloat(e.target.value) || 1.95)}
              step="0.01"
              min="1"
              max="5"
              className="flex-1 bg-[#1a1a2e] border border-[#1a5f7a] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] focus:ring-2 focus:ring-[#e94560]/20 transition-all"
            />
            <div className="text-right">
              <p className="text-white font-bold text-lg">
                ×{currentModeSettings.payoutMultiplier.toFixed(2)}
              </p>
              <p className="text-gray-400 text-xs">
                Win = Bet × {currentModeSettings.payoutMultiplier.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-[#1a5f7a]">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              currentModeSettings.enabled ? "bg-[#4ade80]" : "bg-[#ef4444]"
            }`}
          />
          <span className="text-gray-400 text-sm">
            {currentModeSettings.enabled ? "Game Mode Active" : "Game Mode Inactive"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {changesSaved && (
            <span className="text-[#4ade80] text-sm font-medium flex items-center gap-1">
              ✓ Changes saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all duration-200 font-medium"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-gray-300 hover:bg-[#1a3a52] rounded-lg transition-all duration-200 border border-[#1a5f7a] font-medium">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <p className="text-gray-500 text-xs mt-4 text-center">
        Last updated: {new Date(currentModeSettings.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}
