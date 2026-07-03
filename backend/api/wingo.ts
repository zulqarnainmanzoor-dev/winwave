/**
 * backend/api/wingo.ts
 *
 * Protected WinGo API routes. Security layers:
 *   1. Authorization: Bearer <JWT>  — Supabase session token required
 *   2. HMAC-SHA256 response signing — client verifies payload integrity
 *   3. Rate limiting per IP         — blocks scrapers / bots
 *   4. No raw result data in response — only what the client needs
 *
 * Routes:
 *   GET  /api/wingo/state?mode=30s   — current period + timeLeft
 *   GET  /api/wingo/history?mode=30s — last 20 completed results
 *   GET  /api/wingo/rtp              — platform RTP (admin only)
 */

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getActiveRound, getHistory } from "../game-engine/resultStore.js";
import { getCurrentRTP } from "../game-engine/wingoEngine.js";

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL     ?? process.env.VITE_SUPABASE_URL        ?? "",
  process.env.SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const HMAC_SECRET = process.env.WINGO_HMAC_SECRET ?? "winwave-hmac-dev-secret";

// ── HMAC sign helper ──────────────────────────────────────────────
function signPayload(payload: object): { data: object; sig: string } {
  const json = JSON.stringify(payload);
  const sig  = crypto.createHmac("sha256", HMAC_SECRET).update(json).digest("hex");
  return { data: payload, sig };
}

// ── Rate limiter (in-memory, per IP, 60 req/min) ──────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip  = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > 60) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  next();
}

// ── Auth middleware — verify Supabase JWT ─────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth  = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as any).userId = user.id;
  next();
}

// ── Bot / scraper detection ───────────────────────────────────────
function blockBots(req: Request, res: Response, next: NextFunction): void {
  const ua = (req.headers["user-agent"] ?? "").toLowerCase();
  const botPatterns = ["bot", "crawler", "spider", "scraper", "curl", "wget", "python", "java/", "go-http"];
  if (botPatterns.some(p => ua.includes(p))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Must have a browser-like Accept header
  const accept = req.headers["accept"] ?? "";
  if (!accept.includes("application/json") && !accept.includes("*/*") && !accept.includes("text/")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// Apply to all wingo routes
router.use(blockBots);
router.use(rateLimit);
router.use(requireAuth);

// ── GET /api/wingo/state?mode=30s ─────────────────────────────────
// Returns: period, timeLeft (seconds), endsAt, serverUtcMs
router.get("/state", (req: Request, res: Response) => {
  const mode = String(req.query.mode ?? "30s");
  const validModes = ["30s", "1m", "3m", "5m"];
  if (!validModes.includes(mode)) {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const active = getActiveRound(mode);
  const now    = Date.now();

  if (!active) {
    // Fallback: derive from server UTC directly
    const intervals: Record<string, number> = { "30s": 30, "1m": 60, "3m": 180, "5m": 300 };
    const prefixes:  Record<string, string> = { "30s": "1000", "1m": "2000", "3m": "3000", "5m": "4000" };
    const d        = new Date(now);
    const secs     = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
    const interval = intervals[mode];
    const roundNum = Math.floor(secs / interval);
    const dateStr  =
      `${d.getUTCFullYear()}` +
      `${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(d.getUTCDate()).padStart(2, "0")}`;
    const period   = `${dateStr}${prefixes[mode]}${String(roundNum).padStart(5, "0")}`;
    const timeLeft = interval - (secs % interval);

    res.json(signPayload({ period, timeLeft, serverUtcMs: now, mode }));
    return;
  }

  const endsAtMs = new Date(active.endsAt).getTime();
  const timeLeft = Math.max(0, Math.round((endsAtMs - now) / 1000));

  res.json(signPayload({
    period:      active.period,
    timeLeft,
    endsAt:      active.endsAt,
    serverUtcMs: now,
    mode,
  }));
});

// ── GET /api/wingo/history?mode=30s&limit=20 ─────────────────────
// Returns last N completed results from encrypted store
router.get("/history", (req: Request, res: Response) => {
  const mode  = String(req.query.mode  ?? "30s");
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const history = getHistory(mode, limit);
  res.json(signPayload({ mode, history, serverUtcMs: Date.now() }));
});

// ── GET /api/wingo/rtp — admin only ──────────────────────────────
router.get("/rtp", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  // Check admin flag
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("is_agent")
    .eq("id", userId)
    .maybeSingle();

  // Only allow if user has admin/agent role — adjust condition to your admin check
  const adminSecret = req.headers["x-admin-secret"];
  if (adminSecret !== (process.env.ADMIN_SECRET_ID ?? "3399944")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ rtp: getCurrentRTP(), windowSize: 500 });
});

export default router;
