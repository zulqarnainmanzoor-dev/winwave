# PKPay Return URL - Quick Fix Action Plan

## Problem
- Users stuck on PKPay checkout page after payment
- No redirect back to app
- Order ID keeps changing (new checkout sessions)
- Balance not credited

## Root Cause
**Return URL not configured in PKPay merchant dashboard**

PKPay doesn't know where to redirect users after payment.

---

## Solution (10 minutes)

### Step 1: Deploy Code (2 minutes)
```bash
cd c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww
git add .
git commit -m "Fix: Remove return_url query parameter - configure in PKPay dashboard instead"
git push
```

### Step 2: Configure PKPay Return URL (5 minutes)
1. Log in to PKPay merchant dashboard
2. Go to Payment Links section
3. For EACH payment link, configure:
   - **Return URL:** `https://winclub-officiall.vercel.app/#/deposit-return`
   - **Webhook URL:** `https://winclub-officiall.vercel.app/api/webhook/deposit`
4. Save settings

### Step 3: Test (3 minutes)
1. Open your app
2. Go to Deposit
3. Select Rs 300
4. Click "Pay with Jazzcash"
5. Complete payment
6. Should redirect back to app
7. Should see "Success!" message
8. Balance should be updated

---

## What to Configure in PKPay Dashboard

### For Each Payment Link
```
Payment Link: https://cashier.pkpay.click/pay/8fb65585df22bb6c

Settings:
├─ Return URL: https://winclub-officiall.vercel.app/#/deposit-return
├─ Webhook URL: https://winclub-officiall.vercel.app/api/webhook/deposit
└─ Success Message: "Payment Successful"
```

### All Payment Links
```
Jazzcash:
- 300:   8fb65585df22bb6c
- 500:   7099555e5d96948a
- 800:   b40a681c9347518b
- 1000:  e6adf22d1645a3c1
- 2000:  c9c08cd3ac807b7b
- 3000:  2e2843558794d95a
- 5000:  9e1931ee76a1c7be
- 8000:  3b953ec0d8c699cb
- 10000: bfa519a4a3557a4e
- 20000: c0346b6c6f66d9e1
- 30000: 46ed4014c01a2dd2
- 50000: aa3071795294a6ed

Easypaisa:
- 50000: 387931f98134400e
- 30000: 67e964fd8f780f66
- 20000: 443568805ecbdd84
- 10000: a9038d8ae209d6d7
- 8000:  ba86795097ff5508
- 5000:  10b2aad1347174b4
- 3000:  efc061dbaff90b93
- 2000:  4428560b30bfb6d1
- 1000:  8ad27749f7849fae
- 800:   d0c12155e83081d0
- 500:   d74d75b92aa0c111
- 300:   445f3a965fe98b38

For each: Set Return URL to https://winclub-officiall.vercel.app/#/deposit-return
```

---

## How It Works

### User Flow
```
1. User clicks "Pay Now"
   ↓
2. Redirected to PKPay checkout
   ↓
3. User completes payment
   ↓
4. PKPay sends webhook callback
   ↓
5. PKPay redirects to return URL
   ↓
6. DepositReturnPage verifies deposit
   ↓
7. Balance credited
   ↓
8. User sees success message ✅
```

---

## Testing Checklist

- [ ] Deploy code to Vercel
- [ ] Log in to PKPay merchant dashboard
- [ ] Configure return URL for at least one payment link
- [ ] Make test deposit (Rs 300)
- [ ] Complete payment on PKPay
- [ ] Verify redirect back to app
- [ ] Check balance is updated
- [ ] Check deposit history shows "Completed"
- [ ] Test with different amount
- [ ] Monitor Vercel logs for errors

---

## Success Indicators

✅ Redirected back to app after payment
✅ See "Success!" message
✅ Balance updated with 2% bonus
✅ Deposit history shows "Completed"
✅ No errors in logs
✅ Webhook callback received

---

## If Still Not Working

### Check 1: Return URL Configured?
```
1. Log in to PKPay dashboard
2. Go to payment link settings
3. Verify return URL is set
4. If not, add it and save
```

### Check 2: Webhook Configured?
```
1. Log in to PKPay dashboard
2. Go to webhook settings
3. Verify webhook URL is: https://winclub-officiall.vercel.app/api/webhook/deposit
4. If not, add it and save
```

### Check 3: Check Logs
```bash
vercel logs --follow
```

Look for:
```
[DepositReturnPage] Verifying deposit
[verify-deposit] Marking deposit as completed
```

---

## Timeline

- Deploy: 2 minutes
- Configure PKPay: 5 minutes
- Test: 3 minutes
- **Total: 10 minutes**

---

## Files Modified

1. `src/components/DepositView.tsx` - Removed return_url query parameter

---

## Next Steps

1. ✅ Deploy code
2. ✅ Configure PKPay return URL
3. ✅ Test payment flow
4. ✅ Verify balance updated
5. ✅ Monitor logs

**Go!** 🚀
