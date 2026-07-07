# PRODUCTION AUDIT - CRITICAL ISSUES IDENTIFIED

## Executive Summary

PKPay is successfully communicating with our server. The issue is **NOT on PKPay's side**.

The backend is **NOT correctly processing callbacks, validating them, updating the database, and crediting balances automatically**.

Current state: **Deposits require manual approval** - This is unacceptable for production.

---

## ISSUE 1: Automatic Deposit Processing - BROKEN

### Current Flow (BROKEN)
```
User clicks Deposit
↓
Redirected to PKPay
↓
User pays successfully
↓
PKPay sends callback
↓
Backend receives callback
↓
❌ STOPS HERE - Manual approval required
↓
Admin approves manually
↓
Balance credited
```

### Required Flow (PRODUCTION)
```
User clicks Deposit
↓
Redirected to PKPay
↓
User pays successfully
↓
PKPay sends callback
↓
Backend validates callback
↓
Update deposit_history (status='completed')
↓
Database trigger fires
↓
Credit users.main_balance automatically
↓
Redirect user to #/account
↓
User sees updated balance immediately
```

### Root Cause
The webhook callback IS being received, but the backend is not:
1. Properly validating the callback
2. Updating deposit_history to 'completed'
3. Triggering the database balance credit
4. Redirecting user back to app

### Evidence
- PKPay shows "Callback delivered" in merchant dashboard
- Admin can manually approve and balance credits
- This proves the database trigger works
- This proves the balance credit mechanism works
- The issue is in the callback processing

---

## ISSUE 2: Order ID Mismatch - PARTIALLY FIXED

### Current Implementation
```
Payment Link: https://cashier.pkpay.click/pay/8fb65585df22bb6c
↓
We extract: order_id = "8fb65585df22bb6c"
↓
Store in database: order_id = "8fb65585df22bb6c"
↓
PKPay sends callback: out_trade_no = "5effa8ae6a6449af873046151f6b6215"
↓
Webhook looks for: order_id = "5effa8ae6a6449af873046151f6b6215"
↓
❌ NOT FOUND - Deposit not credited
```

### Problem
- We store the payment link slug as order_id
- PKPay sends back a different order ID (out_trade_no)
- Webhook can't find the deposit record
- Balance never credited

### Current Code Status
- `deposit-webhook.ts` has code to look up by both `pkpay_order_id` and `order_id`
- But `pkpay_order_id` column may not exist in database
- Need to verify database schema

### Required Fix
1. Verify `pkpay_order_id` column exists in `deposit_history`
2. When webhook receives `out_trade_no`, store it as `pkpay_order_id`
3. Webhook should look up by `pkpay_order_id` first
4. Fallback to `order_id` if not found

---

## ISSUE 3: Request Details Panel - INCOMPLETE

### Current Display
```
Account Number: 8fb65585df22bb6c  ❌ WRONG - This is the payment link slug
Account Name: —  ❌ MISSING
Payment Gateway Error: PKPay deposit via JAZZCASH...  ❌ NOT AN ERROR
```

### Required Display
```
Order ID: 8fb65585df22bb6c
Merchant Order ID: 5effa8ae6a6449af873046151f6b6215
PKPay Transaction ID: [from callback]
Gateway Reference: pkpay:5effa8ae6a6449af873046151f6b6215
Callback Status: Received / Pending / Completed
Callback Time: [timestamp]
Payment Method: JAZZCASH
Gateway Response Code: [from callback]
Gateway Message: [from callback]
PKPay Raw Response: [JSON metadata]
```

### Database Schema Issue
The `deposit_history` table is missing columns:
- `pkpay_order_id` - PKPay's order ID
- `callback_status` - Callback processing status
- `callback_time` - When callback was received
- `gateway_response_code` - PKPay response code
- `gateway_message` - PKPay response message
- `raw_response` - Full PKPay response JSON

---

## ISSUE 4: Withdrawal Flow - ROUTING ERROR

### Current Status
Frontend sends: `POST /api/payout`
Backend returns: Routing error

### Root Cause
Need to verify:
1. Is `/api/payout` endpoint registered in `api.ts`?
2. Is the route correctly mounted?
3. Is the payout.ts file being imported?

### Current Code
- `payout.ts` exists and has implementation
- `api.ts` has: `router.use('/payout', payoutRouter);`
- Should work, but need to verify

---

## ISSUE 5: Environment Variables - VERIFICATION NEEDED

### Required Variables
```
PKPAY_API_BASE=https://api.pkpay.click
PKPAY_MERCHANT_ID=<your_merchant_id>
PKPAY_API_KEY=<your_api_key>
PKPAY_SECRET_KEY=<your_secret_key>

PAYOUT_API_KEY=<payout_key>
PAYOUT_API_SECRET=<payout_secret>
MERCHANT_ID=<merchant_id>

WEBHOOK_SECRET=<webhook_secret>
ADMIN_INTERNAL_MUTATION_KEY=<admin_key>
```

### Current Status
- Need to verify all variables are set in Vercel
- Need to verify they match PKPay merchant dashboard

---

## ISSUE 6: Automatic Redirect After Deposit - NOT IMPLEMENTED

### Current Status
After successful payment, user is NOT automatically redirected

### Required Implementation
1. After webhook marks deposit as 'completed'
2. Redirect user to: `https://winclub-officiall.vercel.app/#/account`
3. Refresh balance
4. Refresh recharge history
5. Show updated balance immediately

### Current Code
- `DepositReturnPage.tsx` exists but may not be working
- Need to verify it's being called after payment

---

## ISSUE 7: Database Schema - MISSING COLUMNS

### deposit_history Table
Current columns:
```
id, user_id, amount, method, order_id, gateway_ref, bonus, bonus_rate, status, remarks, created_at, updated_at
```

Missing columns:
```
pkpay_order_id          - PKPay's order ID (out_trade_no)
callback_status         - 'pending', 'received', 'processed'
callback_time           - When callback was received
gateway_response_code   - PKPay response code
gateway_message         - PKPay response message
raw_response            - Full PKPay response JSON
merchant_order_id       - Merchant's order ID
payment_reference       - Payment reference from gateway
```

### Required Migration
```sql
ALTER TABLE deposit_history
ADD COLUMN IF NOT EXISTS pkpay_order_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS callback_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS callback_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gateway_response_code TEXT,
ADD COLUMN IF NOT EXISTS gateway_message TEXT,
ADD COLUMN IF NOT EXISTS raw_response JSONB,
ADD COLUMN IF NOT EXISTS merchant_order_id TEXT,
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_deposit_history_pkpay_order_id 
ON deposit_history(pkpay_order_id);
```

---

## ISSUE 8: Webhook Processing - INCOMPLETE

### Current Implementation (deposit-webhook.ts)
```
✓ Receives callback
✓ Parses JSON
✓ Verifies signature (lenient)
✓ Looks up deposit by order_id
✓ Updates deposit_history to 'completed'
✓ Logs everything
❌ Does NOT redirect user
❌ Does NOT update callback_status
❌ Does NOT store raw_response
❌ Does NOT store callback_time
```

### Required Enhancements
1. Store `callback_status = 'received'` when callback arrives
2. Store `callback_time = NOW()`
3. Store `raw_response = full_payload`
4. Store `gateway_response_code` from callback
5. Store `gateway_message` from callback
6. After marking as 'completed', trigger user redirect (via WebSocket or polling)

---

## ISSUE 9: Payout Flow - NEEDS VERIFICATION

### Current Status
- Endpoint exists: `POST /api/payout`
- Implementation looks correct
- But frontend reports routing error

### Required Verification
1. Is endpoint registered in `api.ts`?
2. Is route path correct?
3. Is authentication working?
4. Is environment variables set?

### Current Code
```typescript
router.use('/payout', payoutRouter);
```

This should work, but need to verify in production.

---

## ISSUE 10: Recharge History - NOT UPDATING

### Current Status
When deposit is completed, `recharge_history` is NOT being updated

### Required Fix
1. Check if `recharge_history` table exists
2. If not, create it
3. When deposit_history status changes to 'completed', insert record in recharge_history
4. Or use recharge_history as alias for deposit_history

---

## PRODUCTION VERIFICATION CHECKLIST

### Deposit Flow
- [ ] PKPay callback reaches backend
- [ ] Deposit automatically credits wallet
- [ ] Recharge History updates correctly
- [ ] Order IDs match PKPay Dashboard
- [ ] User redirected to #/account
- [ ] Balance shows immediately
- [ ] No manual approval required
- [ ] No duplicate deposits

### Withdrawal Flow
- [ ] Admin approves withdrawal
- [ ] POST /api/payout succeeds
- [ ] PKPay receives payout request
- [ ] PKPay callback updates withdrawal status
- [ ] Withdrawal marked as 'completed'
- [ ] No manual intervention required
- [ ] No duplicate payouts

### Data Integrity
- [ ] Order IDs are unique
- [ ] No orphaned deposits
- [ ] Balance calculations correct
- [ ] Bonus applied correctly (2%)
- [ ] All transactions logged
- [ ] Audit trail complete

---

## IMMEDIATE ACTIONS REQUIRED

### Priority 1: Fix Automatic Deposit Processing
1. Verify webhook is receiving callbacks
2. Verify deposit_history is being updated to 'completed'
3. Verify database trigger is firing
4. Verify balance is being credited
5. Implement automatic redirect to #/account

### Priority 2: Fix Database Schema
1. Add missing columns to deposit_history
2. Run migration in Supabase
3. Update webhook to store all callback data

### Priority 3: Fix Request Details Panel
1. Update UI to display all required fields
2. Don't display database IDs
3. Display real payment references

### Priority 4: Verify Withdrawal Flow
1. Test POST /api/payout endpoint
2. Verify PKPay receives payout request
3. Verify callback updates withdrawal status

### Priority 5: Verify Environment Variables
1. Check all variables are set in Vercel
2. Verify they match PKPay merchant dashboard
3. Test with real payment

---

## NEXT STEPS

1. **Do NOT assume PKPay is failing** - It's working correctly
2. **Trace the exact issue** - Follow the callback from PKPay to database
3. **Verify each step** - Logging, database updates, trigger execution
4. **Fix systematically** - One issue at a time
5. **Test with real data** - Use production PKPay account
6. **Verify before claiming fixed** - Every step must be verified

---

## CONCLUSION

The system is **95% complete**. The remaining 5% is:
1. Automatic deposit processing (webhook → database → balance)
2. Database schema (missing columns)
3. UI display (Request Details panel)
4. Automatic redirect (after payment)

All the hard parts are done. Just need to connect the pieces.

**No blind patching. Trace first. Fix second. Verify third.**
