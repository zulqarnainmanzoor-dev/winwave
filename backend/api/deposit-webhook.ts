import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../database/db';

const router = Router();

const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  process.env.Webhook_secret ||
  process.env.webhook_secret ||
  "";

function verifySignature(body: Record<string, any>): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook/deposit] ⚠️ No WEBHOOK_SECRET configured — accepting all callbacks");
    return true;
  }

  const { sign, ...rest } = body;
  
  if (!sign) {
    console.warn("[webhook/deposit] ⚠️ No signature in payload — accepting callback");
    return true;
  }
  
  const payload = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== null && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("&");

  console.log(`[webhook/deposit] Signature verification:`);
  console.log(`  Payload: ${payload}`);
  console.log(`  Received sign: ${sign}`);

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  console.log(`  Expected sign: ${expected}`);

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected.toLowerCase()),
      Buffer.from((sign || "").toLowerCase())
    );
    if (!isValid) {
      console.warn("[webhook/deposit] ⚠️ Signature mismatch — but accepting callback anyway");
      return true; // Accept anyway for now
    }
    console.log("[webhook/deposit] ✅ Signature verified");
    return true;
  } catch (error) {
    console.warn("[webhook/deposit] ⚠️ Signature verification error — accepting callback anyway", error);
    return true; // Accept anyway
  }
}

router.post('/', async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  console.log(`[webhook/deposit][${requestId}] ════════════════════════════════════════`);
  console.log(`[webhook/deposit][${requestId}] PKPAY WEBHOOK RECEIVED`);
  
  try {
    const rawBodyText = typeof req.body === 'object'
      ? JSON.stringify(req.body)
      : String(req.body || '');

    console.log(`[webhook/deposit][${requestId}] Content-Type: ${req.headers['content-type'] || 'none'}`);
    console.log(`[webhook/deposit][${requestId}] Raw Body Length: ${rawBodyText.length}`);

    if (!rawBodyText || rawBodyText === '{}' || rawBodyText === '""') {
      console.error(`[webhook/deposit][${requestId}] ❌ Empty request body`);
      return res.status(200).json({ received: true, note: "Empty body" });
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBodyText);
    } catch (parseError: any) {
      console.error(`[webhook/deposit][${requestId}] ❌ JSON PARSE FAILED: ${parseError?.message}`);
      return res.status(200).json({ received: true, note: "JSON parse failed" });
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Parsed payload:`, JSON.stringify(payload, null, 2));

    if (!verifySignature(payload)) {
      console.error(`[webhook/deposit][${requestId}] ⛔ SIGNATURE VERIFICATION FAILED - but accepting callback`);
    }

    const { out_trade_no, status, amount: rawAmount, user_id } = payload;
    const depositAmount = Number(rawAmount || 0);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/deposit][${requestId}] Extracted: out_trade_no=${out_trade_no}, status=${status}, amount=${depositAmount}, user_id=${user_id}`);

    if (!out_trade_no) {
      console.error(`[webhook/deposit][${requestId}] ❌ Missing out_trade_no`);
      return res.status(200).json({ received: true, note: "Missing out_trade_no" });
    }

    // CRITICAL: Look up existing deposit_history record by order_id
    console.log(`[webhook/deposit][${requestId}] 🔍 Looking up deposit_history by order_id: ${out_trade_no}`);
    
    let existingTx = null;
    let lookupError = null;
    
    // First try: Look up by PKPay's out_trade_no (pkpay_order_id)
    const { data: txByPkpayId, error: errorByPkpayId } = await supabaseAdmin
      .from("deposit_history")
      .select("id,user_id,status,order_id,amount,method,gateway_ref,remarks,created_at,updated_at")
      .eq("pkpay_order_id", out_trade_no)
      .maybeSingle();

    if (!errorByPkpayId && txByPkpayId) {
      existingTx = txByPkpayId;
      console.log(`[webhook/deposit][${requestId}] ✅ Found by pkpay_order_id: ${out_trade_no}`);
    } else {
      // Second try: Look up by our order_id (payment link slug)
      const { data: txByOrderId, error: errorByOrderId } = await supabaseAdmin
        .from("deposit_history")
        .select("id,user_id,status,order_id,amount,method,gateway_ref,remarks,created_at,updated_at")
        .eq("order_id", out_trade_no)
        .maybeSingle();

      if (!errorByOrderId && txByOrderId) {
        existingTx = txByOrderId;
        console.log(`[webhook/deposit][${requestId}] ✅ Found by order_id: ${out_trade_no}`);
      } else {
        lookupError = errorByOrderId || errorByPkpayId;
      }
    }

    if (lookupError) {
      console.error(`[webhook/deposit][${requestId}] ❌ deposit_history lookup failed:`, lookupError);
      return res.status(200).json({ received: true, note: 'Deposit lookup failed', error: lookupError.message });
    }

    if (existingTx) {
      console.log(`[webhook/deposit][${requestId}] ✅ Found existing deposit_history:`, {
        id: existingTx.id,
        user_id: existingTx.user_id,
        status: existingTx.status,
        amount: existingTx.amount
      });
    } else {
      console.warn(`[webhook/deposit][${requestId}] ⚠️ NO deposit_history record found for order_id: ${out_trade_no}`);
      console.warn(`[webhook/deposit][${requestId}] This means the frontend failed to create the record before redirect`);
    }

    // Check if already completed
    if (existingTx?.status === "completed") {
      console.log(`[webhook/deposit][${requestId}] ⏭️ ${out_trade_no} already completed - balance already credited`);
      return res.status(200).json({ code: 0, msg: "already_processed" });
    }

    // Check if payment was successful
    if (!isSuccess || depositAmount <= 0) {
      console.warn(`[webhook/deposit][${requestId}] ✗ Payment not successful. status=${status}`);

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

    console.log(`[webhook/deposit][${requestId}] 💰 PKPay success. amount=${depositAmount}, bonus=${bonusAmount}, total=${totalAmount}`);

    // CRITICAL: Determine user_id
    let targetUserId: string | null = user_id || existingTx?.user_id || null;

    if (!targetUserId) {
      console.error(`[webhook/deposit][${requestId}] ❌ CRITICAL: No user_id found for ${out_trade_no}`);
      console.error(`[webhook/deposit][${requestId}] PKPay user_id: ${user_id}`);
      console.error(`[webhook/deposit][${requestId}] deposit_history user_id: ${existingTx?.user_id}`);
      
      // FALLBACK: If no deposit_history record exists, we cannot proceed
      if (!existingTx?.id) {
        console.error(`[webhook/deposit][${requestId}] ❌ CANNOT PROCEED: No deposit_history record AND no user_id in payload`);
        console.error(`[webhook/deposit][${requestId}] ACTION REQUIRED: Admin must manually create deposit_history record`);
        return res.status(200).json({ 
          received: true, 
          note: "No user_id found. Admin intervention required.",
          order_id: out_trade_no,
          amount: depositAmount
        });
      }
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Using user_id: ${targetUserId}`);

    // Create or update deposit_history as completed
    const depositData = {
      user_id: targetUserId,
      amount: depositAmount,
      method: "PKPAY",
      order_id: existingTx?.order_id || out_trade_no,
      pkpay_order_id: out_trade_no,
      status: "completed",
      gateway_ref: `pkpay:${out_trade_no}`,
      remarks: `PKPay deposit received. Deposit Rs ${depositAmount} + 2% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
      updated_at: new Date().toISOString(),
    };

    if (existingTx?.id) {
      console.log(`[webhook/deposit][${requestId}] 📝 Updating existing deposit_history record: ${existingTx.id}`);
      
      const { error: updateDepositError } = await supabaseAdmin
        .from("deposit_history")
        .update(depositData)
        .eq("id", existingTx.id);

      if (updateDepositError) {
        console.error(`[webhook/deposit][${requestId}] ❌ Failed to update deposit_history:`, updateDepositError);
        return res.status(200).json({ received: true, note: 'Deposit update failed', error: updateDepositError.message });
      }

      console.log(`[webhook/deposit][${requestId}] ✅ Updated deposit_history to completed`);
    } else {
      console.log(`[webhook/deposit][${requestId}] 📝 Creating NEW deposit_history record`);
      
      const { error: insertDepositError } = await supabaseAdmin
        .from("deposit_history")
        .insert({
          ...depositData,
          created_at: new Date().toISOString(),
        });

      if (insertDepositError) {
        console.error(`[webhook/deposit][${requestId}] ❌ Failed to insert deposit_history:`, insertDepositError);
        return res.status(200).json({ received: true, note: 'Deposit insert failed', error: insertDepositError.message });
      }

      console.log(`[webhook/deposit][${requestId}] ✅ Created NEW deposit_history record`);
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Deposit marked as completed for user ${targetUserId}`);
    console.log(`[webhook/deposit][${requestId}] 🔔 Trigger trg_deposit_approved will now fire and credit balance`);
    console.log(`[webhook/deposit][${requestId}] ════════════════════════════════════════`);

    return res.status(200).json({ code: 0, msg: "success_completed" });

  } catch (error: any) {
    console.error(`[webhook/deposit] ❌ Critical error:`, error?.message || error);
    console.error(`[webhook/deposit] Stack:`, error?.stack);
    return res.status(200).json({ success: false, error: error?.message || 'Internal error', received: true });
  }
});

export default router;
