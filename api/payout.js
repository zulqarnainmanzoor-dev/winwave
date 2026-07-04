// api/payout.js
// POST /api/payout
// SECURE AUTOMATED PAYOUT CONTROLLER
// Called by admin dashboard when approving a withdrawal.
// Performs server-side database fetch and direct PKPay API integration.
// Returns { success, gateway_ref } or { success: false, error }.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Initialize server-privileged admin Supabase client to bypass RLS safely
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

// PKPay Configuration from environment variables
const PAYOUT_API_KEY    = process.env.Payout_API_key;
const PAYOUT_API_SECRET = process.env.Payout_API_secret;
const MERCHANT_ID       = process.env.Merchant_ID;
const ADMIN_SECRET_TOKEN = process.env.ADMIN_INTERNAL_MUTATION_KEY;

// PKPay payout endpoint
const PKPAY_PAYOUT_URL = "https://api.pkpay.com/v1/payout";

function buildSignature(params) {
  // PKPay signature: HMAC-SHA256 of sorted key=value pairs joined by &
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto
    .createHmac("sha256", PAYOUT_API_SECRET)
    .update(sorted)
    .digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;
    const { withdrawal_id, adminSecretToken } = body;

    // 1. Enforce rigorous security handshake checking
    if (!withdrawal_id || !ADMIN_SECRET_TOKEN || adminSecretToken !== ADMIN_SECRET_TOKEN) {
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

    if (withdrawalRequest.status !== "pending" && withdrawalRequest.status !== "approved") {
      return res.status(400).json({ 
        success: false, 
        error: `Transaction has already been processed or finalized (status: ${withdrawalRequest.status}).` 
      });
    }

    // 3. EXECUTE STRUCTURAL PAYLOAD COMPILATION DIRECT TO PKPAY API MERCHANT GATEWAY
    // Map method to PKPay channel code
    const channelMap = { JAZZCASH: "JC", EASYPAISA: "EP", jazzcash: "JC", easypaisa: "EP" };
    const channel = channelMap[withdrawalRequest.method?.toUpperCase()] || withdrawalRequest.method;

    const params = {
      merchant_id:    MERCHANT_ID,
      out_trade_no:   withdrawalRequest.id,          // our withdrawal UUID as idempotency key
      amount:         Number(withdrawalRequest.amount).toFixed(2),
      channel,
      account_number: withdrawalRequest.account_number,
      account_name:   withdrawalRequest.account_name || "",
      timestamp:      Math.floor(Date.now() / 1000).toString(),
      nonce_str:      crypto.randomBytes(8).toString("hex"),
    };

    params.sign = buildSignature(params);

    console.log(`[payout] Initiating outbound API secure transfer to PKPAY cluster for order ID: ${withdrawalRequest.id}`);

    const gatewayResponse = await fetch(PKPAY_PAYOUT_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${PAYOUT_API_KEY}`,
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
      return res.status(500).json({ 
        success: false, 
        error: `Gateway returned non-JSON response: ${plainErrorText.substring(0, 200)}` 
      });
    }

    console.log(`[payout] Gateway response for ${withdrawalRequest.id}:`, JSON.stringify(gatewayResult));

    // 4. TRANSACTION RESOLUTION PROCESSING SWITCH LAYER
    if (gatewayResponse.ok && (gatewayResult?.code === 0 || gatewayResult?.status === "success")) {
      // Update target user entry tracking rows to 'completed' state safely using RPC
      const gatewayRef = gatewayResult?.data?.transaction_id || gatewayResult?.transaction_id || withdrawalRequest.id;
      
      const { error: updateError } = await supabaseAdmin.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawal_id,
        p_gateway_ref:   gatewayRef
      });

      if (updateError) {
        console.error("[payout] complete_withdrawal RPC error:", updateError);
        // Fallback to direct update if RPC fails
        const { error: fallbackError } = await supabaseAdmin
          .from("withdrawal_history")
          .update({ 
            status: "completed", 
            gateway_ref: gatewayRef,
            updated_at: new Date().toISOString()
          })
          .eq("id", withdrawal_id);
        
        if (fallbackError) {
          console.error("[payout] Fallback database update error:", fallbackError);
        }
      }

      return res.status(200).json({ 
        success: true, 
        gateway_ref: gatewayRef,
        message: "Payout automatically transferred and synchronized successfully." 
      });
    } else {
      // If gateway explicitly declines or returns low-balance limits errors, mark state securely to failed
      const errorMessage = gatewayResult?.msg || gatewayResult?.message || gatewayResult?.error || "Gateway merchant transaction declined.";
      
      const { error: updateError } = await supabaseAdmin.rpc("fail_withdrawal", {
        p_withdrawal_id: withdrawal_id,
        p_reason:        `Gateway Error: ${errorMessage}`
      });

      if (updateError) {
        console.error("[payout] fail_withdrawal RPC error:", updateError);
        // Fallback to direct update if RPC fails
        const { error: fallbackError } = await supabaseAdmin
          .from("withdrawal_history")
          .update({ 
            status: "failed", 
            reason: `Gateway Error: ${errorMessage}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", withdrawal_id);
        
        if (fallbackError) {
          console.error("[payout] Fallback database update error:", fallbackError);
        }
      }

      return res.status(400).json({ 
        success: false, 
        error: errorMessage 
      });
    }

  } catch (error) {
    console.error("Critical Catch Failure within Payout Execution Pipeline:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
