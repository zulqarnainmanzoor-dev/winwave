# PKPay Webhook Callback - Troubleshooting Guide

## Current Status
- ✅ Callback URL configured: `https://winclub-officiall.vercel.app/api/webhook/deposit`
- ❌ Callback status: "Awaiting" (0 attempts)
- ❌ Payment captured but callback not delivered

---

## Root Cause Analysis

The "Awaiting" status with 0 attempts means PKPay is **trying to send the callback but failing**. This could be:

1. **Signature Verification Failing** - Most likely
   - PKPay sends callback with signature
   - Your webhook rejects it due to signature mismatch
   - PKPay sees 401/500 response and retries

2. **Wrong WEBHOOK_SECRET** - Very likely
   - Environment variable doesn't match PKPay's secret
   - Signature verification fails
   - Callback rejected

3. **Endpoint Not Responding** - Possible
   - Server timeout
   - Network issue
   - Endpoint returning error

4. **Wrong Data Format** - Possible
   - PKPay sending data in unexpected format
   - JSON parsing fails
   - Endpoint rejects request

---

## Step 1: Enable Debug Logging

### Deploy Debug Endpoint
A debug endpoint has been created at: `/api/webhook/debug`

This endpoint logs **exactly** what PKPay is sending without any validation.

### Deploy to Vercel
```bash
git add .
git commit -m "Add webhook debug endpoint"
git push
```

### Update PKPay Webhook URL (Temporarily)
1. Log in to PKPay merchant dashboard
2. Go to Settings → Webhooks
3. Change webhook URL to: `https://winclub-officiall.vercel.app/api/webhook/debug`
4. Save

### Trigger a Test Payment
1. Make a test deposit in your app
2. Complete payment on PKPay
3. Check Vercel logs for debug output

### Check Vercel Logs
```bash
vercel logs --follow
```

Or in Vercel dashboard:
1. Go to your project
2. Click "Deployments"
3. Click latest deployment
4. Click "Functions" tab
5. Look for `/api/webhook/debug` logs

---

## Step 2: Analyze Debug Output

When PKPay sends the callback, you'll see output like:

```
================================================================================
[WEBHOOK-DEBUG] 2026-07-07T03:35:35.000Z
================================================================================
[WEBHOOK-DEBUG] HEADERS:
  content-type: application/json
  user-agent: PKPay-Webhook/1.0
  x-pkpay-signature: abc123...
  ...

[WEBHOOK-DEBUG] RAW BODY:
{
  "out_trade_no": "8fb65585df22bb6c",
  "status": "success",
  "amount": 300,
  "user_id": "user123",
  "sign": "abc123..."
}

[WEBHOOK-DEBUG] QUERY PARAMS:
{}

[WEBHOOK-DEBUG] METHOD: POST
[WEBHOOK-DEBUG] URL: /api/webhook/debug
[WEBHOOK-DEBUG] PATH: /api/webhook/debug
================================================================================
```

### What to Look For

1. **Check if callback is being sent**
   - If you see debug logs, PKPay IS sending the callback
   - If no logs, PKPay is not even trying to send it

2. **Check the payload format**
   - What fields are included?
   - What is the signature field name?
   - Is amount a string or number?

3. **Check headers**
   - Is there a signature header?
   - What is the content-type?

---

## Step 3: Fix Signature Verification

Once you see what PKPay is sending, you can fix the signature verification.

### Common Issues

**Issue 1: Signature field name is different**
- PKPay might send `sign`, `signature`, `x-pkpay-signature`, etc.
- Check debug output to see actual field name

**Issue 2: Signature calculation is different**
- PKPay might use different algorithm
- Might include/exclude certain fields
- Might use different separator

**Issue 3: WEBHOOK_SECRET is wrong**
- Check your `.env` file
- Verify it matches PKPay dashboard
- Try without signature verification first

### Temporary Fix: Disable Signature Verification

Edit `backend/api/deposit-webhook.ts`:

```typescript
function verifySignature(body: Record<string, any>): boolean {
  // TEMPORARY: Skip signature verification for debugging
  console.warn("[webhook/deposit] ⚠️ SIGNATURE VERIFICATION DISABLED - DEBUG MODE");
  return true;
}
```

This will accept all callbacks. Once working, re-enable with correct signature logic.

---

## Step 4: Update Webhook URL Back

Once you've debugged and fixed the issue:

1. Log in to PKPay merchant dashboard
2. Go to Settings → Webhooks
3. Change webhook URL back to: `https://winclub-officiall.vercel.app/api/webhook/deposit`
4. Save

---

## Step 5: Test Again

1. Make another test deposit
2. Complete payment
3. Check Vercel logs for `/api/webhook/deposit`
4. Should see: `✅ Deposit marked as completed`
5. Check balance - should be credited

---

## Common PKPay Webhook Formats

### Format 1: JSON Body with Signature
```json
{
  "out_trade_no": "8fb65585df22bb6c",
  "status": "success",
  "amount": "300",
  "user_id": "user123",
  "sign": "abc123def456..."
}
```

### Format 2: Query Parameters
```
POST /api/webhook/deposit?out_trade_no=8fb65585df22bb6c&status=success&amount=300&sign=abc123...
```

### Format 3: Form Data
```
out_trade_no=8fb65585df22bb6c&status=success&amount=300&sign=abc123...
```

---

## Fallback: Use Return Page

Even if webhook doesn't work, the return page handles it:

1. User completes payment
2. Redirected to `/#/deposit-return?order_id=XXX`
3. Return page calls `/api/verify-deposit`
4. Deposit marked as completed
5. Balance credited via database trigger

So users will still get their balance credited, just not in real-time.

---

## Checklist

- [ ] Deploy debug endpoint
- [ ] Update PKPay webhook URL to debug endpoint
- [ ] Make test deposit and complete payment
- [ ] Check Vercel logs for debug output
- [ ] Analyze payload format and signature
- [ ] Fix signature verification if needed
- [ ] Update webhook URL back to production endpoint
- [ ] Test again with production endpoint
- [ ] Verify balance is credited
- [ ] Monitor logs for any errors

---

## If Still Not Working

### Option 1: Contact PKPay Support
- Ask them to check webhook delivery logs
- Ask for exact payload format they're sending
- Ask for signature algorithm details

### Option 2: Use Return Page Only
- Disable webhook verification temporarily
- Rely on return page for balance crediting
- Users will see balance update after redirect

### Option 3: Manual Verification
- Create admin endpoint to manually verify deposits
- Admin can check PKPay dashboard and mark deposits as completed
- Trigger balance credit manually

---

## Production Monitoring

Once webhook is working:

1. **Monitor webhook logs**
   ```bash
   vercel logs --follow | grep "webhook/deposit"
   ```

2. **Check for failed callbacks**
   - Look for error messages
   - Check signature mismatches
   - Monitor database updates

3. **Verify balance updates**
   - Check if balance is credited within 1-5 minutes
   - Monitor for stuck deposits

4. **Set up alerts**
   - Alert if webhook fails
   - Alert if deposit not credited within 10 minutes
   - Alert if signature verification fails

---

## Summary

The webhook callback is configured correctly, but PKPay is unable to deliver it successfully. Use the debug endpoint to see what PKPay is actually sending, then fix the signature verification or other issues accordingly.

The return page provides a fallback so users still get their balance credited even if the webhook fails.
