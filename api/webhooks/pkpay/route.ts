// api/webhooks/pkpay/route.ts
// PKPay Deposit Webhook Handler with 2% Bonus
// Webhook URL: POST /api/webhooks/pkpay

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_SECRET = process.env.Webhook_secret || process.env.Pay_in_API_secret || "";

// PKPay HMAC-SHA256 signature verification
function verifySignature(body: Record<string, any>): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook/pkpay] No WEBHOOK_SECRET configured — skipping signature verification");
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
      console.warn("[webhook/pkpay] Invalid signature — rejected");
    }

    return isValid;
  } catch (error) {
    console.error("[webhook/pkpay] Signature verification error:", error);
    return false;
  }
}

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawBodyText = JSON.stringify(body);

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("👉 PKPAY DEPOSIT WEBHOOK RECEIVED");
    console.log("👉 RAW BODY:", rawBodyText);
    console.log("═══════════════════════════════════════════════════════════════════");

    // Verify signature
    if (!verifySignature(body)) {
      console.warn("[webhook/pkpay] ⛔ SIGNATURE MISMATCH");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Extract fields
    const { out_trade_no, status, amount: rawAmount, user_id } = body;
    const depositAmount = Number(rawAmount || 0);
    const isSuccess = ["success", "SUCCESS", "1", "SUCCESSFUL"].includes(String(status).toUpperCase());

    console.log(`[webhook/pkpay] out_trade_no=${out_trade_no} status=${status} amount=${depositAmount} user_id=${user_id}`);

    if (!out_trade_no) {
      return new Response(JSON.stringify({ received: true, note: "Missing out_trade_no" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check if already processed (idempotency)
    const { data: existingTx } = await supabase
      .from("deposit_history")
      .select("id, status, user_id")
      .eq("order_id", out_trade_no)
      .maybeSingle();

    if (existingTx?.status === "completed") {
      console.log(`[webhook/pkpay] ⏭️ ${out_trade_no} already processed — skipping`);
      return new Response(JSON.stringify({ code: 0, msg: "already_processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle failed deposits
    if (!isSuccess || depositAmount <= 0) {
      if (existingTx?.id) {
        await supabase
          .from("deposit_history")
          .update({
            status: "failed",
            remarks: `PKPay deposit failed (status=${status})`,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingTx.id);
      }
      console.log(`[webhook/pkpay] ✗ Failed deposit: ${out_trade_no}`);
      return new Response(JSON.stringify({ code: 0, msg: "noted_failed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PROCESS SUCCESSFUL DEPOSIT WITH 2% BONUS
    // ═══════════════════════════════════════════════════════════════
    const bonusAmount = depositAmount * 0.02;  // 2% bonus
    const totalAmount = depositAmount + bonusAmount;  // Deposit + 2% bonus

    console.log(`[webhook/pkpay] 💰 Processing deposit: amount=${depositAmount}, bonus=${bonusAmount}, total=${totalAmount}`);

    // Determine user_id
    let targetUserId = user_id || null;

    if (!targetUserId && existingTx?.user_id) {
      targetUserId = existingTx.user_id;
    }

    if (!targetUserId) {
      console.error(`[webhook/pkpay] ❌ No user_id found for ${out_trade_no}`);
      return new Response(JSON.stringify({ received: true, note: "No user_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch current balance
    const { data: userRow, error: userFetchError } = await supabase
      .from("users")
      .select("id, main_balance")
      .eq("id", targetUserId)
      .single();

    if (userFetchError || !userRow) {
      console.error(`[webhook/pkpay] ❌ User not found: ${targetUserId}`, userFetchError);
      return new Response(JSON.stringify({ received: true, note: "User not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const currentBalance = Number(userRow.main_balance || 0);
    const newBalance = currentBalance + totalAmount;

    // Update deposit_history
    if (existingTx?.id) {
      await supabase
        .from("deposit_history")
        .update({
          status: "completed",
          amount: depositAmount,
          gateway_ref: `pkpay:${out_trade_no}`,
          remarks: `Deposit Rs ${depositAmount} + 2% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTx.id);
    } else {
      await supabase
        .from("deposit_history")
        .insert({
          user_id: targetUserId,
          amount: depositAmount,
          method: "PKPAY",
          order_id: out_trade_no,
          status: "completed",
          gateway_ref: `pkpay:${out_trade_no}`,
          remarks: `Deposit Rs ${depositAmount} + 2% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    // Update user balance
    const { error: balanceUpdateError } = await supabase
      .from("users")
      .update({ main_balance: newBalance })
      .eq("id", targetUserId);

    if (balanceUpdateError) {
      console.error(`[webhook/pkpay] ❌ Failed to update balance for ${targetUserId}:`, balanceUpdateError);
      return new Response(JSON.stringify({ error: "Balance update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`[webhook/pkpay] ✅ Balance updated: ${currentBalance} → ${newBalance} (+${totalAmount})`);

    // Insert transaction record
    await supabase
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

    console.log(`[webhook/pkpay] ✅ Deposit completed: ${out_trade_no} — User ${targetUserId} got Rs ${totalAmount}`);

    return new Response(JSON.stringify({
      code: 0,
      msg: "success",
      data: {
        user_id: targetUserId,
        deposit_amount: depositAmount,
        bonus_amount: bonusAmount,
        total_amount: totalAmount,
        new_balance: newBalance
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[webhook/pkpay] ❌ Critical error:", error.message);
    console.error("[webhook/pkpay] ❌ Stack:", error.stack || error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      received: true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}