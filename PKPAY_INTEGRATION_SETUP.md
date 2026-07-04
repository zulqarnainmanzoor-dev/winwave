# PKPAY Payment Gateway Integration Setup Guide

## Overview
This document provides complete setup instructions for the PKPAY automated withdrawal payout system integration.

---

## STEP 1: Environment Variables Configuration

Add the following variables to your `.env` file:

```env
# Supabase Configuration (Already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SERVICE_ROLE_KEY=your_service_role_key

# Admin Security
VITE_ADMIN_SECRET_ID=3399944
VITE_SUBADMIN_SECRET_ID=1234567

# PKPAY Payment Gateway Configuration
Merchant_ID=your_merchant_id
Payout_API_key=your_payout_api_key
Payout_API_secret=your_payout_api_secret
Webhook_secret=your_webhook_secret

# Admin Internal Mutation Key (CRITICAL - Keep this secret!)
ADMIN_INTERNAL_MUTATION_KEY=ww-admin-mutation-key-2025-secure-change-in-production
VITE_ADMIN_INTERNAL_MUTATION_KEY=ww-admin-mutation-key-2025-secure-change-in-production
```

### Required PKPAY Credentials
Contact PKPAY support to obtain:
1. **Merchant_ID**: Your unique merchant identifier
2. **Payout_API_key**: Dedicated payout system API key
3. **Payout_API_secret**: Secret key for HMAC-SHA256 signature generation
4. **Webhook_secret**: Secret for verifying webhook callbacks from PKPAY

### Security Notes
- `ADMIN_INTERNAL_MUTATION_KEY` is used to authenticate admin payout requests
- Never expose `Payout_API_secret` or `Webhook_secret` to the client-side
- Change default values in production environments

---

## STEP 2: Database Schema Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create withdrawal_history table
CREATE TABLE IF NOT EXISTS public.withdrawal_history (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  method          TEXT          NOT NULL,  -- 'JAZZCASH' | 'EASYPAISA'
  account_name    TEXT          NOT NULL,
  account_number  TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending',  -- pending | approved | processing | completed | failed | rejected
  gateway_ref     TEXT          NULL,      -- PKPay payout transaction ID
  reason          TEXT          NULL,      -- rejection/failure reason
  remarks         TEXT          NULL,      -- user-provided remarks
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wh_user_id    ON public.withdrawal_history (user_id);
CREATE INDEX IF NOT EXISTS idx_wh_status     ON public.withdrawal_history (status);
CREATE INDEX IF NOT EXISTS idx_wh_created_at ON public.withdrawal_history (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.withdrawal_history ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Users read own withdrawals"  ON public.withdrawal_history;
DROP POLICY IF EXISTS "Service role all withdrawals" ON public.withdrawal_history;

CREATE POLICY "Users read own withdrawals"
  ON public.withdrawal_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role all withdrawals"
  ON public.withdrawal_history FOR ALL USING (auth.role() = 'service_role');
```

---

## STEP 3: Database RPC Functions Setup

Run the following SQL in your Supabase SQL Editor to create required RPC functions:

```sql
-- ================================================================
-- RPC Functions for Withdrawal Management
-- ================================================================

-- 1. approve_withdrawal — pending → processing
-- Called by admin "Approve" button click.
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID,
  p_gateway_ref   TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row    RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotent: already processed
  IF v_row.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_processed', 'status', v_row.status);
  END IF;

  -- Deduct from user balance (if not already deducted on request creation)
  IF v_row.status = 'pending' THEN
    UPDATE public.users
    SET main_balance = GREATEST(0, main_balance - v_row.amount)
    WHERE id = v_row.user_id;
  END IF;

  UPDATE public.withdrawal_history
  SET
    status      = 'processing',
    gateway_ref = COALESCE(p_gateway_ref, gateway_ref),
    updated_at  = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'processing');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID, TEXT) TO authenticated, service_role;

-- 2. complete_withdrawal — processing → completed
-- Called by the /api/webhooks/payout endpoint on PKPay success.
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  p_withdrawal_id UUID,
  p_gateway_ref   TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Idempotent
  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_completed');
  END IF;

  IF v_row.status <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_status', 'status', v_row.status);
  END IF;

  UPDATE public.withdrawal_history
  SET
    status      = 'completed',
    gateway_ref = p_gateway_ref,
    updated_at  = NOW()
  WHERE id = p_withdrawal_id;

  -- Log to transactions for user history view
  INSERT INTO public.transactions (user_id, type, amount, status, gateway_ref, created_at)
  VALUES (v_row.user_id, 'withdraw', v_row.amount, 'completed', p_gateway_ref, NOW())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'status', 'completed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_withdrawal(UUID, TEXT) TO service_role;

-- 3. fail_withdrawal — any → failed + refund
-- Called when payout API fails or admin rejects.
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_withdrawal_id UUID,
  p_reason        TEXT DEFAULT 'Payment failed'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status IN ('completed', 'failed', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_finalized', 'status', v_row.status);
  END IF;

  -- Refund balance only if it was already deducted (status was processing/approved)
  IF v_row.status IN ('processing', 'approved') THEN
    UPDATE public.users
    SET main_balance = main_balance + v_row.amount
    WHERE id = v_row.user_id;
  END IF;

  UPDATE public.withdrawal_history
  SET status = 'failed', reason = p_reason, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'failed', 'refunded', v_row.status IN ('processing','approved'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID, TEXT) TO authenticated, service_role;
```

---

## STEP 4: PKPAY Dashboard Configuration

### 4.1 Configure Webhook URL
In your PKPAY merchant dashboard, set the webhook callback URL to:

**Production (Vercel):**
```
https://your-domain.vercel.app/api/webhooks/payout
```

**Development (ngrok):**
```
https://saddling-approach-privatize.ngrok-free.dev/api/webhooks/payout
```

> **Important:** The webhook URL is **critical** for the payout flow. Without it, withdrawals will get stuck in "processing" status because PKPay cannot notify your backend of the result. The system includes a **polling fallback** (every 10 seconds) that automatically checks and syncs stuck withdrawals, but configuring the webhook is the proper solution.

### 4.2 Environment Variables for Webhook URL
Add these to your `.env` file to control webhook URL resolution:

```env
# For development with ngrok (set this to your ngrok URL)
DEV_WEBHOOK_BASE=https://your-ngrok-url.ngrok.io

# For production with custom domain (optional override)
PROD_WEBHOOK_BASE=https://your-custom-domain.com

# VERCEL_URL is automatically set by Vercel in production — no manual config needed
```

The webhook URL is resolved automatically in this order:
1. `DEV_WEBHOOK_BASE` — for local development with ngrok
2. `VERCEL_URL` — automatically set by Vercel in production
3. `PROD_WEBHOOK_BASE` — custom domain override
4. Falls back to `https://winwave-official.vercel.app` (production domain)

### 4.3 Enable Payout API
Ensure the following are enabled in your PKPAY account:
- Payout API access
- JazzCash channel (JC)
- EasyPaisa channel (EP)
- Webhook notifications for payout status

---

## STEP 5: API Endpoints

### 5.1 Payout Controller
**Endpoint:** `POST /api/payout`

**Purpose:** Initiates automated payout to PKPAY gateway when admin approves a withdrawal.

**Request Body:**
```json
{
  "withdrawal_id": "uuid-of-withdrawal",
  "adminSecretToken": "your-admin-internal-mutation-key",
  "amount": 5000,
  "method": "JAZZCASH",
  "account_number": "03001234567",
  "account_name": "SHAIZA BIBI"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "gateway_ref": "PKPAY_TXN_123456",
  "message": "Payout automatically transferred and synchronized successfully."
}
```

**Error Response (400/401/404/500):**
```json
{
  "success": false,
  "error": "Error description"
}
```

### 5.2 Webhook Handler
**Endpoint:** `POST /api/webhooks/payout`

**Purpose:** Receives asynchronous status updates from PKPAY gateway.

**PKPay sends:**
```json
{
  "out_trade_no": "withdrawal-uuid",
  "status": "success",  // or "failed"
  "amount": 5000,
  "sign": "hmac-signature"
}
```

**Response to PKPay:**
```json
{
  "code": 0,
  "msg": "success"
}
```

---

## STEP 6: Frontend Integration

### 6.1 Admin Dashboard Integration

Update your admin dashboard to call the payout endpoint when approving withdrawals:

```typescript
// Example: src/admin/pages/FundsManagement.tsx

const approveWithdrawal = async (withdrawalId: string) => {
  try {
    const response = await fetch('/api/payout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        withdrawal_id: withdrawalId,
        adminSecretToken: import.meta.env.VITE_ADMIN_INTERNAL_MUTATION_KEY,
        // Additional fields if needed
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Payout successful:', result.gateway_ref);
      // Refresh withdrawal list
    } else {
      console.error('Payout failed:', result.error);
      // Show error to admin
    }
  } catch (error) {
    console.error('Error initiating payout:', error);
  }
};
```

---

## STEP 7: Testing

### 7.1 Test Payout Flow

1. **Create a test withdrawal request** (status: pending)
2. **Call the payout endpoint** with valid admin secret token
3. **Verify:**
   - Status changes to 'processing'
   - PKPAY API is called with correct parameters
   - Database is updated with gateway_ref
   - Webhook receives success/failure callback
   - Final status is 'completed' or 'failed'

### 7.2 Test Webhook

Use a tool like ngrok to expose your local server and test webhooks:

```bash
# Expose local server
ngrok http 3000

# Use the ngrok URL in PKPAY dashboard for webhook testing
# PKPAY will send test webhooks to: https://your-ngrok-url.ngrok.io/api/webhooks/payout
```

### 7.3 Test Error Scenarios

- Invalid admin secret token → 401 Unauthorized
- Withdrawal not found → 404 Not Found
- Withdrawal already processed → 400 Bad Request
- PKPAY API returns error → Status changes to 'failed', balance refunded
- Network error → Status changes to 'failed', balance refunded

---

## STEP 8: Security Checklist

- [ ] `ADMIN_INTERNAL_MUTATION_KEY` is set to a strong random value
- [ ] `Payout_API_secret` and `Webhook_secret` are never exposed to client-side
- [ ] Webhook signature verification is enabled (set `Webhook_secret`)
- [ ] RLS policies are enabled on `withdrawal_history` table
- [ ] Service role key is only used server-side
- [ ] HTTPS is enabled in production
- [ ] Admin dashboard is protected by authentication

---

## STEP 9: Monitoring & Logs

### Important Logs to Monitor

1. **Payout Initiation Logs:**
   ```
   [payout] Initiating secure payout for withdrawal_id: xxx
   [payout] Initiating outbound API secure transfer to PKPAY cluster for order ID: xxx
   ```

2. **Gateway Response Logs:**
   ```
   [payout] Gateway response for xxx: {code: 0, status: "success", ...}
   ```

3. **Webhook Logs:**
   ```
   [webhook/payout] xxx → status=success → SUCCESS
   [webhook/payout] ✓ Completed: xxx
   ```

4. **Error Logs:**
   ```
   [payout] Fetch error: ...
   [payout] complete_withdrawal RPC error: ...
   [webhook/payout] Invalid signature — rejected
   ```

---

## STEP 10: Troubleshooting

### Issue: "Unexpected end of JSON input"
**Solution:** The updated code now checks `content-type` header before parsing JSON. This error should no longer occur.

### Issue: Withdrawal stuck in "processing" status
**Solution:** 
1. Check if webhook is configured correctly in PKPAY dashboard
2. Verify webhook URL is accessible from PKPAY servers
3. Check server logs for webhook delivery attempts
4. Manually call `complete_withdrawal` or `fail_withdrawal` RPC if needed

### Issue: "Unauthorized endpoint execution"
**Solution:** Ensure `adminSecretToken` in request matches `ADMIN_INTERNAL_MUTATION_KEY` in `.env`

### Issue: Balance not refunded on failure
**Solution:** The `fail_withdrawal` RPC automatically refunds if status is 'processing' or 'approved'. Check RPC execution logs.

---

## Architecture Flow

```
Admin Approves Withdrawal
         ↓
POST /api/payout
         ↓
1. Verify admin secret token
2. Fetch withdrawal from DB
3. Call approve_withdrawal RPC (pending → processing, deduct balance)
4. Send payout request to PKPAY API
         ↓
    ┌────┴────┐
    │         │
Success    Failure
    │         │
    ↓         ↓
complete_   fail_withdrawal
withdrawal  RPC (refund balance)
RPC (completed)
    │         │
    ↓         ↓
Webhook     Webhook
confirms    confirms
    │         │
    ↓         ↓
Status:     Status:
completed   failed
```

---

## Support & Contact

For PKPAY API documentation and support:
- PKPAY Merchant Dashboard: https://dashboard.pkpay.com
- PKPAY API Docs: https://docs.pkpay.com
- PKPAY Support: support@pkpay.com

For platform-specific issues, check server logs and Supabase dashboard.

---

## Version History

- **v1.0** (2025-07-04): Initial PKPAY integration with secure payout controller and webhook handler
  - Added Supabase integration
  - Added RPC functions for atomic transactions
  - Added comprehensive error handling
  - Added signature verification for webhooks
  - Added fallback mechanisms for database updates