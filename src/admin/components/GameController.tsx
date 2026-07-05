import React, { useEffect, useState, useCallback, useRef } from "react";
import { AlertCircle, RefreshCw, Play, Terminal, Send, Zap, X } from "lucide-react";
import { adminSupabase } from "../../lib/adminSupabase";

interface ActiveRound {
  id: string;
  period: string;
  mode: string;
  ends_at: string;
  status: string;
  target_result: string | null;
  total_big: number;
  total_small: number;
  big_pct: number;
  small_pct: number;
  // per-number and per-color totals (live from betting_history)
  numberTotals: Record<number, number>;
  colorTotals: { green: number; red: number; violet: number };
  totalBets: number;
  totalBetAmount: number;
}

interface GameControllerProps {
  gameType: "wingo" | "k3" | "trx" | "5d";
}

// ── Powerful Number logic ─────────────────────────────────────────
// Picks the result that maximises platform profit:
// → whichever side (Big/Small) has MORE bets loses → platform keeps more.
// Returns 'BIG' | 'SMALL' based on which side has fewer bets (that side wins).
function getPowerfulResult(totalBig: number, totalSmall: number): "BIG" | "SMALL" {
  return totalBig >= totalSmall ? "SMALL" : "BIG";
}

function getIntervalAndPrefix(mode: string) {
  switch (mode) {
    case "1m":  return { interval: 60,  prefix: "2000" };
    case "3m":  return { interval: 180, prefix: "3000" };
    case "5m":  return { interval: 300, prefix: "4000" };
    default:    return { interval: 30,  prefix: "1000" };
  }
}

function getCountdownFromEndsAt(endsAt: string | null): number {
  if (!endsAt) return 0;
  const diffMs = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

export function GameController({ gameType }: GameControllerProps) {
  const supabase = adminSupabase as any;
  const [selectedMode, setSelectedMode] = useState<"30s" | "1m" | "3m" | "5m">("30s");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMsg,     setOverrideMsg]     = useState<string | null>(null);
  const [overrideErr,     setOverrideErr]     = useState<string | null>(null);
  const [activeRound,     setActiveRound]     = useState<ActiveRound | null>(null);
  const [roundLoading,    setRoundLoading]    = useState(false);
  const [fetchErr,        setFetchErr]        = useState<string | null>(null);
  const [seeding,         setSeeding]         = useState(false);

  // ── Chat command box ──────────────────────────────────────────────
  const [chatInput,   setChatInput]   = useState("");
  const [chatLog,     setChatLog]     = useState<{ text: string; ok: boolean }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Live countdown ────────────────────────────────────────────────
  const [liveCountdown, setLiveCountdown] = useState(0);
  const [livePeriod,    setLivePeriod]    = useState("");

  // ── Fetch active round ────────────────────────────────────────────
  const fetchActiveRound = useCallback(async () => {
    setRoundLoading(true);
    setFetchErr(null);
    try {
      const { data: rpcRows, error: rpcErr } = await supabase
        .rpc("get_active_round", { p_game_type: gameType, p_mode: selectedMode });

      let row: any = rpcRows?.[0] ?? null;

      if (rpcErr || !row) {
        const { data: tableRows, error: tableErr } = await supabase
          .from("game_rounds")
          .select("id,period,mode,ends_at,status,target_result,total_big,total_small")
          .eq("game_type", gameType)
          .eq("mode", selectedMode)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1);

        if (tableErr) { setFetchErr(`Table query failed: ${tableErr.message}`); setActiveRound(null); return; }
        row = tableRows?.[0] ?? null;
      }

      if (!row) {
        setActiveRound(null);
        setLivePeriod("");
        setLiveCountdown(0);
        return;
      }

      const big   = Number(row.total_big   ?? 0);
      const small = Number(row.total_small ?? 0);
      const total = big + small;

      // Fetch per-number and per-color totals from betting_history for this period
      const { data: betRows } = await supabase
        .from("betting_history")
        .select("bet_type, bet_value, amount")
        .eq("game_type", gameType)
        .eq("period", row.period)
        .eq("status", "pending");

      const numberTotals: Record<number, number> = {};
      for (let i = 0; i <= 9; i++) numberTotals[i] = 0;
      const colorTotals = { green: 0, red: 0, violet: 0 };
      let totalBets = 0;
      let totalBetAmount = 0;

      for (const bet of betRows ?? []) {
        const amt = Number(bet.amount || 0);
        totalBets++;
        totalBetAmount += amt;
        if (bet.bet_type === "number") {
          const n = Number(bet.bet_value);
          if (n >= 0 && n <= 9) numberTotals[n] = (numberTotals[n] || 0) + amt;
        } else if (bet.bet_type === "color") {
          const c = String(bet.bet_value).toLowerCase() as keyof typeof colorTotals;
          if (c in colorTotals) colorTotals[c] += amt;
        }
      }

      setActiveRound({
        id:            row.id,
        period:        row.period,
        mode:          row.mode ?? selectedMode,
        ends_at:       row.ends_at,
        status:        row.status,
        target_result: row.target_result ?? null,
        total_big:     big,
        total_small:   small,
        big_pct:       total > 0 ? Math.round((big   / total) * 100) : 50,
        small_pct:     total > 0 ? Math.round((small / total) * 100) : 50,
        numberTotals,
        colorTotals,
        totalBets,
        totalBetAmount,
      });
      setLivePeriod(row.period ?? "");
      setLiveCountdown(getCountdownFromEndsAt(row.ends_at));
    } catch (e: any) {
      setFetchErr(e?.message ?? "Unknown error fetching round.");
      setActiveRound(null);
    } finally {
      setRoundLoading(false);
    }
  }, [gameType, selectedMode]);

  // ── Live countdown (defined after fetchActiveRound to avoid TDZ) ──────────
  useEffect(() => {
    const tick = () => {
      if (!activeRound?.ends_at) {
        setLiveCountdown(0);
        return;
      }
      const nextCountdown = getCountdownFromEndsAt(activeRound.ends_at);
      setLiveCountdown(nextCountdown);
      if (activeRound.period) setLivePeriod(activeRound.period);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [activeRound?.ends_at, activeRound?.period]);

  useEffect(() => {
    void fetchActiveRound();
    // Poll every 5s so stale rounds are caught quickly
    const interval = setInterval(() => void fetchActiveRound(), 5_000);
    const channel = supabase
      .channel(`gc-${gameType}-${selectedMode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "game_rounds", filter: `game_type=eq.${gameType}` },
        () => void fetchActiveRound()
      )
      .subscribe();
    return () => { clearInterval(interval); void supabase.removeChannel(channel); };
  }, [gameType, selectedMode, fetchActiveRound]);

  // ── Seed rounds ───────────────────────────────────────────────────
  const handleSeedRounds = async () => {
    setSeeding(true);
    setFetchErr(null);
    try {
      const { error } = await supabase.rpc("fn_tick_game_rounds");
      if (error) await seedRoundDirect();
      else await fetchActiveRound();
    } catch { await seedRoundDirect(); }
    finally { setSeeding(false); }
  };

  const seedRoundDirect = async () => {
    const { error } = await supabase.rpc("fn_tick_game_rounds");
    if (error) setFetchErr(`Seed failed: ${error.message}`);
    else await fetchActiveRound();
  };

  // ── Core: write target_result to DB ──────────────────────────────
  const applyTargetResult = async (target: string): Promise<boolean> => {
    if (!activeRound) { setOverrideErr("No active round. Click 'Seed Rounds' first."); return false; }
    // Use the current DB active round as the authoritative period.
    setOverrideLoading(true);
    setOverrideErr(null);
    try {
      const { error } = await supabase
        .from("game_rounds")
        .update({ target_result: target })
        .eq("id", activeRound.id)
        .eq("status", "active");
      if (error) throw error;
      setOverrideMsg(`✓ Set → ${target} for period ${activeRound.period}`);
      void fetchActiveRound();
      setTimeout(() => setOverrideMsg(null), 5000);
      return true;
    } catch (e: any) {
      setOverrideErr(e?.message || "Failed to set target result.");
      return false;
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleForceOutcome = async (outcome: "BIG" | "SMALL") => {
    await applyTargetResult(outcome);
  };

  const handleClearForce = async () => {
    if (!activeRound) return;
    setOverrideLoading(true);
    try {
      await supabase.from("game_rounds")
        .update({ target_result: null }).eq("id", activeRound.id);
      setOverrideMsg("Force cleared.");
      void fetchActiveRound();
      setTimeout(() => setOverrideMsg(null), 3000);
    } catch (e: any) {
      setOverrideErr(e?.message || "Failed to clear.");
    } finally { setOverrideLoading(false); }
  };

  // ── Powerful Number: auto-pick max-profit result ──────────────────
  const handlePowerfulNumber = async () => {
    if (!activeRound) { setOverrideErr("No active round."); return; }
    const result = getPowerfulResult(activeRound.total_big, activeRound.total_small);
    const ok = await applyTargetResult(result);
    if (ok) {
      addChatLog(`⚡ Auto-Powerful → ${result} (Big: Rs${activeRound.total_big.toLocaleString()} | Small: Rs${activeRound.total_small.toLocaleString()})`, true);
    }
  };

  // ── Chat command parser ───────────────────────────────────────────
  // Accepted commands:
  //   big / small
  //   0-9  (specific number — stored as "NUM:X" so SQL can resolve it)
  //   clear / auto
  //   powerful / profit
  const addChatLog = (text: string, ok: boolean) => {
    setChatLog(prev => [...prev.slice(-49), { text, ok }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleChatSend = async () => {
    const cmd = chatInput.trim().toLowerCase();
    if (!cmd) return;
    setChatInput("");

    if (!activeRound) { addChatLog("✗ No active round.", false); return; }

    if (cmd === "big") {
      const ok = await applyTargetResult("BIG");
      addChatLog(ok ? `✓ Forced BIG → period ${activeRound.period}` : "✗ Failed", ok);
    } else if (cmd === "small") {
      const ok = await applyTargetResult("SMALL");
      addChatLog(ok ? `✓ Forced SMALL → period ${activeRound.period}` : "✗ Failed", ok);
    } else if (/^[0-9]$/.test(cmd)) {
      const ok = await applyTargetResult(`NUM:${cmd}`);
      addChatLog(ok ? `✓ Forced Number ${cmd} → period ${activeRound.period}` : "✗ Failed", ok);
    } else if (cmd === "clear" || cmd === "auto") {
      await handleClearForce();
      addChatLog(`✓ Cleared — round will use auto result`, true);
    } else if (cmd === "powerful" || cmd === "profit") {
      await handlePowerfulNumber();
    } else if (cmd === "status") {
      addChatLog(
        `Period: ${activeRound.period} | Big: Rs${activeRound.total_big.toLocaleString()} (${activeRound.big_pct}%) | Small: Rs${activeRound.total_small.toLocaleString()} (${activeRound.small_pct}%) | Forced: ${activeRound.target_result ?? "Auto"}`,
        true
      );
    } else {
      addChatLog(`✗ Unknown command "${cmd}". Try: big, small, 0-9, clear, powerful, status`, false);
    }
  };

  const modes = ["30s", "1m", "3m", "5m"] as const;

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{gameType.toUpperCase()} Game Controller</h2>
          <p className="text-gray-400 text-sm">Force outcomes · Monitor live bets · Max profit engine</p>
        </div>
        <button onClick={handleSeedRounds} disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-60">
          <Play className="w-4 h-4" />
          {seeding ? "Seeding…" : "Seed Rounds"}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Mode</h3>
        <div className="grid grid-cols-4 gap-3">
          {modes.map((mode) => (
            <button key={mode} onClick={() => setSelectedMode(mode)}
              className={`py-3 px-4 rounded-lg font-bold transition-all duration-200 ${
                selectedMode === mode
                  ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white shadow-lg shadow-red-500/30"
                  : "bg-[#0f3460] text-gray-300 hover:bg-[#1a3a52] border border-[#1a5f7a]"
              }`}>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Live Round Status */}
      <div className="mb-6 bg-[#0a0f1e] rounded-xl border border-[#1a5f7a] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base">Live Round Status</h3>
          <button onClick={fetchActiveRound} disabled={roundLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${roundLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {fetchErr && (
          <div className="mb-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
            <p className="font-bold mb-1">⚠ Fetch Error</p>
            <p>{fetchErr}</p>
            <p className="mt-1 text-gray-400">Run <code className="text-amber-300">game_engine_final.sql</code> then click Seed Rounds.</p>
          </div>
        )}

        {roundLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : !activeRound ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-amber-400 text-sm font-bold mb-1">No Active Round for {selectedMode}</p>
            <p className="text-gray-400 text-xs">Click <strong className="text-white">Seed Rounds</strong> to create the current round.</p>
          </div>
        ) : (
          <>
            {/* Period + Countdown — livePeriod is always authoritative (client clock) */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#111827] rounded-lg p-3 col-span-2">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Current Period</p>
                <p className="text-white font-mono text-sm font-black">{livePeriod}</p>
                <p className={`text-[9px] mt-0.5 ${
                  activeRound.period === livePeriod ? "text-emerald-600" : "text-amber-500"
                }`}>
                  DB: {activeRound.period === livePeriod ? "✓ synced" : `${activeRound.period} (resyncing…)`}
                </p>
              </div>
              <div className={`rounded-lg p-3 ${liveCountdown <= 5 ? "bg-red-500/20 border border-red-500/40" : "bg-[#111827]"}`}>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Countdown</p>
                <p className={`font-black text-2xl ${
                  liveCountdown <= 5 ? "text-red-400 animate-pulse" :
                  liveCountdown <= 10 ? "text-amber-400" : "text-emerald-400"
                }`}>{liveCountdown}s</p>
              </div>
            </div>

            {/* Bet Distribution — only meaningful when DB period matches live period */}
            {(() => {
              const synced = activeRound.period === livePeriod;
              const big    = synced ? activeRound.total_big   : 0;
              const small  = synced ? activeRound.total_small : 0;
              const total  = big + small;
              const bigPct   = total > 0 ? Math.round((big   / total) * 100) : 50;
              const smallPct = total > 0 ? Math.round((small / total) * 100) : 50;
              return (
                <div className="mb-4">
                  <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Bet Distribution</p>
                  <div className="flex rounded-lg overflow-hidden h-7 mb-1.5">
                    <div className="bg-[#fba846] flex items-center justify-center text-black text-xs font-black transition-all duration-500"
                      style={{ width: `${bigPct}%`, minWidth: "15%" }}>
                      {bigPct}%
                    </div>
                    <div className="bg-[#5c9df5] flex items-center justify-center text-white text-xs font-black transition-all duration-500"
                      style={{ width: `${smallPct}%`, minWidth: "15%" }}>
                      {smallPct}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#fba846] font-bold">BIG — Rs {big.toLocaleString()}</span>
                    <span className="text-[#5c9df5] font-bold">SMALL — Rs {small.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 bg-[#111827] rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider">Max Profit Side</span>
                    <span className={`text-xs font-black ${
                      getPowerfulResult(big, small) === "SMALL" ? "text-[#5c9df5]" : "text-[#fba846]"
                    }`}>
                      ⚡ Force {getPowerfulResult(big, small)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Forced Result — only show for the current live period */}
            <div className="bg-[#111827] rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Forced Result</p>
                {activeRound.period !== livePeriod ? (
                  <p className="text-amber-500 text-xs font-bold">Waiting for DB sync…</p>
                ) : (
                  <p className={`font-black text-base ${
                    activeRound.target_result === "BIG"   ? "text-[#fba846]" :
                    activeRound.target_result === "SMALL" ? "text-[#5c9df5]" :
                    activeRound.target_result?.startsWith("NUM:") ? "text-purple-400" : "text-gray-400"
                  }`}>
                    {activeRound.target_result ?? "Not set (auto)"}
                  </p>
                )}
              </div>
              {activeRound.target_result && activeRound.period === livePeriod && (
                <button onClick={handleClearForce} disabled={overrideLoading}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Force Outcome Buttons */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Force Outcome</h3>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => handleForceOutcome("BIG")}
            disabled={overrideLoading || !activeRound}
            className="py-3 px-4 bg-gradient-to-r from-[#fba846] to-[#f59e0b] text-black font-black rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Force BIG
          </button>
          <button onClick={() => handleForceOutcome("SMALL")}
            disabled={overrideLoading || !activeRound}
            className="py-3 px-4 bg-gradient-to-r from-[#5c9df5] to-[#3b82f6] text-white font-black rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Force SMALL
          </button>
          <button onClick={handlePowerfulNumber}
            disabled={overrideLoading || !activeRound}
            className="py-3 px-4 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white font-black rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4" /> Powerful
          </button>
        </div>
        {overrideLoading && <p className="text-gray-400 text-xs mt-2">Applying…</p>}
        {overrideMsg   && <p className="text-emerald-400 text-xs mt-2">{overrideMsg}</p>}
        {overrideErr   && (
          <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{overrideErr}</p>
          </div>
        )}
      </div>

      {/* ── Number Picker ─────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Force Specific Number (0–9)</h3>
        <div className="grid grid-cols-5 gap-2">
          {[0,1,2,3,4,5,6,7,8,9].map((n) => (
            <button key={n}
              onClick={() => applyTargetResult(`NUM:${n}`)}
              disabled={overrideLoading || !activeRound}
              className="py-2.5 rounded-lg font-black text-sm border border-[#1a5f7a] bg-[#0f3460] text-white hover:border-purple-400 hover:bg-purple-500/20 disabled:opacity-40 transition-all">
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live Analytics ───────────────────────────────────────── */}
      {activeRound && (
        <div className="mb-6 bg-[#0a0f1e] rounded-xl border border-[#1a5f7a] p-5">
          <h3 className="text-white font-bold text-base mb-4">Live Bet Analytics</h3>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#111827] rounded-lg p-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Total Bets</p>
              <p className="text-white font-black text-xl">{activeRound.totalBets}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Total Amount</p>
              <p className="text-white font-black text-xl">Rs {activeRound.totalBetAmount.toLocaleString()}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <p className="text-[10px] text-[#fba846] uppercase tracking-wider mb-0.5">Big Amount</p>
              <p className="text-[#fba846] font-black">Rs {activeRound.total_big.toLocaleString()}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <p className="text-[10px] text-[#5c9df5] uppercase tracking-wider mb-0.5">Small Amount</p>
              <p className="text-[#5c9df5] font-black">Rs {activeRound.total_small.toLocaleString()}</p>
            </div>
          </div>

          {/* Number-wise totals */}
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Number-wise Bet Amounts</p>
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {[0,1,2,3,4,5,6,7,8,9].map((n) => (
              <div key={n} className="bg-[#111827] rounded-lg p-2 text-center">
                <p className="text-gray-400 text-[10px] font-bold">{n}</p>
                <p className="text-white text-xs font-black">
                  {activeRound.numberTotals[n] > 0
                    ? `Rs ${activeRound.numberTotals[n].toLocaleString()}`
                    : "—"}
                </p>
              </div>
            ))}
          </div>

          {/* Color-wise totals */}
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Color-wise Bet Amounts</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#111827] rounded-lg p-3 text-center border border-[#2ed573]/20">
              <p className="text-[#2ed573] text-[10px] font-bold uppercase mb-1">Green</p>
              <p className="text-white font-black text-sm">
                {activeRound.colorTotals.green > 0 ? `Rs ${activeRound.colorTotals.green.toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 text-center border border-[#ff4757]/20">
              <p className="text-[#ff4757] text-[10px] font-bold uppercase mb-1">Red</p>
              <p className="text-white font-black text-sm">
                {activeRound.colorTotals.red > 0 ? `Rs ${activeRound.colorTotals.red.toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 text-center border border-[#9c27b0]/20">
              <p className="text-[#9c27b0] text-[10px] font-bold uppercase mb-1">Violet</p>
              <p className="text-white font-black text-sm">
                {activeRound.colorTotals.violet > 0 ? `Rs ${activeRound.colorTotals.violet.toLocaleString()}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Result Command Box ────────────────────────────────────── */}
      <div className="bg-[#0a0f1e] rounded-xl border border-[#1a5f7a] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a5f7a] bg-[#0f1929]">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-bold text-sm">Result Command Box</span>
          <span className="ml-auto text-[10px] text-gray-500">big · small · 0-9 · powerful · clear · status</span>
        </div>

        {/* Log */}
        <div className="h-36 overflow-y-auto p-3 space-y-1 font-mono text-xs">
          {chatLog.length === 0 && (
            <p className="text-gray-600">Type a command below to control the round result…</p>
          )}
          {chatLog.map((entry, i) => (
            <p key={i} className={entry.ok ? "text-emerald-400" : "text-red-400"}>{entry.text}</p>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex border-t border-[#1a5f7a]">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
            placeholder="Type: big / small / 5 / powerful / clear…"
            className="flex-1 bg-transparent px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none font-mono"
          />
          <button onClick={handleChatSend} disabled={overrideLoading || !chatInput.trim()}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Command reference */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] text-gray-600">
        {[
          ["big", "Force Big win next round"],
          ["small", "Force Small win next round"],
          ["0–9", "Force specific number"],
          ["powerful", "Auto-pick max profit side"],
          ["clear", "Remove forced result (auto)"],
          ["status", "Show current round stats"],
        ].map(([cmd, desc]) => (
          <div key={cmd} className="flex gap-1.5">
            <code className="text-amber-500">{cmd}</code>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
