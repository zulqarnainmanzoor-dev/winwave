import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, RotateCcw, DollarSign, Gamepad2, Shield, Bell } from "lucide-react";
import { adminSupabase } from "../../lib/adminSupabase";

const DEFAULTS = {
  platformName: "WinClub",
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
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-orange-500" : "bg-[#2a2a2a]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
    />
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
    />
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-5">
      <h3 className="text-white font-bold text-sm mb-5 flex items-center gap-2 uppercase tracking-wider">
        <span className="text-orange-500">{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-gray-200 text-sm font-medium">{label}</p>
        {desc && <p className="text-gray-500 text-xs mt-0.5">{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function Settings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof DEFAULTS>) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    const load = async () => {
      const { data, error: e } = await (adminSupabase as any)
        .from("platform_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (!e && data) {
        const settingsData = (data as any) ?? {};
        set({
          platformName: settingsData.platform_name ?? DEFAULTS.platformName,
          maintenanceMode: Boolean(settingsData.maintenance_mode ?? DEFAULTS.maintenanceMode),
          minWithdrawal: Number(settingsData.min_withdrawal ?? DEFAULTS.minWithdrawal),
          maxWithdrawal: Number(settingsData.max_withdrawal ?? DEFAULTS.maxWithdrawal),
          withdrawalFee: Number(settingsData.withdrawal_fee ?? DEFAULTS.withdrawalFee),
          depositBonus: Number(settingsData.deposit_bonus ?? DEFAULTS.depositBonus),
          referralCommission: Number(settingsData.referral_commission ?? DEFAULTS.referralCommission),
          maxBetPerRound: Number(settingsData.max_bet_per_round ?? DEFAULTS.maxBetPerRound),
          minBetPerRound: Number(settingsData.min_bet_per_round ?? DEFAULTS.minBetPerRound),
          platformMarginTarget: Number(settingsData.platform_margin_target ?? DEFAULTS.platformMarginTarget),
          gameControlEnabled: Boolean(settingsData.game_control_enabled ?? DEFAULTS.gameControlEnabled),
          smartRiskDefault: Boolean(settingsData.smart_risk_default ?? DEFAULTS.smartRiskDefault),
          notificationsEnabled: Boolean(settingsData.notifications_enabled ?? DEFAULTS.notificationsEnabled),
          autoApproveDeposit: Boolean(settingsData.auto_approve_deposit ?? DEFAULTS.autoApproveDeposit),
        });
      }
      setLoading(false);
    };
    void load();
  }, []);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const { error: e } = await (adminSupabase as any).from("platform_settings").upsert(
        {
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
        },
        { onConflict: "id" }
      );
      if (e) throw e;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#141414] min-h-screen">
        <div className="text-gray-400 text-sm">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#141414] min-h-screen">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-orange-500" /> Platform Settings
            </h1>
            <p className="text-gray-500 text-sm mt-1">Configure platform-wide settings and policies</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setSettings(DEFAULTS)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 rounded-lg hover:border-[#444] hover:text-white text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-60 shadow-lg shadow-orange-500/20"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* General */}
          <Card title="General" icon={<SettingsIcon className="w-4 h-4" />}>
            <Field label="Platform Name">
              <TextInput value={settings.platformName} onChange={(v) => set({ platformName: v })} />
            </Field>
            <Field label="Deposit Bonus (%)">
              <NumberInput value={settings.depositBonus} onChange={(v) => set({ depositBonus: v })} step={0.5} />
            </Field>
            <Field label="Referral Commission (%)">
              <NumberInput value={settings.referralCommission} onChange={(v) => set({ referralCommission: v })} step={0.5} />
            </Field>
            <ToggleRow
              label="Maintenance Mode"
              desc="Blocks all users from accessing the platform"
              checked={settings.maintenanceMode}
              onChange={(v) => set({ maintenanceMode: v })}
            />
          </Card>

          {/* Financial */}
          <Card title="Financial" icon={<DollarSign className="w-4 h-4" />}>
            <Field label="Min Withdrawal (Rs)">
              <NumberInput value={settings.minWithdrawal} onChange={(v) => set({ minWithdrawal: v })} />
            </Field>
            <Field label="Max Withdrawal (Rs)">
              <NumberInput value={settings.maxWithdrawal} onChange={(v) => set({ maxWithdrawal: v })} />
            </Field>
            <Field label="Withdrawal Fee (%)">
              <NumberInput value={settings.withdrawalFee} onChange={(v) => set({ withdrawalFee: v })} step={0.1} />
            </Field>
            <ToggleRow
              label="Auto-approve Deposits"
              desc="Automatically approve incoming deposits"
              checked={settings.autoApproveDeposit}
              onChange={(v) => set({ autoApproveDeposit: v })}
            />
          </Card>

          {/* Game */}
          <Card title="Game Settings" icon={<Gamepad2 className="w-4 h-4" />}>
            <Field label="Min Bet Per Round (Rs)">
              <NumberInput value={settings.minBetPerRound} onChange={(v) => set({ minBetPerRound: v })} />
            </Field>
            <Field label="Max Bet Per Round (Rs)">
              <NumberInput value={settings.maxBetPerRound} onChange={(v) => set({ maxBetPerRound: v })} />
            </Field>
            <Field label="Platform Margin Target (%)">
              <NumberInput value={settings.platformMarginTarget} onChange={(v) => set({ platformMarginTarget: v })} step={0.1} />
            </Field>
            <ToggleRow
              label="Game Controller"
              desc="Enable admin game outcome control"
              checked={settings.gameControlEnabled}
              onChange={(v) => set({ gameControlEnabled: v })}
            />
            <ToggleRow
              label="Smart Risk (default on)"
              desc="Enable smart risk management by default"
              checked={settings.smartRiskDefault}
              onChange={(v) => set({ smartRiskDefault: v })}
            />
          </Card>

          {/* Security & Notifications */}
          <Card title="Security & Notifications" icon={<Shield className="w-4 h-4" />}>
            <ToggleRow
              label="Push Notifications"
              desc="Send push notifications to users"
              checked={settings.notificationsEnabled}
              onChange={(v) => set({ notificationsEnabled: v })}
            />
            <div className="pt-2 border-t border-[#2a2a2a]">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Current Values Summary
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Platform", settings.platformName],
                  ["Deposit Bonus", `${settings.depositBonus}%`],
                  ["Referral", `${settings.referralCommission}%`],
                  ["Withdrawal Fee", `${settings.withdrawalFee}%`],
                  ["Min Bet", `Rs ${settings.minBetPerRound.toLocaleString()}`],
                  ["Max Bet", `Rs ${settings.maxBetPerRound.toLocaleString()}`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                    <p className="text-gray-500">{k}</p>
                    <p className="text-orange-400 font-semibold truncate">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-orange-500 text-white px-5 py-3 rounded-xl shadow-xl shadow-orange-500/30 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          ✓ Settings saved successfully
        </div>
      )}
    </div>
  );
}
