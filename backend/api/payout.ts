import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin, isServiceRoleKey, Database } from '../database/db';

const router = Router();

const PAYOUT_API_KEY    = process.env.Payout_API_key;
const PAYOUT_API_SECRET = process.env.Payout_API_secret;
const MERCHANT_ID       = process.env.Merchant_ID;
const ADMIN_SECRET_TOKEN = process.env.ADMIN_INTERNAL_MUTATION_KEY;

const PKPAY_PAYOUT_URL = "https://api.pkpay.com/v1/payout";

function buildSignature(params: Record<string, any>): string {
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

    if (!withdrawal_id || !ADMIN_SECRET_TOKEN || adminSecretToken !== ADMIN_SECRET_TOKEN) {
      console.log('[payout] Auth failed');
      return res.status(401).json({ success: false, error: "Unauthorized endpoint execution." });
    }

    console.log(`[payout] Initiating secure payout for withdrawal_id: ${withdrawal_id}`);

    try {
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

      if (requestStatus === "completed") {
        return res.status(200).json({
          success: true,
          gateway_ref: withdrawal.gateway_ref,
          message: "Withdrawal was already completed successfully."
        });
      }

      if (requestStatus === "processing") {
        console.log(`[payout] Withdrawal ${withdrawal_id} is already in 'processing' status — retrying payout.`);
      } else if (requestStatus !== "pending" && requestStatus !== "approved") {
        return res.status(400).json({ 
          success: false, 
          error: `Transaction has already been processed or finalized (status: ${requestStatus}).` 
        });
      }

      const channelMap: Record<string, string> = { JAZZCASH: "JC", EASYPAISA: "EP", jazzcash: "JC", easypaisa: "EP" };
      const requestMethod = withdrawal.method;
      const channel = channelMap[String(requestMethod || '').toUpperCase()] || requestMethod;
      const idempotencyKey = withdrawal.id;

      const params = {
        merchant_id:    MERCHANT_ID,
        out_trade_no:   withdrawal.id,
        amount:         Number(withdrawal.amount).toFixed(2),
        channel,
        account_number: withdrawal.account_no,
        account_name:   withdrawal.account_name || "",
        timestamp:      Math.floor(Date.now() / 1000).toString(),
        nonce_str:      crypto.randomBytes(8).toString("hex"),
      };

      (params as any).sign = buildSignature(params);

      console.log(`[payout] Initiating outbound API secure transfer to PKPAY cluster for order ID: ${withdrawal.id}`);

      const gatewayResponse = await fetch(PKPAY_PAYOUT_URL, {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "Authorization":   `Bearer ${PAYOUT_API_KEY}`,
          "Idempotency-Key": String(idempotencyKey),
        },
        body: JSON.stringify(params),
      });

      const contentType = gatewayResponse.headers.get("content-type");
      let gatewayResult: any;

      if (contentType && contentType.includes("application/json")) {
        const textResponse = await gatewayResponse.text();
        gatewayResult = textResponse ? JSON.parse(textResponse) : null;
      } else {
        const plainErrorText = await gatewayResponse.text();
        console.error("[payout] Non-JSON response from gateway:", plainErrorText);
        
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

      const gatewayMsg = (gatewayResult?.msg || gatewayResult?.message || "").toLowerCase();
      const isAlreadyProcessed = gatewayMsg.includes("already") || 
                                 gatewayMsg.includes("duplicate") ||
                                 gatewayMsg.includes("exists") ||
                                 gatewayResult?.code === 1001;

      if (isAlreadyProcessed) {
        console.log(`[payout] Gateway reports ${withdrawal.id} was already processed — syncing status.`);
        
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

      if (gatewayResponse.ok && (gatewayResult?.code === 0 || gatewayResult?.status === "success")) {
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
    } catch (supabaseError: any) {
      console.error('[payout] Supabase error:', supabaseError?.message || supabaseError);
      return res.status(500).json({ success: false, error: 'Database error: ' + (supabaseError?.message || 'Unknown') });
    }

  } catch (error: any) {
    console.error("Critical Catch Failure within Payout Execution Pipeline:", error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || String(error) || 'Unknown error' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { out_trade_no, status, transaction_id, error_msg } = req.body;

    if (!out_trade_no) {
      return res.status(400).json({ success: false, error: "Missing out_trade_no" });
    }

    console.log(`[payout-webhook] Received webhook for withdrawal ${out_trade_no}, status: ${status}`);

    let updateStatus = 'pending';
    if (status === 'success' || status === 'completed') {
      updateStatus = 'completed';
    } else if (status === 'failed' || status === 'error') {
      updateStatus = 'rejected';
    }

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
