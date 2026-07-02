import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export function Settings() {
  const [settings, setSettings] = useState({
    platformName: "WinWave",
    maintenanceMode: false,
    minWithdrawal: 1000,
    maxWithdrawal: 500000,
    withdrawalFee: 2.5,
    depositBonus: 50,
    referralCommission: 10,
    maxBetPerRound: 500000,
    minBetPerRound: 100,
    platformMarginTarget: 8.5,
    gameControlEnabled: true,
    smartRiskDefault: false,
    notificationsEnabled: true,
    autoApproveDeposit: false,
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("platform_settings")
          .select("*")
          .maybeSingle();

        if (fetchError) {
          console.warn("Platform settings fetch failed", fetchError);
          setLoading(false);
          return;
        }

        if (data) {
          setSettings({
            platformName: data.platform_name || "WinWave",
            maintenanceMode: Boolean(data.maintenance_mode ?? false),
            minWithdrawal: Number(data.min_withdrawal ?? 1000),
            maxWithdrawal: Number(data.max_withdrawal ?? 500000),
            withdrawalFee: Number(data.withdrawal_fee ?? 2.5),
            depositBonus: Number(data.deposit_bonus ?? 50),
            referralCommission: Number(data.referral_commission ?? 10),
            maxBetPerRound: Number(data.max_bet_per_round ?? 500000),
            minBetPerRound: Number(data.min_bet_per_round ?? 100),
            platformMarginTarget: Number(data.platform_margin_target ?? 8.5),
            gameControlEnabled: Boolean(data.game_control_enabled ?? true),
            smartRiskDefault: Boolean(data.smart_risk_default ?? false),
            notificationsEnabled: Boolean(data.notifications_enabled ?? true),
            autoApproveDeposit: Boolean(data.auto_approve_deposit ?? false),
          });
        }
      } catch (err: any) {
        console.warn("Platform settings load error", err);
        setError(err?.message || "Unable to load platform settings.");
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    setError(null);
    try {
      const payload = {
        id: "default",
        platform_name: settings.platformName,
        maintenance_mode: settings.maintenanceMode,
        min_withdrawal: settings.minWithdrawal,
        max_withdrawal: settings.maxWithdrawal,
        withdrawal_fee: settings.withdrawalFee,
        deposit_bonus: settings.depositBonus,
        referral_commission: settings.referralCommission,
        max_bet_per_round: settings.maxBetPerRound,
        min_bet_per_round: settings.minBetPerRound,
        platform_margin_target: settings.platformMarginTarget,
        game_control_enabled: settings.gameControlEnabled,
        smart_risk_default: settings.smartRiskDefault,
        notifications_enabled: settings.notificationsEnabled,
        auto_approve_deposit: settings.autoApproveDeposit,
      };

      const { error: upsertError } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
      if (upsertError) throw upsertError;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Platform settings save failed", err);
      setError(err?.message || "Unable to save platform settings.");
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Platform Settings</h1>
          <p className="text-gray-400">Configure platform-wide settings and policies</p>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <div className="grid grid-cols-2 gap-8">
          {/* General Settings */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" /> General Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Platform Name</label>
                <input
                  type="text"
                  value={settings.platformName}
                  onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-gray-300">Maintenance Mode (Block all users)</span>
                </label>
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Deposit Bonus (%)</label>
                <input
                  type="number"
                  value={settings.depositBonus}
                  onChange={(e) => setSettings({ ...settings, depositBonus: parseFloat(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Referral Commission (%)</label>
                <input
                  type="number"
                  value={settings.referralCommission}
                  onChange={(e) => setSettings({ ...settings, referralCommission: parseFloat(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6">Financial Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Min Withdrawal (Rs)</label>
                <input
                  type="number"
                  value={settings.minWithdrawal}
                  onChange={(e) => setSettings({ ...settings, minWithdrawal: parseInt(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Max Withdrawal (Rs)</label>
                <input
                  type="number"
                  value={settings.maxWithdrawal}
                  onChange={(e) => setSettings({ ...settings, maxWithdrawal: parseInt(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Withdrawal Fee (%)</label>
                <input
                  type="number"
                  value={settings.withdrawalFee}
                  onChange={(e) => setSettings({ ...settings, withdrawalFee: parseFloat(e.target.value) })}
                  step="0.1"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoApproveDeposit}
                    onChange={(e) => setSettings({ ...settings, autoApproveDeposit: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-gray-300">Auto-approve deposits</span>
                </label>
              </div>
            </div>
          </div>

          {/* Game Settings */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6">Game Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Min Bet Per Round (Rs)</label>
                <input
                  type="number"
                  value={settings.minBetPerRound}
                  onChange={(e) => setSettings({ ...settings, minBetPerRound: parseInt(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Max Bet Per Round (Rs)</label>
                <input
                  type="number"
                  value={settings.maxBetPerRound}
                  onChange={(e) => setSettings({ ...settings, maxBetPerRound: parseInt(e.target.value) })}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Platform Margin Target (%)</label>
                <input
                  type="number"
                  value={settings.platformMarginTarget}
                  onChange={(e) => setSettings({ ...settings, platformMarginTarget: parseFloat(e.target.value) })}
                  step="0.1"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.gameControlEnabled}
                    onChange={(e) => setSettings({ ...settings, gameControlEnabled: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-gray-300">Enable Game Controller</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.smartRiskDefault}
                    onChange={(e) => setSettings({ ...settings, smartRiskDefault: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-gray-300">Enable Smart Risk by default</span>
                </label>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h3 className="text-white font-bold text-lg mb-6">Security Settings</h3>

            <div className="space-y-4">

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled}
                    onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-gray-300">Enable push notifications</span>
                </label>
              </div>

              <div className="bg-[#0f3460] rounded-lg p-4 mt-6">
                <p className="text-gray-400 text-sm mb-2">API Key</p>
                <p className="text-gray-300 font-mono text-xs break-all bg-[#1a1a2e] px-3 py-2 rounded">
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end gap-4">
          <button className="px-6 py-3 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all font-medium">
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-medium disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {loading ? "Loading..." : "Save Settings"}
          </button>
        </div>

        {saved && (
          <div className="fixed bottom-8 right-8 bg-[#4ade80] text-white px-6 py-3 rounded-lg shadow-lg">
            ✓ Settings saved successfully
          </div>
        )}
      </div>
    </div>
  );
}
