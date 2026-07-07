# PKPay Webhook - Quick Fix Action Plan

## Problem
- Callback URL is configured: `https://winclub-officiall.vercel.app/api/webhook/deposit`
- Payment captured successfully
- But callback shows "Awaiting" with 0 attempts
- Balance not being credited

## Root Cause
PKPay is trying to send the callback but your endpoint is rejecting it (likely signature verification failure).

---

## Immediate Action (5 minutes)

### Step 1: Deploy Debug Endpoint
```bash
cd c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww
git add .
git commit -m "Add webhook debug endpoint and verify-deposit endpoint"
git push
```

Wait for Vercel deployment to complete.

### Step 2: Update PKPay Webhook URL (Temporarily)
1. Log in to PKPay merchant dashboard
2. Go to Settings → Webhooks/Callbacks
3. Find your webhook URL: `https://winclub-officiall.vercel.app/api/webhook/deposit`
4. Change it to: `https://winclub-officiall.vercel.app/api/webhook/debug`
5. Save

### Step 3: Make a Test Deposit
1. Open your app
2. Go to Deposit
3. Select Rs 300
4. Click "Pay with Jazzcash"
5. Complete payment on PKPay checkout
6. You should be redirected back to app

### Step 4: Check Vercel Logs
```bash
vercel logs --follow
```

Or in Vercel dashboard:
1. Go to your project
2. Click "Deployments" → latest deployment
3. Click "Functions" tab
4. Search for "WEBHOOK-DEBUG"

### Step 5: Analyze Output
Look for output like:
```
[WEBHOOK-DEBUG] RAW BODY:
{
  "out_trade_no": "8fb65585df22bb6c",
  "status": "success",
  "amount": 300,
  "sign": "abc123..."
}
```

**Key things to note:**
- What fields are in the payload?
- What is the signature field name? (`sign`, `signature`, etc.)
- Is amount a string or number?
- Are there any other fields?

---

## Fix Based on Debug Output

### If You See Debug Logs
✅ Good! PKPay IS sending the callback.

**Next step:** Fix the signature verification in `deposit-webhook.ts`

### If You DON'T See Debug Logs
❌ PKPay is not even trying to send the callback.

**Possible causes:**
1. Webhook URL is wrong
2. PKPay account not configured correctly
3. Network issue

**Action:** Contact PKPay support

---

## Permanent Fix (After Debugging)

### Option A: Fix Signature Verification (Recommended)

Once you know the exact payload format from debug logs, update `backend/api/deposit-webhook.ts`:

```typescript
// Update the verifySignature function based on what you see in debug logs
function verifySignature(body: Record<string, any>): boolean {
  // If PKPay sends signature in a different field, update this
  const { sign, ...rest } = body;  // or use 'signature' if that's the field name
  
  // If PKPay uses different algorithm or separator, update this
  const payload = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== undefined && rest[k] !== null && rest[k] !== "")
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  
  // Rest of verification logic...
}
```

### Option B: Temporary Workaround (Quick Fix)

If you can't figure out the signature, temporarily disable it:

```typescript
function verifySignature(body: Record<string, any>): boolean {
  // TEMPORARY: Accept all callbacks
  console.warn("[webhook/deposit] ⚠️ Signature verification disabled");
  return true;
}
```

This will work but is less secure. Only use temporarily.

### Option C: Use Return Page Only

If webhook is too complicated, rely on the return page:

1. User completes payment
2. Redirected to `/#/deposit-return?order_id=XXX`
3. Return page calls `/api/verify-deposit`
4. Balance credited automatically

This works without webhook!

---

## Update Webhook URL Back

Once fixed:

1. Log in to PKPay merchant dashboard
2. Change webhook URL back to: `https://wincloud-officiall.vercel.app/api/webhook/deposit`
3. Save

---

## Test Again

1. Make another test deposit
2. Complete payment
3. Check Vercel logs for `/api/webhook/deposit`
4. Should see: `✅ Deposit marked as completed`
5. Check balance - should be credited

---

## If Still Not Working

### Fallback: Return Page Only
The return page will handle it:
- User completes payment
- Redirected back to app
- Balance credited via `/api/verify-deposit`
- Works without webhook!

### Manual Verification
Create admin endpoint to manually verify deposits:
```bash
POST /api/admin/verify-deposit?order_id=XXX
```

---

## Summary

1. ✅ Deploy debug endpoint
2. ✅ Change PKPay webhook URL to debug endpoint
3. ✅ Make test deposit
4. ✅ Check logs to see what PKPay is sending
5. ✅ Fix signature verification based on payload
6. ✅ Change webhook URL back to production
7. ✅ Test again
8. ✅ Monitor logs

**Estimated time: 15-30 minutes**

If webhook doesn't work, the return page provides a fallback so users still get their balance credited!
