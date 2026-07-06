import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../database/db';

const router = Router();

// Webhook secret for signature verification
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  process.env.Webhook_secret ||
  "";

// PKPay HMAC-SHA256 signature verification
// Sort keys alphabetically, exclude 'sign', join as key=value&...
function verifySignature(body: Record<string, any>): boolean {
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

router.post('/payout', async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // EMERGENCY CRITICAL: RAW BODY CAPTURE
    // Read the raw text from the request body BEFORE any processing.
    // This ensures we capture the absolute raw transmission string
    // even if JSON parsing fails or the body is malformed.
    // ═══════════════════════════════════════════════════════════════
    const rawBodyText = typeof req.body === 'object' 
      ? JSON.stringify(req.body) 
      : String(req.body || '');

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("👉 EMERGENCY CRITICAL WEBHOOK TRIGGER RECEIVED FROM GATEWAY");
    console.log("👉 RAW BODY TEXT:", rawBodyText);
    console.log("👉 RAW BODY LENGTH:", rawBodyText.length, "chars");
    console.log("👉 CONTENT-TYPE:", req.headers['content-type'] || 'none');
    console.log("👉 ALL HEADERS:", JSON.stringify(req.headers));
    console.log("═══════════════════════════════════════════════════════════════════");

    // If body is empty, log it and return early — don't crash
    if (!rawBodyText || rawBodyText === '{}' || rawBodyText === '""') {
      console.warn("[webhook/payout] ⚠️ Empty transmission body parameters — logged raw above");
      return res.status(200).json({ received: true, note: "Empty transmission body parameters." });
    }

    // Parse the raw body text into a structured payload
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      console.error("[webhook/payout] ❌ JSON PARSE FAILED on raw body:", parseError.message);
      console.error("[webhook/payout] ❌ Raw text that failed to parse:", rawBodyText);
      return res.status(200).json({ 
        received: true, 
        note: "Body received but JSON parse failed — raw text logged on server" 
      });
    }

    // Log the parsed payload for debugging
    console.log("[webhook/payout] ✅ Successfully parsed JSON payload:", JSON.stringify(payload, null, 2));

    // Verify webhook signature for security
    if (!verifySignature(payload)) {
      console.warn("[webhook/payout] ⛔ SIGNATURE MISMATCH — payload rejected but logged above for debugging");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { out_trade_no, status } = payload;

    if (!out_trade_no) {
      console.warn("[webhook/payout] ⚠️ Missing out_trade_no in payload — full body logged above");
      return res.status(200).json({ received: true, note: "Missing out_trade_no — payload logged" });
    }

    // out_trade_no is the withdrawal_history.id set when creating the payout request
    const withdrawalId = String(out_trade_no);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/payout] ${withdrawalId} → status=${status} → ${isSuccess ? "SUCCESS" : "FAILED"}`);

    if (isSuccess) {
      // PKPay success → mark withdrawal as completed
      const { data, error } = await supabaseAdmin.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_gateway_ref:   `pkpay:${out_trade_no}`,
      });

      if (error) {
        console.error("[webhook/payout] complete_withdrawal error:", error);
        // Fallback: update directly if RPC fails
        const { error: updateError } = await supabaseAdmin
          .from("withdrawal_history")
          .update({
            status: "completed",
            gateway_ref: `pkpay:${out_trade_no}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", withdrawalId);
        
        if (updateError) {
          console.error("[webhook/payout] Direct update also failed:", updateError);
        }
      }

      // Return 200 even if already_completed so PKPay stops retrying
      console.log(`[webhook/payout] ✓ Completed: ${withdrawalId}`);
      return res.status(200).json({ code: 0, msg: "success" });

    } else {
      // PKPay failed → mark withdrawal as failed and refund balance
      const { data, error } = await supabaseAdmin.rpc("fail_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_reason:        `PKPay payout failed (status=${status})`,
      });

      if (error) {
        console.error("[webhook/payout] fail_withdrawal error:", error);
        // Fallback: update directly if RPC fails
        const { error: updateError } = await supabaseAdmin
          .from("withdrawal_history")
          .update({
            status: "failed",
            reason: `PKPay payout failed (status=${status})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", withdrawalId);
        
        if (updateError) {
          console.error("[webhook/payout] Direct update also failed:", updateError);
        }
      }

      console.log(`[webhook/payout] ✗ Failed: ${withdrawalId}`);
      return res.status(200).json({ code: 0, msg: "noted_failed" });
    }

  } catch (error: any) {
    console.error("[webhook/payout] ❌ Webhook Execution Pipeline Crash Log:", error.message);
    console.error("[webhook/payout] ❌ Full error:", error.stack || error);
    return res.status(200).json({ 
      success: false, 
      error: error.message || "Internal server error",
      received: true  // Always return 200 so PKPay doesn't keep retrying
    });
  }
});

export default router;