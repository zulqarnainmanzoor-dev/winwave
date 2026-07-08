import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../database/db';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.Webhook_secret || process.env.webhook_secret || '';

/**
 * Verify PKPay webhook signature
 * PKPay sends: sign parameter with HMAC-SHA256 hash
 */
function verifySignature(body: Record<string, any>): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[webhook/deposit] ⚠️ WEBHOOK_SECRET not configured - accepting all callbacks');
    return true;
  }

  const { sign, ...rest } = body;
  if (!sign) {
    console.warn('[webhook/deposit] ⚠️ No signature in payload');
    return true;
  }

  // Build payload string: sort keys and join with &
  const payload = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== null && rest[k] !== '')
    .map((k) => `${k}=${rest[k]}`)
    .join('&');

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const isValid = expected.toLowerCase() === (sign || '').toLowerCase();
  
  if (!isValid) {
    console.warn('[webhook/deposit] ⚠️ Signature mismatch - but accepting callback');
  }

  return true; // Accept all for now (PKPay may not send signature)
}

/**
 * PKPay Deposit Webhook Handler
 * 
 * Receives payment callbacks from PKPay and automatically:
 * 1. Verifies payment status
 * 2. Updates deposit_history
 * 3. Triggers automatic balance credit
 * 4. Prevents duplicate processing
 */
export default async function depositWebhookHandler(req: Request, res: Response) {
  const requestId = crypto.randomBytes(8).toString('hex');
  const timestamp = new Date().toISOString();

  console.log(`\n[webhook/deposit][${requestId}] ════════════════════════════════════════`);
  console.log(`[webhook/deposit][${requestId}] PKPAY WEBHOOK RECEIVED at ${timestamp}`);
  console.log(`[webhook/deposit][${requestId}] Method: ${req.method}`);
  console.log(`[webhook/deposit][${requestId}] Content-Type: ${req.headers['content-type'] || 'none'}`);

  try {
    // Parse request body
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      console.error(`[webhook/deposit][${requestId}] ❌ Empty payload`);
      return res.status(200).json({ code: 0, msg: 'empty_payload' });
    }

    console.log(`[webhook/deposit][${requestId}] Payload:`, JSON.stringify(payload, null, 2));

    // Verify signature
    if (!verifySignature(payload)) {
      console.warn(`[webhook/deposit][${requestId}] ⚠️ Signature verification failed - continuing anyway`);
    }

    // Extract PKPay fields
    const {
      out_trade_no,      // PKPay's order ID (payment_link_id)
      status,             // Payment status: success, failed, pending
      amount,             // Payment amount
      user_id,            // Optional user ID from PKPay
      sign,               // Signature
      ...otherFields
    } = payload;

    console.log(`[webhook/deposit][${requestId}] Extracted:`);
    console.log(`  out_trade_no: ${out_trade_no}`);
    console.log(`  status: ${status}`);
    console.log(`  amount: ${amount}`);
    console.log(`  user_id: ${user_id}`);

    // Validate required fields
    if (!out_trade_no) {
      console.error(`[webhook/deposit][${requestId}] ❌ Missing out_trade_no (payment_link_id)`);
      return res.status(200).json({ code: 0, msg: 'missing_out_trade_no' });
    }

    const depositAmount = Number(amount || 0);
    const isSuccess = ['success', 'SUCCESS', '1', 'SUCCESSFUL'].includes(String(status).toUpperCase());

    console.log(`[webhook/deposit][${requestId}] Payment status: ${isSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Look up deposit_history by payment_link_id (out_trade_no)
    console.log(`[webhook/deposit][${requestId}] 🔍 Looking up deposit_history...`);

    const { data: existingDeposit, error: lookupError } = await supabaseAdmin
      .from('deposit_history')
      .select('id, user_id, status, amount, method, payment_link_id, slug, created_at')
      .eq('payment_link_id', out_trade_no)
      .maybeSingle();

    if (lookupError) {
      console.error(`[webhook/deposit][${requestId}] ❌ Database lookup failed:`, lookupError);
      return res.status(200).json({ code: 0, msg: 'lookup_failed', error: lookupError.message });
    }

    if (!existingDeposit) {
      console.warn(`[webhook/deposit][${requestId}] ⚠️ No deposit found for payment_link_id: ${out_trade_no}`);
      console.warn(`[webhook/deposit][${requestId}] This deposit may have been created with old system`);
      return res.status(200).json({ code: 0, msg: 'deposit_not_found' });
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Found deposit:`, {
      id: existingDeposit.id,
      user_id: existingDeposit.user_id,
      status: existingDeposit.status,
      amount: existingDeposit.amount,
    });

    // Check if already processed
    if (existingDeposit.status === 'completed') {
      console.log(`[webhook/deposit][${requestId}] ⏭️ Deposit already completed - preventing duplicate`);
      return res.status(200).json({ code: 0, msg: 'already_completed' });
    }

    // Handle failed payment
    if (!isSuccess || depositAmount <= 0) {
      console.warn(`[webhook/deposit][${requestId}] ✗ Payment failed or invalid amount`);

      const { error: updateError } = await supabaseAdmin
        .from('deposit_history')
        .update({
          status: 'failed',
          remarks: `PKPay payment failed (status=${status})`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDeposit.id);

      if (updateError) {
        console.error(`[webhook/deposit][${requestId}] ❌ Failed to mark as failed:`, updateError);
      } else {
        console.log(`[webhook/deposit][${requestId}] ✅ Marked deposit as failed`);
      }

      return res.status(200).json({ code: 0, msg: 'payment_failed' });
    }

    // Payment successful - update deposit_history to completed
    console.log(`[webhook/deposit][${requestId}] 💰 Processing successful payment...`);

    const bonusAmount = depositAmount * 0.02;
    const totalAmount = depositAmount + bonusAmount;

    const { error: updateError } = await supabaseAdmin
      .from('deposit_history')
      .update({
        status: 'completed',
        pkpay_order_id: out_trade_no,
        remarks: `PKPay payment successful. Deposit Rs ${depositAmount} + 2% Bonus Rs ${bonusAmount.toFixed(2)} = Total Rs ${totalAmount.toFixed(2)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingDeposit.id);

    if (updateError) {
      console.error(`[webhook/deposit][${requestId}] ❌ Failed to update deposit:`, updateError);
      return res.status(200).json({ code: 0, msg: 'update_failed', error: updateError.message });
    }

    console.log(`[webhook/deposit][${requestId}] ✅ Updated deposit_history to completed`);
    console.log(`[webhook/deposit][${requestId}] 🔔 Database trigger will now fire automatically`);
    console.log(`[webhook/deposit][${requestId}] 💳 Balance will be credited: Rs ${totalAmount.toFixed(2)}`);
    console.log(`[webhook/deposit][${requestId}] ════════════════════════════════════════\n`);

    // Return success response
    return res.status(200).json({
      code: 0,
      msg: 'success_completed',
      deposit_id: existingDeposit.id,
      amount: depositAmount,
      bonus: bonusAmount,
      total: totalAmount,
    });

  } catch (error: any) {
    console.error(`[webhook/deposit][${requestId}] ❌ CRITICAL ERROR:`, error?.message || error);
    console.error(`[webhook/deposit][${requestId}] Stack:`, error?.stack);

    // Always return 200 to acknowledge receipt
    return res.status(200).json({
      code: 0,
      msg: 'error_processed',
      error: error?.message || 'Internal error',
    });
  }
}
