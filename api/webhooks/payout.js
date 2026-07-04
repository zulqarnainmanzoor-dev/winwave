// api/webhooks/payout.js
// Register this URL in PKPay dashboard as the Payout Callback URL.
// PKPay POST payload: { out_trade_no, status, amount, sign, ... }
//
// Flow:
//   PKPay sends success → complete_withdrawal RPC (processing → completed)
//   PKPay sends failed  → fail_withdrawal RPC    (processing → failed + refund)
//
// SECURE WEBHOOK ENDPOINT WITH SIGNATURE VERIFICATION

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize server-privileged Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.Webhook_secret || process.env.Payout_API_secret || "";

// PKPay HMAC-SHA256 signature verification
// Sort keys alphabetically, exclude 'sign', join as key=value&...
function verifySignature(body) {
  // Skip verification if no secret configured (development mode)
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook/payout] No WEBHOOK_SECRET configured — skipping signature verification");
    return true;
  }

  const { sign, ...rest } = body;
  
  // Build payload string from sorted keys
  const payload = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== null && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("&");

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected.toLowerCase()),
      Buffer.from((sign || "").toLowerCase())
    );
    
    if (!isValid) {
      console.warn("[webhook/payout] Invalid signature — rejected");
    }
    
    return isValid;
  } catch (error) {
    console.error("[webhook/payout] Signature verification error:", error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify webhook signature for security
    if (!verifySignature(req.body)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { out_trade_no, status } = req.body;

    if (!out_trade_no) {
      return res.status(400).json({ error: "Missing out_trade_no" });
    }

    // out_trade_no is the withdrawal_history.id set when creating the payout request
    const withdrawalId = String(out_trade_no);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/payout] ${withdrawalId} → status=${status} → ${isSuccess ? "SUCCESS" : "FAILED"}`);

    if (isSuccess) {
      // PKPay success → mark withdrawal as completed
      const { data, error } = await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_gateway_ref:   `pkpay:${out_trade_no}`,
      });

      if (error) {
        console.error("[webhook/payout] complete_withdrawal error:", error);
        return res.status(500).json({ error: error.message });
      }

      // Return 200 even if already_completed so PKPay stops retrying
      console.log(`[webhook/payout] ✓ Completed: ${withdrawalId}`, data);
      return res.status(200).json({ code: 0, msg: "success" });

    } else {
      // PKPay failed → mark withdrawal as failed and refund balance
      const { data, error } = await supabase.rpc("fail_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_reason:        `PKPay payout failed (status=${status})`,
      });

      if (error) {
        console.error("[webhook/payout] fail_withdrawal error:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[webhook/payout] ✗ Failed + refunded: ${withdrawalId}`, data);
      return res.status(200).json({ code: 0, msg: "noted_failed" });
    }

  } catch (error: any) {
    console.error("[webhook/payout] Critical error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
