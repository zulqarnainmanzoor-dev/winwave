import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin, isServiceRoleKey, Database } from '../database/db';

const router = Router();

// PKPay Configuration from environment variables
const PAYOUT_API_KEY    = process.env.Payout_API_key;
const PAYOUT_API_SECRET = process.env.Payout_API_secret;
const MERCHANT_ID       = process.env.Merchant_ID;
const ADMIN_SECRET_TOKEN = process.env.ADMIN_INTERNAL_MUTATION_KEY;

// PKPay payout endpoint
const PKPAY_PAYOUT_URL = "https://api.pkpay.com/v1/payout";

function buildSignature(params: Record<string, any>): string {
  // PKPay signature: HMAC-SHA256 of sorted key=value pairs joined by &
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto
    .createHmac("sha256", PAYOUT_API_SECRET || "")
    .update(sorted)
    .digest("hex");
}

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const { withdrawal_id, adminSecretToken } = body;

    console.log('[payout] Request received:', { withdrawal_id, hasToken: !!adminSecretToken });
    console.log('[payout] Env check - ADMIN_SECRET_TOKEN:', !!ADMIN_SECRET_TOKEN);

    // 1. Enforce rigorous security handshake checking
    if (!withdrawal_id || !ADMIN_SECRET_TOKEN || adminSecretToken !== ADMIN_SECRET_TOKEN) {
      console.log('[payout] Auth failed - withdrawal_id:', !!withdrawal_id, 'token match:', adminSecretToken === ADMIN_SECRET_TOKEN);
      return res.status(401).json({ success: false, error: "Unauthorized endpoint execution." });
    }

    console.log(`[payout] Initiating secure payout for withdrawal_id: ${withdrawal_id}`);

    // 2. Fetch specific pending data entry row from withdrawal_history table
    const { data: withdrawalRequest, error: fetchError } = await supabaseAdmin
      .from("withdrawal_history")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error("[payout] Fetch error:", fetchError);
      return res.status(404).json({ success: false, error: "Target transaction record not found." });
    }

    const withdrawal = withdrawalRequest as Database['public']['Tables']['withdrawal_history']['Row'];
    const requestStatus = withdrawal.status;

    // ── Handle "already_processed" gracefully ──────────────────────
    // If the RPC already set it to 'processing' (from a previous attempt),
    // don't reject — instead, check if the gateway already processed it.
    if (requestStatus === "completed") {
      return res.status(200).json({
        success: true,
        gateway_ref: withdrawal.gateway_ref,
        message: "Withdrawal was already completed successfully."
      });
    }

    if (requestStatus === "processing") {
      // This means the RPC was called but the payout request may have failed
      // or the webhook never arrived. Try to process it again.
      console.log(`[payout] Withdrawal ${withdrawal_id} is already in 'processing' status — retrying payout.`);
    } else if (requestStatus !== "pending" && requestStatus !== "approved") {
      return res.status(400).json({ 
        success: false, 
        error: `Transaction has already been processed or finalized (status: ${requestStatus}).` 
      });
    }

    // 3. EXECUTE STRUCTURAL PAYLOAD COMPILATION DIRECT TO PKPAY API MERCHANT GATEWAY
    // Map method to PKPay channel code
    const channelMap: Record<string, string> = { JAZZCASH: "JC", EASYPAISA: "EP", jazzcash: "JC", easypaisa: "EP" };
    const requestMethod = withdrawal.method;
    const channel = channelMap[String(requestMethod || '').toUpperCase()] || requestMethod;

    // Use withdrawal ID as idempotency key so PKPay doesn't process duplicates
    const idempotencyKey = withdrawal.id;

    const params = {
      merchant_id:    MERCHANT_ID,
      out_trade_no:   withdrawal.id,          // our withdrawal UUID as idempotency key
      amount:         Number(withdrawal.amount).toFixed(2),
      channel,
      account_number: withdrawal.account_no,
      account_name:   withdrawal.account_name || "",
      timestamp:      Math.floor(Date.now() / 1000).toString(),
      nonce_str:      crypto.randomBytes(8).toString("hex"),
    };

    (params as any).sign = buildSignature(params);

    // NOTE: Status is already set to 'processing' by the approve_withdrawal RPC
    // called from the admin dashboard. We do NOT set it again here to avoid
    // overwriting any status changes that happened between the RPC and now.

    console.log(`[payout] Initiating outbound API secure transfer to PKPAY cluster for order ID: ${withdrawal.id}`);

    const gatewayResponse = await fetch(PKPAY_PAYOUT_URL, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "Authorization":   `Bearer ${PAYOUT_API_KEY}`,
        "Idempotency-Key": String(idempotencyKey),  // Prevent duplicate processing
      },
      body: JSON.stringify(params),
    });

    // Content-type check layer to handle and resolve the "Unexpected end of JSON input" crash issue permanently
    const contentType = gatewayResponse.headers.get("content-type");
    let gatewayResult: any;

    if (contentType && contentType.includes("application/json")) {
      const textResponse = await gatewayResponse.text();
      gatewayResult = textResponse ? JSON.parse(textResponse) : null;
    } else {
      const plainErrorText = await gatewayResponse.text();
      console.error("[payout] Non-JSON response from gateway:", plainErrorText);
      
      // Revert status from processing to pending
      await supabaseAdmin
        .from("withdrawal_history")
        .update({ 
          status: "pending", 
          gateway_error_logs: `Gateway returned non-JSON response: ${plainErrorText.substring(0, 200)}`,
          updated_at: new Date().toISOString()
        } as unknown as Database['public']['Tables']['withdrawal_history']['Update'])
        .eq("id", withdrawal_id);
      
      return res.status(500).json({ 
        success: false, 
        error: `Gateway returned non-JSON response: ${plainErrorText.substring(0, 200)}` 
      });
    }

    console.log(`[payout] Gateway response for ${withdrawal.id}:`, JSON.stringify(gatewayResult));

    // ── Handle "already processed" from gateway ────────────────────
    // If PKPay says "this was already processed", sync the status
    // instead of failing.
    const gatewayMsg = (gatewayResult?.msg || gatewayResult?.message || "").toLowerCase();
    const isAlreadyProcessed = gatewayMsg.includes("already") || 
                               gatewayMsg.includes("duplicate") ||
                               gatewayMsg.includes("exists") ||
                               gatewayResult?.code === 1001;  // PKPay duplicate code

    if (isAlreadyProcessed) {
      console.log(`[payout] Gateway reports ${withdrawal.id} was already processed — syncing status.`);
      
      // Mark as completed since the gateway already processed it
      const gatewayRef = gatewayResult?.data?.transaction_id || gatewayResult?.transaction_id || withdrawal.id;
      
      await supabaseAdmin
        .from("withdrawal_history")
        .update({ 
          status: "completed", 
          gateway_ref: gatewayRef,
          gateway_error_logs: null,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", withdrawal_id);

      return res.status(200).json({ 
        success: true, 
        gateway_ref: gatewayRef,
        message: "Payout was already processed by gateway. Status synced to completed." 
      });
    }

    // 4. TRANSACTION RESOLUTION PROCESSING SWITCH LAYER
    if (gatewayResponse.ok && (gatewayResult?.code === 0 || gatewayResult?.status === "success")) {
      // Update target user entry tracking rows to 'completed' or 'approved' state safely
      const gatewayRef = gatewayResult?.data?.transaction_id || gatewayResult?.transaction_id || withdrawal.id;
      
      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_history")
        .update({ 
          status: "completed", 
          gateway_ref: gatewayRef,
          gateway_error_logs: null,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", withdrawal_id);

      if (updateError) {
        console.error("[payout] Database update error:", updateError);
      }

      return res.status(200).json({ 
        success: true, 
        gateway_ref: gatewayRef,
        message: "Payout automatically transferred and synchronized successfully." 
      });
    } else {
      // If gateway returns any processing error, revert status to pending for admin retry
      const errorMessage = gatewayResult?.msg || gatewayResult?.message || gatewayResult?.error || "PKPAY Merchant wallet has insufficient funds (Balance 0).";
      
      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_history")
        .update({ 
          status: "pending", 
          gateway_error_logs: errorMessage,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", withdrawal_id);

      if (updateError) {
        console.error("[payout] Database update error:", updateError);
      }

      return res.status(400).json({ 
        success: false, 
        error: "Gateway Payout Failed: Please check merchant account balance on PKPAY." 
      });
    }

  } catch (error: any) {
    console.error("Critical Catch Failure within Payout Execution Pipeline:", error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || String(error) || 'Unknown error' });
  }
});

// Payout Webhook Handler - receives status updates from PKPay
router.post('/webhook', async (req, res) => {
  try {
    const { out_trade_no, status, transaction_id, error_msg } = req.body;

    if (!out_trade_no) {
      return res.status(400).json({ success: false, error: "Missing out_trade_no" });
    }

    console.log(`[payout-webhook] Received webhook for withdrawal ${out_trade_no}, status: ${status}`);

    // Map PKPay status to our status
    let updateStatus = 'pending';
    if (status === 'success' || status === 'completed') {
      updateStatus = 'completed';
    } else if (status === 'failed' || status === 'error') {
      updateStatus = 'rejected';
    }

    // Update withdrawal_history with webhook status
    const { error: updateError } = await supabaseAdmin
      .from('withdrawal_history')
      .update({
        status: updateStatus,
        gateway_ref: transaction_id || out_trade_no,
        gateway_error_logs: error_msg || null,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', out_trade_no);

    if (updateError) {
      console.error(`[payout-webhook] Failed to update withdrawal ${out_trade_no}:`, updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    console.log(`[payout-webhook] Successfully updated withdrawal ${out_trade_no} to status: ${updateStatus}`);
    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error: any) {
    console.error("[payout-webhook] Critical error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;