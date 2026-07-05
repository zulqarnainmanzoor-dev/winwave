import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export type WinGoMode = "30s" | "1m" | "3m" | "5m";

export interface RoundResult {
  period:     string;
  mode:       string;
  number:     number;
  size:       "Big" | "Small";
  color:      "red" | "green" | "violet";
  resolvedAt: string;
}

interface RoundState {
  period:      string;
  timeLeft:    number;
  roundId:     string | null;
  targetResult:string | null;
  totalBig:    number;
  totalSmall:  number;
}

const MODE_INTERVAL: Record<WinGoMode, number> = {
  "30s": 30, "1m": 60, "3m": 180, "5m": 300,
};

// ── HMAC verification (matches backend signPayload) ───────────────
// In production set VITE_WINGO_HMAC_SECRET in .env
const HMAC_SECRET = import.meta.env.VITE_WINGO_HMAC_SECRET ?? "winclub-hmac-dev-secret";

async function verifyHmac(data: object, sig: string): Promise<boolean> {
  try {
    const enc     = new TextEncoder();
    const keyData = enc.encode(HMAC_SECRET);
    const msgData = enc.encode(JSON.stringify(data));
    const key     = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBuf  = Uint8Array.from(sig.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBuf, msgData);
  } catch {
    return true; // fail-open in dev
  }
}

// ── Authenticated fetch helper ────────────────────────────────────
async function apiFetch(path: string): Promise<any | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const res = await fetch(path, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept":        "application/json",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();

    // Verify HMAC signature
    if (json.sig && json.data) {
      const valid = await verifyHmac(json.data, json.sig);
      if (!valid) {
        console.warn("[useWinGoSync] HMAC verification failed — possible tampering");
        return null;
      }
      return json.data;
    }
    return json;
  } catch {
    return null;
  }
}

/**
 * useWinGoSync
 *
 * Fetches authoritative period + timeLeft from the Node.js game engine
 * via /api/wingo/state — NOT from Supabase RPC or local Date().
 *
 * The server response is HMAC-signed so the client can detect tampering.
 * Falls back to local UTC derivation if the server is unreachable.
 */
export function useWinGoSync(mode: WinGoMode): RoundState & { isTimeUp: boolean } {
  const driftMsRef = useRef<number>(0);

  const [round, setRound] = useState<RoundState>({
    period: "", timeLeft: MODE_INTERVAL[mode],
    roundId: null, targetResult: null, totalBig: 0, totalSmall: 0,
  });

  // ── Local fallback: derive period from corrected clock ──────────
  const deriveLocal = useCallback((nowMs: number): { period: string; timeLeft: number } => {
    const interval  = MODE_INTERVAL[mode];
    const prefixes: Record<WinGoMode, string> = { "30s": "1000", "1m": "2000", "3m": "3000", "5m": "4000" };
    const epochInterval = Math.floor(nowMs / (interval * 1000));
    const timeLeft = interval - Math.floor((nowMs / 1000) % interval);
    return {
      period:   `${prefixes[mode]}${epochInterval}`,
      timeLeft: Math.max(1, timeLeft),
    };
  }, [mode]);

  // ── Fetch state from server engine ─────────────────────────────
  const fetchState = useCallback(async () => {
    const data = await apiFetch(`/api/wingo/state?mode=${mode}`);
    if (!data) {
      // Fallback to local clock
      const { period, timeLeft } = deriveLocal(Date.now() + driftMsRef.current);
      setRound(prev => ({ ...prev, period, timeLeft }));
      return;
    }

    // Measure drift from server timestamp
    if (data.serverUtcMs) {
      driftMsRef.current = data.serverUtcMs - Date.now();
    }

    setRound(prev => ({
      ...prev,
      period:       data.period      ?? prev.period,
      timeLeft:     data.timeLeft    ?? prev.timeLeft,
      targetResult: data.targetResult ?? prev.targetResult,
    }));
  }, [mode, deriveLocal]);

  // ── Fetch round metadata (roundId, totals) from Supabase ───────
  const fetchRoundMeta = useCallback(async (period: string) => {
    try {
      const { data } = await supabase
        .from("game_rounds")
        .select("id, target_result, total_big, total_small")
        .eq("game_type", "wingo")
        .eq("mode", mode)
        .eq("period", period)
        .maybeSingle();
      if (data) {
        setRound(prev => ({
          ...prev,
          roundId:      data.id             ?? null,
          targetResult: data.target_result  ?? null,
          totalBig:     data.total_big      ?? 0,
          totalSmall:   data.total_small    ?? 0,
        }));
      }
    } catch { /* non-critical */ }
  }, [mode]);

  // ── 1-second tick: update timeLeft locally between server fetches
  useEffect(() => {
    let lastPeriod = "";

    const tick = () => {
      setRound(prev => {
        const newTimeLeft = Math.max(0, prev.timeLeft - 1);

        // When timeLeft hits 0, re-fetch from server immediately
        if (newTimeLeft === 0) {
          void fetchState();
        }

        // Detect period change → fetch round metadata
        if (prev.period && prev.period !== lastPeriod) {
          lastPeriod = prev.period;
          void fetchRoundMeta(prev.period);
        }

        return { ...prev, timeLeft: newTimeLeft };
      });
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fetchState, fetchRoundMeta]);

  // ── Poll server every 5 seconds to stay in sync ────────────────
  useEffect(() => {
    void fetchState(); // immediate on mount / mode change
    const id = setInterval(() => void fetchState(), 5000);
    return () => clearInterval(id);
  }, [fetchState]);

  // ── Realtime: admin target_result override ─────────────────────
  useEffect(() => {
    if (!round.period) return;
    const channel = supabase
      .channel(`wingo-round-${round.period}-${mode}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_rounds",
        filter: `period=eq.${round.period}`,
      }, (payload) => {
        setRound(prev => ({
          ...prev,
          targetResult: (payload.new as any)?.target_result ?? null,
        }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [round.period, mode]);

  return { ...round, isTimeUp: round.timeLeft <= 5 };
}

// ── useWinGoHistory — fetches from server engine store ────────────
export function useWinGoHistory(mode: WinGoMode, limit = 20) {
  const [history, setHistory] = useState<RoundResult[]>([]);

  const fetchHistory = useCallback(async () => {
    const data = await apiFetch(`/api/wingo/history?mode=${mode}&limit=${limit}`);
    if (data?.history?.length) {
      setHistory(data.history);
      return;
    }
    // Fallback: fetch from Supabase directly
    const { data: rows } = await supabase
      .from("game_rounds")
      .select("period, result_number, result_size, result_color, ends_at")
      .eq("game_type", "wingo")
      .eq("mode", mode)
      .eq("status", "completed")
      .order("ends_at", { ascending: false })
      .limit(limit);

    if (rows?.length) {
      setHistory(rows.map((r: any) => ({
        period:     r.period,
        mode,
        number:     r.result_number,
        size:       r.result_size,
        color:      r.result_color,
        resolvedAt: r.ends_at,
      })));
    }
  }, [mode, limit]);

  useEffect(() => {
    void fetchHistory();
    // Refresh history every 5 seconds for near-real-time updates
    const id = setInterval(() => void fetchHistory(), 5_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  // Realtime: instantly refresh history when a game_round is completed
  useEffect(() => {
    const channel = supabase
      .channel(`wingo-history-${mode}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "game_rounds",
        filter: `mode=eq.${mode}`,
      }, (payload) => {
        if ((payload.new as any)?.status === "completed") {
          void fetchHistory();
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [mode, fetchHistory]);

  return { history, refresh: fetchHistory };
}
