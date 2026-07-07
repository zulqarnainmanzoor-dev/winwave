import axios from 'axios';

const PKPAY_API_BASE = process.env.PKPAY_API_BASE || 'https://api.pkpay.click';
const PKPAY_MERCHANT_ID = process.env.PKPAY_MERCHANT_ID || '';
const PKPAY_API_KEY = process.env.PKPAY_API_KEY || '';
const PKPAY_SECRET_KEY = process.env.PKPAY_SECRET_KEY || '';

interface CreateCheckoutParams {
  amount: number;
  orderId: string;
  userId: string;
  method: 'jazzcash' | 'easypaisa';
  returnUrl: string;
  notifyUrl: string;
}

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  pkpayOrderId?: string;
  error?: string;
}

/**
 * Create a dynamic checkout session with PKPay API
 * This replaces static payment links with dynamic sessions
 */
export async function createPKPayCheckout(
  params: CreateCheckoutParams
): Promise<CheckoutResponse> {
  try {
    console.log(`[PKPayAPI] Creating checkout: orderId=${params.orderId}, amount=${params.amount}, method=${params.method}`);

    const payload = {
      merchant_id: PKPAY_MERCHANT_ID,
      amount: params.amount,
      currency: 'PKR',
      order_id: params.orderId,
      description: `WinClub Deposit - Rs ${params.amount}`,
      customer_id: params.userId,
      customer_email: `user_${params.userId}@winclub.local`,
      customer_phone: '', // Will be filled from user data if needed
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
      payment_method: params.method.toUpperCase(),
      metadata: {
        user_id: params.userId,
        deposit_type: 'game_deposit',
        bonus_percentage: 2,
      },
    };

    console.log(`[PKPayAPI] Payload:`, JSON.stringify(payload, null, 2));

    // Create signature
    const signature = generateSignature(payload);
    console.log(`[PKPayAPI] Signature generated`);

    // Call PKPay API
    const response = await axios.post(
      `${PKPAY_API_BASE}/api/v1/checkout/create`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Merchant-ID': PKPAY_MERCHANT_ID,
          'X-API-Key': PKPAY_API_KEY,
        },
        timeout: 10000,
      }
    );

    console.log(`[PKPayAPI] Response status: ${response.status}`);
    console.log(`[PKPayAPI] Response data:`, JSON.stringify(response.data, null, 2));

    if (response.data?.success || response.data?.checkout_url) {
      const checkoutUrl = response.data.checkout_url || response.data.url;
      const pkpayOrderId = response.data.order_id || response.data.transaction_id;

      console.log(`[PKPayAPI] ✅ Checkout created: ${checkoutUrl}`);
      console.log(`[PKPayAPI] PKPay Order ID: ${pkpayOrderId}`);

      return {
        success: true,
        checkoutUrl,
        pkpayOrderId,
      };
    } else {
      console.error(`[PKPayAPI] ❌ API returned error:`, response.data);
      return {
        success: false,
        error: response.data?.message || 'Failed to create checkout',
      };
    }
  } catch (error: any) {
    console.error(`[PKPayAPI] ❌ Exception:`, error.message);
    console.error(`[PKPayAPI] Response:`, error.response?.data);
    return {
      success: false,
      error: error.message || 'Failed to create checkout',
    };
  }
}

/**
 * Generate HMAC signature for PKPay API requests
 */
function generateSignature(payload: Record<string, any>): string {
  const crypto = require('crypto');

  // Sort payload keys
  const sortedKeys = Object.keys(payload).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${payload[key]}`)
    .join('&');

  console.log(`[PKPayAPI] Signature string: ${signatureString}`);

  const signature = crypto
    .createHmac('sha256', PKPAY_SECRET_KEY)
    .update(signatureString)
    .digest('hex');

  return signature;
}

/**
 * Verify PKPay webhook signature
 */
export function verifyPKPaySignature(
  payload: Record<string, any>,
  receivedSignature: string
): boolean {
  const crypto = require('crypto');

  const { sign, ...rest } = payload;

  const sortedKeys = Object.keys(rest).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${rest[key]}`)
    .join('&');

  const expectedSignature = crypto
    .createHmac('sha256', PKPAY_SECRET_KEY)
    .update(signatureString)
    .digest('hex');

  console.log(`[PKPayAPI] Signature verification:`);
  console.log(`  Expected: ${expectedSignature}`);
  console.log(`  Received: ${receivedSignature}`);

  return expectedSignature.toLowerCase() === receivedSignature.toLowerCase();
}

/**
 * Get checkout status from PKPay
 */
export async function getCheckoutStatus(orderId: string): Promise<any> {
  try {
    console.log(`[PKPayAPI] Getting checkout status: orderId=${orderId}`);

    const payload = {
      merchant_id: PKPAY_MERCHANT_ID,
      order_id: orderId,
    };

    const signature = generateSignature(payload);

    const response = await axios.post(
      `${PKPAY_API_BASE}/api/v1/checkout/status`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Merchant-ID': PKPAY_MERCHANT_ID,
          'X-API-Key': PKPAY_API_KEY,
        },
        timeout: 10000,
      }
    );

    console.log(`[PKPayAPI] Status response:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`[PKPayAPI] Failed to get status:`, error.message);
    return null;
  }
}
