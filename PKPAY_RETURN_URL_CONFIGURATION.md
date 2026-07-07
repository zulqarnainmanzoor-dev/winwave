# PKPay Return URL Configuration - Complete Guide

## The Problem

You're stuck on PKPay checkout page after payment because:
1. Return URL is not configured in PKPay merchant dashboard
2. PKPay doesn't know where to redirect users after payment
3. Each checkout creates a new session (different order ID)

## The Solution

Configure the return URL in PKPay merchant dashboard so users are redirected back to your app after payment.

---

## Step-by-Step Configuration

### Step 1: Log in to PKPay Merchant Dashboard
1. Go to: https://merchant.pkpay.click (or your PKPay merchant portal)
2. Log in with your merchant credentials

### Step 2: Find Payment Link Settings
1. Go to "Payment Links" or "Payments" section
2. Find the payment links you created (for each amount)
3. Look for settings/configuration option

### Step 3: Configure Return URL
For each payment link, set the return URL to:

**For successful payment:**
```
https://winclub-officiall.vercel.app/#/deposit-return
```

**Alternative (with order ID):**
```
https://winclub-officiall.vercel.app/#/deposit-return?order_id={order_id}
```

### Step 4: Save Settings
1. Save the configuration
2. Test with a payment link

---

## What Each Payment Link Should Have

### Jazzcash Links
```
300:   https://cashier.pkpay.click/pay/8fb65585df22bb6c
       Return URL: https://winclub-officiall.vercel.app/#/deposit-return

500:   https://cashier.pkpay.click/pay/7099555e5d96948a
       Return URL: https://winclub-officiall.vercel.app/#/deposit-return

1000:  https://cashier.pkpay.click/pay/e6adf22d1645a3c1
       Return URL: https://winclub-officiall.vercel.app/#/deposit-return

... and so on for all amounts
```

### Easypaisa Links
```
Same pattern for all Easypaisa links
```

---

## How It Works After Configuration

### Before (Broken)
```
1. User clicks "Pay Now"
2. Redirected to PKPay checkout
3. User completes payment
4. PKPay shows "Payment Successful"
5. User stuck on PKPay page ❌
6. No redirect back to app
```

### After (Fixed)
```
1. User clicks "Pay Now"
2. Redirected to PKPay checkout
3. User completes payment
4. PKPay shows "Payment Successful"
5. PKPay redirects to: https://winclub-officiall.vercel.app/#/deposit-return
6. DepositReturnPage verifies deposit
7. Balance credited
8. User sees success message ✅
```

---

## Testing

### Test 1: Check Return URL is Configured
1. Open PKPay merchant dashboard
2. Go to payment link settings
3. Verify return URL is set to: `https://winclub-officiall.vercel.app/#/deposit-return`

### Test 2: Make Test Payment
1. Open your app
2. Go to Deposit
3. Select Rs 300
4. Click "Pay with Jazzcash"
5. Complete payment on PKPay
6. Should redirect back to app
7. Should see "Success!" message
8. Balance should be updated

### Test 3: Check Logs
```bash
vercel logs --follow
```

Look for:
```
[DepositReturnPage] Verifying deposit
[verify-deposit] Marking deposit as completed
```

---

## Troubleshooting

### Issue: Still stuck on PKPay checkout
**Cause:** Return URL not configured in PKPay dashboard
**Fix:** 
1. Log in to PKPay merchant dashboard
2. Find payment link settings
3. Add return URL: `https://winclub-officiall.vercel.app/#/deposit-return`
4. Save and test again

### Issue: Redirected but balance not updated
**Cause:** Webhook not working or return page not calling verify endpoint
**Fix:**
1. Check Vercel logs for errors
2. Verify deposit record exists in database
3. Check if webhook callback was received

### Issue: Different order ID each time
**Cause:** Creating new checkout sessions instead of reusing payment link
**Fix:**
1. Use the same payment link for each amount
2. Don't create new checkout sessions
3. Each amount should have one fixed payment link

---

## Payment Link Structure

### Current Setup
```
Amount: Rs 300
Payment Link: https://cashier.pkpay.click/pay/8fb65585df22bb6c
Return URL: https://winclub-officiall.vercel.app/#/deposit-return
Webhook URL: https://winclub-officiall.vercel.app/api/webhook/deposit
```

### What Happens
```
1. User clicks "Pay Now" with Rs 300
2. Redirected to: https://cashier.pkpay.click/pay/8fb65585df22bb6c
3. User completes payment
4. PKPay sends webhook to: https://winclub-officiall.vercel.app/api/webhook/deposit
5. PKPay redirects to: https://winclub-officiall.vercel.app/#/deposit-return
6. Both webhook and return page credit balance
```

---

## Important Notes

### ✅ Do This
- Configure return URL for each payment link
- Use the same payment link for each amount
- Test with small amounts first
- Monitor logs for errors

### ❌ Don't Do This
- Create new checkout sessions each time
- Use different payment links for same amount
- Skip return URL configuration
- Ignore webhook errors

---

## Configuration Checklist

- [ ] Log in to PKPay merchant dashboard
- [ ] Find payment link settings
- [ ] For each payment link, set return URL to: `https://winclub-officiall.vercel.app/#/deposit-return`
- [ ] Save settings
- [ ] Test with Rs 300 payment
- [ ] Verify redirect back to app
- [ ] Check balance is updated
- [ ] Test with different amounts
- [ ] Monitor logs for errors

---

## Support

If you can't find the return URL setting in PKPay dashboard:

1. **Contact PKPay Support**
   - Ask how to configure return URL for payment links
   - Ask for documentation on redirect configuration

2. **Check PKPay Documentation**
   - Look for "Return URL" or "Redirect URL" settings
   - Look for "Payment Link Configuration"

3. **Alternative: Use Webhook Only**
   - If return URL not available, rely on webhook
   - Webhook will still credit balance
   - Users won't see immediate redirect but balance will update

---

## Summary

**The Issue:** Users stuck on PKPay checkout page after payment

**The Cause:** Return URL not configured in PKPay merchant dashboard

**The Fix:** 
1. Log in to PKPay merchant dashboard
2. Configure return URL for each payment link
3. Set to: `https://winclub-officiall.vercel.app/#/deposit-return`
4. Save and test

**Result:** Users redirected back to app after payment, balance updated automatically

**Time to fix:** 5-10 minutes
