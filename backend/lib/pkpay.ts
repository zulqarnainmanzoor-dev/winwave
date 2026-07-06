/**
 * PKPay Payment Gateway Integration Helper
 *
 * Used by:
 * - Deposit API
 * - Payout API
 * - PKPay Merchant configuration
 *
 * Single source of truth for webhook URLs.
 */

// ----------------------------------------------------
// Production Domain (NO #/)
// ----------------------------------------------------
const PRODUCTION_DOMAIN = "https://winclub-officiall.vercel.app";

// Optional overrides
const DEV_WEBHOOK_BASE = process.env.DEV_WEBHOOK_BASE || "";
const PROD_WEBHOOK_BASE = process.env.PROD_WEBHOOK_BASE || "";

// ----------------------------------------------------
// Deposit Webhook
// ----------------------------------------------------
export function getWebhookUrl(): string {

  // Local development (Ngrok)
  if (DEV_WEBHOOK_BASE) {
    return `${DEV_WEBHOOK_BASE}/api/webhook/deposit`;
  }

  // Current Vercel deployment
  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl) {
    return `https://${vercelUrl}/api/webhook/deposit`;
  }

  // Custom production override
  if (PROD_WEBHOOK_BASE) {
    return `${PROD_WEBHOOK_BASE}/api/webhook/deposit`;
  }

  // Final production fallback
  return `${PRODUCTION_DOMAIN}/api/webhook/deposit`;
}

// ----------------------------------------------------
// Recommended URL shown in logs / admin
// ----------------------------------------------------
export function getRecommendedWebhookUrl(): string {

  if (DEV_WEBHOOK_BASE) {
    return `${DEV_WEBHOOK_BASE}/api/webhook/deposit`;
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl) {
    return `https://${vercelUrl}/api/webhook/deposit`;
  }

  if (PROD_WEBHOOK_BASE) {
    return `${PROD_WEBHOOK_BASE}/api/webhook/deposit`;
  }

  return `${PRODUCTION_DOMAIN}/api/webhook/deposit`;
}

// ----------------------------------------------------
// Future Payout Webhook (for later use)
// ----------------------------------------------------
export function getPayoutWebhookUrl(): string {

  if (DEV_WEBHOOK_BASE) {
    return `${DEV_WEBHOOK_BASE}/api/webhook/payout`;
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl) {
    return `https://${vercelUrl}/api/webhook/payout`;
  }

  if (PROD_WEBHOOK_BASE) {
    return `${PROD_WEBHOOK_BASE}/api/webhook/payout`;
  }

  return `${PRODUCTION_DOMAIN}/api/webhook/payout`;
}