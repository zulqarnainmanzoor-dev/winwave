import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../database/db';

const router = Router();

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.Webhook_secret || process.env.Payout_API_secret || "";

// PKPay HMAC-SHA256 signature verification
function verifySignature(body: Record<string, any>): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook/deposit] No WEBHOOK_SECRET configured — skipping signature verification");
    return true;
  }

  const { sign, ...rest } = body;
  
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
      console.warn("[webhook/deposit] Invalid signature — rejected");
    }
    return isValid;
  } catch (error) {
    console.error("[webhook/deposit] Signature verification error:", error);
    return false;
  }
}

router.post('/', async (req, res) => {
  try {
    // ═══════════════════════════════════════════════════════════════
    // RAW BODY CAPTURE
    // ═══════════════════════════════════════════════════════════════
    const rawBodyText = typeof req.body === 'object' 
      ? JSON.stringify(req.body) 
      : String(req.body || '');

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("👉 DEPOSIT WEBHOOK RECEIVED FROM GATEWAY");
    console.log("👉 RAW BODY:", rawBodyText);
    console.log("═══════════════════════════════════════════════════════════════════");

    if (!rawBodyText || rawBodyText === '{}' || rawBodyText === '""') {
      return res.status(200).json({ received: true, note: "Empty body." });
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      console.error("[webhook/deposit] ❌ JSON PARSE FAILED:", parseError.message);
      return res.status(200).json({ received: true, note: "JSON parse failed — logged" });
    }

    if (!verifySignature(payload)) {
      console.warn("[webhook/deposit] ⛔ SIGNATURE MISMATCH");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // ── Extract deposit event fields ──────────────────────────────
    // PKPay deposit webhook sends: out_trade_no, status, amount, user_id, sign
    const { out_trade_no, status, amount: rawAmount, user_id } = payload;
    const depositAmount = Number(rawAmount || 0);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/deposit] out_trade_no=${out_trade_no} status=${status} amount=${depositAmount} user_id=${user_id}`);

    if (!out_trade_no) {
      return res.status(200).json({ received: true, note: "Missing out_trade_no" });
    }

    // ── Check if already processed (idempotency) ──────────────────
    const { data: existingTx } = await supabaseAdmin
      .from("deposit_history")
      .select("id, status")
      .eq("order_id", out_trade_no)
      .maybeSingle();

    if (existingTx?.status === "completed") {
      console.log(`[webhook/deposit] ⏭️ ${out_trade_no} already processed — skipping`);
      return res.status(200).json({ code: 0, msg: "already_processed" });
    }

    if (!isSuccess || depositAmount <= 0) {
      // Mark as failed if exists
      if (existingTx) {
        await supabaseAdmin
          .from("deposit_history")
          .update({ status: "failed", remarks: `PKPay deposit failed (status=${status})`, updated_at: new Date().toISOString() })
          .eq("id", existingTx.id);
      }
      console.log(`[webhook/deposit] ✗ Failed deposit: ${out_trade_no}`);
      return res.status(200).json({ code: 0, msg: "noted_failed" });
    }

    // ── PROCESS SUCCESSFUL DEPOSIT WITH 2% BONUS ─────────────────
    // Calculate: Total = Deposit Amount + (Deposit Amount × 0.02)
    const bonusAmount = depositAmount * 0.02;  // 2% bonus
    const totalAmount = depositAmount + bonusAmount;  // Deposit + 2% bonus

    console.log(`[webhook/deposit] 💰 Processing deposit: amount=${depositAmount}, bonus=${bonusAmount}, total=${totalAmount}`);

    // ── Determine user_id from payload or from deposit_history ────
    let targetUserId = user_id || null;
    
    // If we have an existing pending deposit, get user_id from it
    if (!targetUserId && existingTx?.id) {
      const { data: deposit } = await supabaseAdmin
        .from("deposit_history")
        .select("user_id")
        .eq("id", existingTx.id)
        .single();
      targetUserId = deposit?.user_id || null;
    }

    if (!targetUserId) {
      console.error(`[webhook/deposit] ❌ No user_id found for ${out_trade_no}`);
      return res.status(200).json({ received: true, note: "No user_id" });
    }

    // ── FECTH CURRENT BALANCE FROM USERS TABLE ────────────────────
    const { data: userRow, error: userFetchError } = await supabaseAdmin
      .from("users")
      .select("id, main_balance")
      .eq("id", targetUserId)
      .single();

    if (userFetchError || !userRow) {
      console.error(`[webhook/deposit] ❌ User not found: ${targetUserId}`, userFetchError);
      return res.status(200).json({ received: true, note: "User not found" });
    }

    const currentBalance = Number(userRow.main_balance || 0);
    const newBalance = currentBalance + totalAmount;

    // ── UPDATE deposit_history (insert or update to completed) ────
    if (existingTx?.id) {
      await supabaseAdmin
        .from("deposit_history")
        .update({
          status: "completed",
          amount: depositAmount,
          gateway_ref: `pkpay:${out_trade_no}`,
          remarks: `Deposit Rs ${depositAmount} + 200% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTx.id);
    } else {
      await supabaseAdmin
        .from("deposit_history")
        .insert({
          user_id: targetUserId,
          amount: depositAmount,
          method: "PKPAY",
          order_id: out_trade_no,
          status: "completed",
          gateway_ref: `pkpay:${out_trade_no}`,
          remarks: `Deposit Rs ${depositAmount} + 200% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    // ── INCREMENT users.main_balance by total (deposit + bonus) ───
    const { error: balanceUpdateError } = await supabaseAdmin
      .from("users")
      .update({ main_balance: newBalance })
      .eq("id", targetUserId);

    if (balanceUpdateError) {
      console.error(`[webhook/deposit] ❌ Failed to update balance for ${targetUserId}:`, balanceUpdateError);
      return res.status(500).json({ error: "Balance update failed" });
    }

    console.log(`[webhook/deposit] ✅ Balance updated: ${currentBalance} → ${newBalance} (+${totalAmount})`);

    // ── INSERT INTO transactions for history ───────────────────────
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: targetUserId,
        type: "deposit",
        amount: depositAmount,
        bonus: bonusAmount,
        status: "completed",
        gateway_ref: `pkpay:${out_trade_no}`,
        created_at: new Date().toISOString(),
      });

    console.log(`[webhook/deposit] ✅ Deposit completed: ${out_trade_no} — User ${targetUserId} got Rs ${totalAmount} (${depositAmount} + ${bonusAmount} bonus)`);

    return res.status(200).json({ code: 0, msg: "success" });

  } catch (error: any) {
    console.error("[webhook/deposit] ❌ Critical error:", error.message);
    console.error("[webhook/deposit] ❌ Stack:", error.stack || error);
    return res.status(200).json({ success: false, error: error.message, received: true });
  }
});

export default router;