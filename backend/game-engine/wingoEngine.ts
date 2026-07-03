/**
 * backend/game-engine/wingoEngine.ts
 *
 * 24/7 server-side game loop. Runs entirely in Node.js — never stops
 * when the browser tab closes. Responsibilities:
 *
 *   1. Tick every second — detect when a round expires
 *   2. Generate result using deterministic RNG + platform margin control
 *   3. Write encrypted result to resultStore (disk)
 *   4. Sync completed round + pending bet resolutions to Supabase
 *   5. Create the next active round in Supabase + resultStore
 *
 * Platform Margin Algorithm:
 *   - Track rolling window: sum(payouts) / sum(bets) for last 500 bets
 *   - Target RTP = 96% (house edge 4%)
 *   - If actual RTP > 98%  → bias result toward house (flip Big↔Small)
 *   - If actual RTP < 90%  → allow more player wins (use raw RNG)
 *   - Otherwise            → pure deterministic RNG
 */

import crypto from "crypto";
import {
  loadStore,
  saveStore,
  setActiveRound,
  getActiveRound,
  pushResult,
  type RoundResult,
} from "./resultStore.js";

// ── Supabase admin client (service role — never sent to browser) ──
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL        ?? process.env.VITE_SUPABASE_URL        ?? "",
  process.env.SERVICE_ROLE_KEY    ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? ""
);

// ── Mode config ───────────────────────────────────────────────────
const MODES = [
  { mode: "30s", interval: 30,  prefix: "1000" },
  { mode: "1m",  interval: 60,  prefix: "2000" },
  { mode: "3m",  interval: 180, prefix: "3000" },
  { mode: "5m",  interval: 300, prefix: "4000" },
] as const;

type Mode = typeof MODES[number]["mode"];

// ── Platform margin tracker ───────────────────────────────────────
// Rolling window of last 500 resolved bets across all modes
interface BetRecord { betAmount: number; payoutAmount: number; }
const marginWindow: BetRecord[] = [];
const MARGIN_WINDOW_SIZE = 500;
const TARGET_RTP         = 0.96;  // 96% — house keeps 4%
const RTP_HIGH_THRESHOLD = 0.98;  // above this → force house win
const RTP_LOW_THRESHOLD  = 0.90;  // below this → allow player win

function recordBetOutcome(betAmount: number, payoutAmount: number): void {
  marginWindow.push({ betAmount, payoutAmount });
  if (marginWindow.length > MARGIN_WINDOW_SIZE) marginWindow.shift();
}

function getCurrentRTP(): number {
  if (marginWindow.length < 10) return TARGET_RTP; // not enough data
  const totalBet    = marginWindow.reduce((s, r) => s + r.betAmount,    0);
  const totalPayout = marginWindow.reduce((s, r) => s + r.payoutAmount, 0);
  return totalBet > 0 ? totalPayout / totalBet : TARGET_RTP;
}

// ── Deterministic RNG (matches client JS getResultForPeriod) ──────
function getResultForPeriod(periodStr: string): { number: number; size: "Big"|"Small"; color: "red"|"green"|"violet" } {
  let hash = 0;
  for (let i = 0; i < periodStr.length; i++) {
    hash = (Math.imul(31, hash) + periodStr.charCodeAt(i)) | 0;
  }
  let t = (hash + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const num  = Math.floor(rand * 10);
  return {
    number: num,
    size:   num >= 5 ? "Big" : "Small",
    color:  num === 0 || num === 5 ? "violet" : num % 2 === 0 ? "red" : "green",
  };
}

// ── Margin-adjusted result ────────────────────────────────────────
// Checks current platform RTP and biases the result if needed.
// Admin target_result always overrides everything.
function getAdjustedResult(
  period: string,
  targetResult: string | null,
  pendingBets: Array<{ bet_type: string; bet_value: string; amount: number }>
): { number: number; size: "Big"|"Small"; color: "red"|"green"|"violet" } {
  let result = getResultForPeriod(period);

  // 1. Admin hard override
  if (targetResult) {
    if (targetResult === "BIG" && result.size !== "Big") {
      const n = 5 + (result.number % 5);
      return { number: n, size: "Big", color: n === 5 ? "violet" : n % 2 === 0 ? "red" : "green" };
    }
    if (targetResult === "SMALL" && result.size !== "Small") {
      const n = result.number % 5;
      return { number: n, size: "Small", color: n === 0 ? "violet" : n % 2 === 0 ? "red" : "green" };
    }
    if (targetResult.startsWith("NUM:")) {
      const n = parseInt(targetResult.slice(4), 10);
      if (!isNaN(n) && n >= 0 && n <= 9) {
        return { number: n, size: n >= 5 ? "Big" : "Small", color: n === 0 || n === 5 ? "violet" : n % 2 === 0 ? "red" : "green" };
      }
    }
    return result;
  }

  // 2. Platform margin control
  const rtp = getCurrentRTP();

  if (rtp > RTP_HIGH_THRESHOLD && pendingBets.length > 0) {
    // Platform is paying out too much — bias toward house
    // Find the dominant bet side and flip against it
    const bigBets   = pendingBets.filter(b => b.bet_type === "size" && b.bet_value === "Big")
                                 .reduce((s, b) => s + b.amount, 0);
    const smallBets = pendingBets.filter(b => b.bet_type === "size" && b.bet_value === "Small")
                                 .reduce((s, b) => s + b.amount, 0);

    if (bigBets > smallBets && result.size === "Big") {
      // Flip to Small to reduce payout
      const n = result.number % 5; // 0-4
      result = { number: n, size: "Small", color: n === 0 ? "violet" : n % 2 === 0 ? "red" : "green" };
    } else if (smallBets > bigBets && result.size === "Small") {
      const n = 5 + (result.number % 5); // 5-9
      result = { number: n, size: "Big", color: n === 5 ? "violet" : n % 2 === 0 ? "red" : "green" };
    }
  }
  // If rtp < RTP_LOW_THRESHOLD → use raw RNG as-is (players win more, corrects low RTP)

  return result;
}

// ── Period derivation (UTC, no +1) ────────────────────────────────
function derivePeriod(now: Date, interval: number, prefix: string): { period: string; endsAt: Date } {
  const secs = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const roundNum = Math.floor(secs / interval);
  const dateStr  =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}`;
  const period = `${dateStr}${prefix}${String(roundNum).padStart(5, "0")}`;
  // endsAt = UTC midnight + (roundNum+1)*interval seconds
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endsAt   = new Date(midnight + (roundNum + 1) * interval * 1000);
  return { period, endsAt };
}

// ── Resolve a round: compute result, update DB, push to store ─────
async function resolveRound(
  mode: Mode,
  interval: number,
  dbRound: { id: string; period: string; target_result: string | null }
): Promise<void> {
  // Fetch pending bets for margin calculation
  const { data: bets } = await supabase
    .from("betting_history")
    .select("bet_type, bet_value, amount, user_id, id")
    .eq("round_id", dbRound.id)
    .eq("status", "pending");

  const pendingBets = bets ?? [];
  const result = getAdjustedResult(dbRound.period, dbRound.target_result, pendingBets);

  // Mark round completed in Supabase
  await supabase
    .from("game_rounds")
    .update({
      status:        "completed",
      result_number: result.number,
      result_size:   result.size,
      result_color:  result.color,
    })
    .eq("id", dbRound.id);

  // Resolve each bet
  for (const bet of pendingBets) {
    let isWin = false;
    if (bet.bet_type === "size")   isWin = bet.bet_value === result.size;
    if (bet.bet_type === "number") isWin = Number(bet.bet_value) === result.number;
    if (bet.bet_type === "color") {
      isWin =
        (bet.bet_value === "Green"  && (result.color === "green"  || result.number === 5)) ||
        (bet.bet_value === "Red"    && (result.color === "red"    || result.number === 0)) ||
        (bet.bet_value === "Violet" && result.color === "violet");
    }
    const winAmount = isWin ? bet.amount * (bet.bet_type === "number" ? 9 : 1.96) : 0;

    await supabase
      .from("betting_history")
      .update({
        status:        isWin ? "win" : "lose",
        is_win:        isWin,
        win_amount:    winAmount,
        result_number: result.number,
        result_size:   result.size,
        result_color:  result.color,
      })
      .eq("id", bet.id);

    if (isWin && winAmount > 0) {
      await supabase
        .from("users")
        .update({ main_balance: supabase.rpc as any })
        .eq("id", bet.user_id);

      // Use RPC to atomically credit balance
      await supabase.rpc("credit_user_balance" as any, {
        p_user_id: bet.user_id,
        p_amount:  winAmount,
      });
    }

    // Track for margin window
    recordBetOutcome(bet.amount, winAmount);
  }

  // Push to encrypted store
  const roundResult: RoundResult = {
    period:     dbRound.period,
    mode,
    number:     result.number,
    size:       result.size,
    color:      result.color,
    resolvedAt: new Date().toISOString(),
  };
  pushResult(roundResult);

  console.log(`[WinGo] Resolved ${mode} period ${dbRound.period} → ${result.number} ${result.size} ${result.color} | RTP=${(getCurrentRTP()*100).toFixed(1)}%`);
}

// ── Create next active round in Supabase + store ──────────────────
async function ensureActiveRound(mode: Mode, interval: number, prefix: string): Promise<void> {
  const now = new Date();
  const { period, endsAt } = derivePeriod(now, interval, prefix);

  // Check if already exists in DB
  const { data: existing } = await supabase
    .from("game_rounds")
    .select("id")
    .eq("game_type", "wingo")
    .eq("mode", mode)
    .eq("status", "active")
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("game_rounds")
      .insert({
        game_type:  "wingo",
        mode,
        period,
        started_at: now.toISOString(),
        ends_at:    endsAt.toISOString(),
        status:     "active",
      })
      .onConflict("period")
      .ignore();
  }

  setActiveRound(mode, period, endsAt);
}

// ── Main tick ─────────────────────────────────────────────────────
async function tick(): Promise<void> {
  const now = new Date();

  for (const { mode, interval, prefix } of MODES) {
    try {
      // Find expired active rounds
      const { data: expired } = await supabase
        .from("game_rounds")
        .select("id, period, target_result")
        .eq("game_type", "wingo")
        .eq("mode", mode)
        .eq("status", "active")
        .lte("ends_at", now.toISOString())
        .order("ends_at", { ascending: true });

      for (const round of expired ?? []) {
        await resolveRound(mode, interval, round as any);
      }

      // Ensure a fresh active round exists
      await ensureActiveRound(mode, interval, prefix);
    } catch (err) {
      console.error(`[WinGo] Tick error for mode ${mode}:`, err);
    }
  }
}

// ── Engine start ──────────────────────────────────────────────────
let tickInterval: ReturnType<typeof setInterval> | null = null;

export function startWinGoEngine(): void {
  if (tickInterval) return; // already running

  loadStore();
  console.log("[WinGo] 24/7 engine started.");

  // Run immediately, then every 2 seconds
  void tick();
  tickInterval = setInterval(() => void tick(), 2000);
}

export function stopWinGoEngine(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    saveStore();
    console.log("[WinGo] Engine stopped.");
  }
}

// Export for API routes
export { getCurrentRTP };
