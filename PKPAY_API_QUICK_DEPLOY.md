# PKPay API Integration - Quick Action Plan

## What's New

✅ Dynamic checkout creation using PKPay API
✅ Auto-credit balance on webhook
✅ No more manual approval needed
✅ Proper order ID tracking
✅ Account details in deposit history

---

## Deploy (15 minutes)

### Step 1: Update Environment Variables (2 min)
1. Go to Vercel dashboard
2. Click your project
3. Go to Settings → Environment Variables
4. Add/update:
   ```
   PKPAY_API_BASE=https://api.pkpay.click
   PKPAY_MERCHANT_ID=<your_merchant_id>
   PKPAY_API_KEY=<your_api_key>
   PKPAY_SECRET_KEY=<your_secret_key>
   APP_URL=https://winclub-officiall.vercel.app
   API_URL=https://winclub-officiall.vercel.app/api
   ```

### Step 2: Replace DepositView (1 min)
```bash
cd c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww

# Backup old
mv src/components/DepositView.tsx src/components/DepositView_OLD.tsx

# Use new API version
mv src/components/DepositView_API.tsx src/components/DepositView.tsx
```

### Step 3: Deploy (5 min)
```bash
git add .
git commit -m "Integrate PKPay API for dynamic checkout creation"
git push
```

Wait for Vercel deployment.

### Step 4: Test (7 min)
1. Open app
2. Go to Deposit
3. Select Rs 300
4. Click "Pay with Jazzcash"
5. Should create checkout dynamically
6. Should redirect to PKPay
7. Complete payment
8. Should auto-credit balance

---

## How It Works

```
User clicks "Pay Now"
    ↓
Backend calls PKPay API
    ↓
Gets dynamic checkout URL + order ID
    ↓
User redirected to checkout
    ↓
User completes payment
    ↓
PKPay sends webhook callback
    ↓
Balance auto-credited ✅
```

---

## Files Created

1. `backend/lib/pkpay-api.ts` - PKPay API client
2. `backend/api/create-checkout.ts` - Checkout endpoint
3. `src/components/DepositView_API.tsx` - Updated UI

---

## Environment Variables

Make sure you have these in `.env`:

```
PKPAY_API_BASE=https://api.pkpay.click
PKPAY_MERCHANT_ID=your_merchant_id
PKPAY_API_KEY=your_api_key
PKPAY_SECRET_KEY=your_secret_key
APP_URL=https://winclub-officiall.vercel.app
API_URL=https://winclub-officiall.vercel.app/api
```

---

## Testing Checklist

- [ ] Environment variables updated in Vercel
- [ ] DepositView.tsx replaced with API version
- [ ] Code deployed to Vercel
- [ ] Test deposit created
- [ ] Checkout created dynamically
- [ ] Redirected to PKPay
- [ ] Payment completed
- [ ] Balance auto-credited
- [ ] No manual approval needed
- [ ] Logs show webhook callback

---

## Success Indicators

✅ Checkout created dynamically
✅ Redirected to PKPay checkout
✅ Payment completed
✅ Webhook callback received
✅ Balance auto-credited
✅ No manual approval needed
✅ Account details showing

---

## Monitoring

### Check Logs
```bash
vercel logs --follow | grep "create-checkout"
vercel logs --follow | grep "webhook/deposit"
```

### Check Database
```sql
SELECT order_id, pkpay_order_id, status, amount
FROM deposit_history
ORDER BY created_at DESC
LIMIT 5;
```

---

## If Something Goes Wrong

### Check 1: Environment Variables
```
Vercel Dashboard → Settings → Environment Variables
Verify all PKPAY_* variables are set
```

### Check 2: Logs
```bash
vercel logs --follow
Look for errors in create-checkout or webhook
```

### Check 3: Database
```sql
SELECT * FROM deposit_history
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

---

## Timeline

- Update env vars: 2 min
- Replace DepositView: 1 min
- Deploy: 5 min
- Test: 7 min
- **Total: 15 minutes**

---

## Next Steps

1. ✅ Update environment variables
2. ✅ Replace DepositView.tsx
3. ✅ Deploy to Vercel
4. ✅ Test deposit flow
5. ✅ Monitor logs
6. ✅ Verify auto-credit works

**Go!** 🚀
