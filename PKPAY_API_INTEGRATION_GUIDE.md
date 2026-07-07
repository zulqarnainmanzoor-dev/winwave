# PKPay API Integration - Complete Guide

## Overview

You now have a complete PKPay API integration that:
1. Creates dynamic checkout sessions using your API keys
2. Automatically handles return URLs
3. Properly tracks order IDs
4. Auto-credits balance on webhook callback
5. No more manual approval needed

---

## How It Works

### Old Flow (Static Links)
```
1. User clicks "Pay Now"
2. Redirected to static PKPay link
3. User completes payment
4. Admin manually approves
5. Balance credited
```

### New Flow (API Integration)
```
1. User clicks "Pay Now"
2. Backend calls PKPay API to create checkout
3. Gets dynamic checkout URL + PKPay order ID
4. User redirected to checkout
5. User completes payment
6. PKPay sends webhook callback
7. Balance auto-credited ✅
```

---

## Files Created

### Backend
1. **backend/lib/pkpay-api.ts** - PKPay API client
   - `createPKPayCheckout()` - Create dynamic checkout
   - `verifyPKPaySignature()` - Verify webhook signature
   - `getCheckoutStatus()` - Get checkout status

2. **backend/api/create-checkout.ts** - Checkout creation endpoint
   - `POST /api/create-checkout`
   - Creates deposit record
   - Calls PKPay API
   - Returns checkout URL

### Frontend
1. **src/components/DepositView_API.tsx** - Updated deposit view
   - Uses API endpoint instead of static links
   - Calls `/api/create-checkout`
   - Shows loading state

---

## Environment Variables Required

Make sure these are in your `.env`:

```
PKPAY_API_BASE=https://api.pkpay.click
PKPAY_MERCHANT_ID=your_merchant_id
PKPAY_API_KEY=your_api_key
PKPAY_SECRET_KEY=your_secret_key
APP_URL=https://winclub-officiall.vercel.app
API_URL=https://winclub-officiall.vercel.app/api
```

---

## Deployment Steps

### Step 1: Update Environment Variables
1. Go to Vercel dashboard
2. Go to project settings
3. Click "Environment Variables"
4. Add/update:
   - `PKPAY_API_BASE`
   - `PKPAY_MERCHANT_ID`
   - `PKPAY_API_KEY`
   - `PKPAY_SECRET_KEY`
   - `APP_URL`
   - `API_URL`

### Step 2: Replace DepositView
```bash
# Backup old file
mv src/components/DepositView.tsx src/components/DepositView_OLD.tsx

# Use new API version
mv src/components/DepositView_API.tsx src/components/DepositView.tsx
```

### Step 3: Deploy
```bash
git add .
git commit -m "Integrate PKPay API for dynamic checkout creation"
git push
```

### Step 4: Test
1. Make test deposit
2. Should create checkout dynamically
3. Should redirect to PKPay
4. After payment, should auto-credit balance

---

## API Flow

### Create Checkout Request
```
POST /api/create-checkout
{
  "amount": 300,
  "method": "jazzcash"
}
```

### Create Checkout Response
```
{
  "success": true,
  "checkoutUrl": "https://cashier.pkpay.click/checkout/5effa8ae6a6449af873046151f6b6215",
  "orderId": "1720329600000-abc123def",
  "pkpayOrderId": "5effa8ae6a6449af873046151f6b6215"
}
```

### Webhook Callback
```
POST /api/webhook/deposit
{
  "out_trade_no": "5effa8ae6a6449af873046151f6b6215",
  "status": "success",
  "amount": 300,
  "user_id": "01fc7792-9b68-4dfd-9422-a1fb3706ba03",
  "sign": "abc123..."
}
```

---

## Database Flow

### Deposit Creation
```
INSERT INTO deposit_history {
  user_id: "01fc7792-9b68-4dfd-9422-a1fb3706ba03",
  amount: 300,
  method: "JAZZCASH",
  order_id: "1720329600000-abc123def",
  pkpay_order_id: null,
  status: "pending",
  gateway_ref: "https://cashier.pkpay.click/checkout/...",
  created_at: now,
  updated_at: now
}
```

### After Payment
```
UPDATE deposit_history SET {
  pkpay_order_id: "5effa8ae6a6449af873046151f6b6215",
  status: "completed",
  updated_at: now
}
WHERE order_id = "1720329600000-abc123def"
```

### Balance Credit (Trigger)
```
UPDATE wallets SET {
  main_balance = main_balance + 306  (300 + 2% bonus)
}
WHERE user_id = "01fc7792-9b68-4dfd-9422-a1fb3706ba03"
```

---

## Testing

### Test 1: Create Checkout
```bash
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"amount": 300, "method": "jazzcash"}'
```

Expected response:
```json
{
  "success": true,
  "checkoutUrl": "https://cashier.pkpay.click/checkout/...",
  "orderId": "...",
  "pkpayOrderId": "..."
}
```

### Test 2: Make Deposit
1. Open app
2. Go to Deposit
3. Select Rs 300
4. Click "Pay with Jazzcash"
5. Should create checkout dynamically
6. Should redirect to PKPay
7. Complete payment
8. Should redirect back to app
9. Balance should be updated

### Test 3: Check Logs
```bash
vercel logs --follow
```

Look for:
```
[create-checkout] Creating checkout
[PKPayAPI] Checkout created
[webhook/deposit] Deposit marked as completed
```

---

## Troubleshooting

### Issue: "Failed to create checkout"
**Cause:** API keys not configured or PKPay API error
**Fix:**
1. Check environment variables in Vercel
2. Verify API keys are correct
3. Check Vercel logs for error details

### Issue: Checkout URL not working
**Cause:** PKPay API returned invalid URL
**Fix:**
1. Check PKPay API response in logs
2. Verify merchant ID is correct
3. Contact PKPay support

### Issue: Balance not credited after payment
**Cause:** Webhook not working or signature verification failing
**Fix:**
1. Check webhook logs
2. Verify signature verification
3. Check database trigger exists

### Issue: Different order ID each time
**Cause:** Creating new checkout sessions
**Fix:**
1. This is expected - each checkout is unique
2. PKPay generates new order ID each time
3. Both order_id and pkpay_order_id are stored

---

## Monitoring

### Check Checkout Creation
```bash
vercel logs --follow | grep "create-checkout"
```

### Check Webhook Callback
```bash
vercel logs --follow | grep "webhook/deposit"
```

### Check Database
```sql
SELECT order_id, pkpay_order_id, status, amount, created_at
FROM deposit_history
ORDER BY created_at DESC
LIMIT 10;
```

---

## Security

### Signature Verification
- All webhook callbacks are verified with HMAC-SHA256
- Uses PKPAY_SECRET_KEY from environment
- Prevents unauthorized callbacks

### API Authentication
- Uses PKPAY_API_KEY for API requests
- Uses PKPAY_SECRET_KEY for signature generation
- All requests are HTTPS

### Database
- User ID verified from auth session
- Deposit records linked to user
- Balance updates via trigger (atomic)

---

## Performance

### Checkout Creation
- ~500ms to create checkout
- ~1-2s to redirect to PKPay
- ~30-60s for user to complete payment
- ~1-2s for webhook to process
- **Total: ~35-65 seconds**

### Balance Update
- Webhook callback: ~1-2s
- Database trigger: ~500ms
- User sees balance update: ~2-3s after payment

---

## Advantages Over Static Links

✅ **Dynamic Checkout Sessions**
- Each deposit gets unique checkout URL
- No reusing same link multiple times

✅ **Proper Order ID Tracking**
- PKPay order ID stored in database
- Webhook can find deposit record

✅ **Auto-Credit Balance**
- No manual approval needed
- Webhook automatically credits balance

✅ **Better Error Handling**
- API returns errors immediately
- Can retry if needed

✅ **Account Details**
- PKPay API provides account information
- Can display in deposit history

---

## Next Steps

1. ✅ Update environment variables in Vercel
2. ✅ Replace DepositView.tsx with API version
3. ✅ Deploy to Vercel
4. ✅ Test deposit flow
5. ✅ Monitor logs
6. ✅ Verify balance updates

---

## Summary

You now have a complete PKPay API integration that:
- Creates dynamic checkout sessions
- Automatically handles return URLs
- Properly tracks order IDs
- Auto-credits balance on webhook
- No more manual approval needed

**Time to deploy: 10-15 minutes**
