// api/webhook/deposit.js
// Webhook URL to register in PKPay dashboard: POST /api/webhook/deposit
// PKPay sends: { merchant_id, out_trade_no, amount, status, user_id, sign, ... }

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const WEBHOOK_SECRET    = process.env.Webhook_secret    || "";
const PAYOUT_API_SECRET = process.env.Payout_API_secret || "";
const PAY_IN_API_SECRET = process.env.Pay_in_API_secret || "";

// PKPay signature: HMAC-SHA256 of sorted key=value (excluding 'sign' key)
function verifyPKPaySignature(body) {
  if (!WEBHOOK_SECRET && !PAY_IN_API_SECRET) return true; // skip in dev

  const secret = WEBHOOK_SECRET || PAY_IN_API_SECRET;
  const { sign, ...rest } = body;

  const sorted = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("&");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(sorted)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected.toLowerCase()),
      Buffer.from((sign || "").toLowerCase())
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 1. Verify PKPay HMAC-SHA256 signature
  if (!verifyPKPaySignature(req.body)) {
    console.warn("[webhook/deposit] Invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { user_id, out_trade_no, amount, status } = req.body;

  // 2. Only process successful payments
  if (status !== "success" && status !== "SUCCESS") {
    return res.status(200).json({ received: true, processed: false, reason: "non-success status" });
  }

  if (!user_id || !amount || !out_trade_no)
    return res.status(400).json({ error: "Missing required fields: user_id, amount, out_trade_no" });

  const tx_ref = String(out_trade_no);

  // 3. Idempotency pre-check — query deposit_history before touching balances
  const { data: existing, error: checkError } = await supabase
    .from("deposit_history")
    .select("id")
    .eq("gateway_ref", tx_ref)
    .eq("status", "success")
    .maybeSingle();

  if (checkError) {
    console.error("[webhook/deposit] Idempotency check failed:", checkError);
    return res.status(500).json({ error: checkError.message });
  }

  if (existing) {
    console.log(`[webhook/deposit] Skipping duplicate: ${tx_ref}`);
    return res.status(200).json({ status: "ignored", message: "Transaction already processed" });
  }

  // 4. Atomic balance credit via RPC (handles race condition at DB level too)
  console.log(`[webhook/deposit] Processing new deposit: ${tx_ref}`);

  const { data, error } = await supabase.rpc("handle_gateway_deposit", {
    p_user_id: user_id,
    p_amount:  Number(amount),
    p_tx_ref:  tx_ref,
  });

  if (error) {
    console.error("[webhook/deposit] handle_gateway_deposit error:", error);
    return res.status(500).json({ error: error.message });
  }

  // RPC returns { duplicate: true } if a concurrent request beat us to it
  if (data?.duplicate) {
    console.log(`[webhook/deposit] Skipping duplicate (race): ${tx_ref}`);
    return res.status(200).json({ status: "ignored", message: "Transaction already processed" });
  }

  console.log(`[webhook/deposit] Deposit credited — tx: ${tx_ref}, amount: ${amount}`);
  return res.status(200).json({ code: 0, msg: "success", data });
}
