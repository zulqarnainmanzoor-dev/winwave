/**
 * PKPay Payment Gateway Integration Helper
 * Provides shared utilities for PKPay API calls and webhook URL construction.
 */

// ── Webhook URL Construction ──────────────────────────────────
// Production domain configuration
const PRODUCTION_DOMAIN = "https://winwave-official.vercel.app";
const DEV_WEBHOOK_BASE = process.env.DEV_WEBHOOK_BASE || "";  // ngrok URL in dev only
const PROD_WEBHOOK_BASE = process.env.PROD_WEBHOOK_BASE || ""; // custom domain override

/**
 * Returns the publicly accessible webhook URL for PKPay to call.
 * 
 * Resolution order:
 * 1. DEV_WEBHOOK_BASE - if set (ngrok URL for local testing ONLY)
 * 2. VERCEL_URL - automatically set by Vercel in production
 * 3. PROD_WEBHOOK_BASE - custom domain override
 * 4. PRODUCTION_DOMAIN - hardcoded production fallback
 */
export function getWebhookUrl(): string {
  // Priority 1: Dev webhook base (ngrok tunnel) - ONLY for local development
  if (DEV_WEBHOOK_BASE) {
    return `${DEV_WEBHOOK_BASE}/api/webhooks/payout`;
  }

  // Priority 2: Vercel deployment URL (set automatically by Vercel)
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}/api/webhooks/payout`;
  }

  // Priority 3: Production webhook base override
  if (PROD_WEBHOOK_BASE) {
    return `${PROD_WEBHOOK_BASE}/api/webhooks/payout`;
  }

  // Priority 4: Production domain (hardcoded fallback for production)
  return `${PRODUCTION_DOMAIN}/api/webhooks/payout`;
}

/**
 * Returns the PKPay-specific webhook URL that should be registered
 * in the PKPay merchant dashboard.
 * 
 * Call this to verify the URL is correct before making API calls.
 */
export function getRecommendedWebhookUrl(): string {
  const vercelUrl = process.env.VERCEL_URL;
  const devBase = process.env.DEV_WEBHOOK_BASE;
  
  // Development with ngrok
  if (devBase) {
    return `${devBase}/api/webhooks/payout`;
  }
  
  // Production: Use VERCEL_URL if available, otherwise use hardcoded production domain
  if (vercelUrl) {
    return `https://${vercelUrl}/api/webhooks/payout`;
  }
  
  // Production fallback - always return production domain
  return `${PRODUCTION_DOMAIN}/api/webhooks/payout`;
}
