/**
 * backend/game-engine/resultStore.ts
 *
 * Stores WinGo round results in an AES-256-GCM encrypted JSON file
 * inside backend/game-engine/data/ — never served as a static asset,
 * not reachable by any Express route, excluded from Vite build.
 *
 * Set RESULT_STORE_KEY=<64 hex chars> in .env for production.
 * Without the key the file is unreadable ciphertext.
 */

import fs     from "fs";
import path   from "path";
import crypto from "crypto";

const DATA_DIR   = path.join(process.cwd(), "backend", "game-engine", "data");
const STORE_FILE = path.join(DATA_DIR, "wingo_results.enc");
const ALGO       = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.RESULT_STORE_KEY ?? "";
  if (hex.length === 64) return Buffer.from(hex, "hex");
  // Dev fallback — deterministic but not secret
  return crypto.scryptSync("winwave-dev-seed", "wingo-salt-2025", 32);
}

function encrypt(plaintext: string): string {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64: string): string {
  const buf    = Buffer.from(b64, "base64");
  const iv     = buf.subarray(0, 12);
  const tag    = buf.subarray(12, 28);
  const enc    = buf.subarray(28);
  const dec    = crypto.createDecipheriv(ALGO, getKey(), iv);
  dec.setAuthTag(tag);
  return dec.update(enc).toString("utf8") + dec.final("utf8");
}

// ── Types ─────────────────────────────────────────────────────────
export interface RoundResult {
  period:     string;
  mode:       string;
  number:     number;
  size:       "Big" | "Small";
  color:      "red" | "green" | "violet";
  resolvedAt: string;
}

interface ActiveRound {
  mode:   string;
  period: string;
  endsAt: string;
}

interface Store {
  activeRounds: Record<string, ActiveRound>;
  history:      RoundResult[];
  updatedAt:    string;
}

// ── In-memory cache ───────────────────────────────────────────────
let cache: Store = {
  activeRounds: {},
  history:      [],
  updatedAt:    new Date().toISOString(),
};

export function loadStore(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    cache = JSON.parse(decrypt(fs.readFileSync(STORE_FILE, "utf8")));
  } catch {
    console.warn("[resultStore] Decrypt failed — starting fresh.");
    cache = { activeRounds: {}, history: [], updatedAt: new Date().toISOString() };
  }
}

export function saveStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    cache.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, encrypt(JSON.stringify(cache)), "utf8");
  } catch (e) {
    console.error("[resultStore] Save failed:", e);
  }
}

export function setActiveRound(mode: string, period: string, endsAt: Date): void {
  cache.activeRounds[mode] = { mode, period, endsAt: endsAt.toISOString() };
}

export function getActiveRound(mode: string): ActiveRound | null {
  return cache.activeRounds[mode] ?? null;
}

export function getAllActiveRounds(): Record<string, ActiveRound> {
  return { ...cache.activeRounds };
}

export function pushResult(result: RoundResult): void {
  cache.history.unshift(result);
  if (cache.history.length > 200) cache.history.length = 200;
  saveStore();
}

export function getHistory(mode: string, limit = 20): RoundResult[] {
  return cache.history.filter(r => r.mode === mode).slice(0, limit);
}
