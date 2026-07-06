import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../database/db';

const router = Router();

// Webhook secret for signature verification
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  process.env.Webhook_secret ||
  process.env.webhook_secret ||
  "";

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
  const requestId = crypto.randomBytes(8).toString('hex');
  console.log(`[webhook/deposit][${requestId}] PKPAY WEBHOOK HIT`);
  
  try {
    // RAW BODY CAPTURE
    const rawBodyText = typeof req.body === 'object'
      ? JSON.stringify(req.body)
      : String(req.body || '');

    console.log(`[webhook/deposit][${requestId}] 👉 DEPOSIT WEBHOOK RECEIVED`);
    console.log(`[webhook/deposit][${requestId}] 👉 CONTENT-TYPE:`, req.headers['content-type'] || 'none');
    console.log(`[webhook/deposit][${requestId}] 👉 RAW BODY LENGTH:`, rawBodyText.length);

    if (!rawBodyText || rawBodyText === '{}' || rawBodyText === '""') {
      console.error(`[webhook/deposit][${requestId}] ❌ Empty request body`);
      return res.status(200).json({ received: true, note: "Empty body" });
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      console.error(`[webhook/deposit][${requestId}] ❌ JSON PARSE FAILED:`, parseError?.message);
      return res.status(200).json({ received: true, note: "JSON parse failed" });
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Parsed payload:`, JSON.stringify(payload, null, 2));

    if (!verifySignature(payload)) {
      console.error(`[webhook/deposit][${requestId}] ⛔ SIGNATURE MISMATCH`);
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Extract deposit event fields
    const { out_trade_no, status, amount: rawAmount, user_id } = payload;
    const depositAmount = Number(rawAmount || 0);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/deposit][${requestId}] extracted: out_trade_no=${out_trade_no} status=${status} amount=${depositAmount} user_id=${user_id}`);

    if (!out_trade_no) {
      console.error(`[webhook/deposit][${requestId}] ❌ Missing out_trade_no`);
      return res.status(200).json({ received: true, note: "Missing out_trade_no" });
    }

    // Check if already processed (idempotency)
    const { data: existingTx, error: existingTxError } = await supabaseAdmin
      .from("deposit_history")
      .select("id,user_id,status,order_id,amount,method,gateway_ref,remarks,created_at,updated_at")
      .eq("order_id", out_trade_no)
      .maybeSingle();

    if (existingTxError) {
      console.error(`[webhook/deposit][${requestId}] ❌ deposit_history lookup failed:`, existingTxError);
      return res.status(500).json({ error: 'Deposit lookup failed' });
    }

    if (existingTx?.status === "completed") {
      console.log(`[webhook/deposit][${requestId}] ⏭️ ${out_trade_no} already completed - balance already credited`);
      return res.status(200).json({ code: 0, msg: "already_processed" });
    }

    if (!isSuccess || depositAmount <= 0) {
      console.warn(`[webhook/deposit][${requestId}] ✗ Not successful. status=${status}`);

      if (existingTx?.id) {
        const { error: updateFailError } = await supabaseAdmin
          .from("deposit_history")
          .update({
            status: "failed",
            remarks: `PKPay deposit failed (status=${status})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTx.id);

        if (updateFailError) {
          console.error(`[webhook/deposit][${requestId}] ❌ Failed to mark deposit as failed:`, updateFailError);
        }
      }

      return res.status(200).json({ code: 0, msg: "noted_failed" });
    }

    // Calculate bonus
    const bonusAmount = depositAmount * 0.02;
    const totalAmount = depositAmount + bonusAmount;

    console.log(`[webhook/deposit][${requestId}] 💰 PKPay success. amount=${depositAmount}, bonus=${bonusAmount}`);

    // Determine user_id
    let targetUserId: string | null = user_id || existingTx?.user_id || null;

    if (!targetUserId) {
      console.error(`[webhook/deposit][${requestId}] ❌ No user_id found for ${out_trade_no}`);
      return res.status(200).json({ received: true, note: "No user_id" });
    }

    // Create or update deposit_history as completed (PKPay confirmed success)
    const depositData = {
      user_id: targetUserId,
      amount: depositAmount,
      method: "PKPAY",
      order_id: out_trade_no,
      status: "completed",
      gateway_ref: `pkpay:${out_trade_no}`,
      remarks: `PKPay deposit received. Deposit Rs ${depositAmount} + 2% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
      updated_at: new Date().toISOString(),
    };

    if (existingTx?.id) {
      const { error: updateDepositError } = await supabaseAdmin
        .from("deposit_history")
        .update(depositData)
        .eq("id", existingTx.id);

      if (updateDepositError) {
        console.error(`[webhook/deposit][${requestId}] ❌ Failed to update deposit_history:`, updateDepositError);
        return res.status(500).json({ error: 'Deposit update failed' });
      }
    } else {
      const { error: insertDepositError } = await supabaseAdmin
        .from("deposit_history")
        .insert({
          ...depositData,
          created_at: new Date().toISOString(),
        });

      if (insertDepositError) {
        console.error(`[webhook/deposit][${requestId}] ❌ Failed to insert deposit_history:`, insertDepositError);
        return res.status(500).json({ error: 'Deposit insert failed' });
      }
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Stored as completed for user ${targetUserId}`);

    return res.status(200).json({ code: 0, msg: "success_completed" });

  } catch (error: any) {
    console.error(`[webhook/deposit] ❌ Critical error:`, error?.message || error);
    return res.status(200).json({ success: false, error: error?.message || 'Internal error', received: true });
  }
});

export default router;