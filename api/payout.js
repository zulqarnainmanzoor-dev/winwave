// api/payout.js
// POST /api/payout
// Called by admin dashboard when approving a withdrawal.
// Triggers PKPay Payout API, returns { success, gateway_ref } or { success: false, error }.

import crypto from "crypto";

const PAYOUT_API_KEY    = process.env.Payout_API_key;
const PAYOUT_API_SECRET = process.env.Payout_API_secret;
const MERCHANT_ID       = process.env.Merchant_ID;

// PKPay payout endpoint (adjust if their docs differ)
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

  const { withdrawal_id, amount, method, account_number, account_name } = req.body;

  if (!withdrawal_id || !amount || !method || !account_number)
    return res.status(400).json({ success: false, error: "Missing required fields" });

  // Map method to PKPay channel code
  const channelMap = { JAZZCASH: "JC", EASYPAISA: "EP" };
  const channel = channelMap[method?.toUpperCase()] || method;

  const params = {
    merchant_id:    MERCHANT_ID,
    out_trade_no:   withdrawal_id,          // our withdrawal UUID as idempotency key
    amount:         Number(amount).toFixed(2),
    channel,
    account_number,
    account_name:   account_name || "",
    timestamp:      Math.floor(Date.now() / 1000).toString(),
    nonce_str:      crypto.randomBytes(8).toString("hex"),
  };

  params.sign = buildSignature(params);

  try {
    const response = await fetch(PKPAY_PAYOUT_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${PAYOUT_API_KEY}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    // PKPay returns { code: 0, msg: "success", data: { transaction_id: "..." } } on success
    if (response.ok && (data.code === 0 || data.status === "success")) {
      return res.status(200).json({
        success:     true,
        gateway_ref: data.data?.transaction_id || data.transaction_id || withdrawal_id,
      });
    }

    return res.status(200).json({
      success: false,
      error:   data.msg || data.message || "Payout rejected by gateway",
    });
  } catch (err) {
    console.error("[payout] PKPay API error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
