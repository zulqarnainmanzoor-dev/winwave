# IMPLEMENTATION CHECKLIST

**Status**: Ready for implementation  
**Total Changes**: 4 files  
**Estimated Time**: 2-3 hours  
**Risk Level**: LOW (all changes are additive or bug fixes)

---

## FILE 1: backend/supabase/MASTER_PRODUCTION_SCHEMA.sql

### Change Type: ADD (New RPC Functions)
### Location: After line 400 (after submit_withdrawal function)
### Time: 15 minutes

**What to add**:
- `approve_withdrawal()` RPC function
- `fail_withdrawal()` RPC function

**Why**:
- Admin Dashboard calls these functions to approve/reject withdrawals
- Currently missing, causing all withdrawal approvals to fail

**Risk**: LOW - Only adding new functions, no existing code modified

**Verification**:
```sql
-- After adding, verify with:
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('approve_withdrawal', 'fail_withdrawal');
-- Should return 2 rows
```

---

## FILE 2: backend/api/payout.ts

### Change Type: MODIFY + ADD
### Changes: 2 modifications, 1 addition
### Time: 25 minutes

### Change 2.1: Fix account_no field name
**Location**: Line 80  
**Current**:
```typescript
account_number: withdrawal.account_number,
```
**Change to**:
```typescript
account_number: withdrawal.account_no,
```
**Why**: Database column is `account_no`, not `account_number`  
**Risk**: LOW - Simple field name fix

### Change 2.2: Add payout webhook handler
**Location**: After line 100 (after POST /payout handler)  
**What to add**: New webhook handler for payout status updates  
**Why**: Payout status never updated to "completed"  
**Risk**: LOW - New handler, doesn't affect existing code

**Verification**:
```bash
# After changes, verify endpoint exists:
curl -X POST http://localhost:3000/api/webhook/payout \
  -H "Content-Type: application/json" \
  -d '{"out_trade_no":"test","status":"success"}'
# Should return 200 OK
```

---

## FILE 3: backend/api/api.ts

### Change Type: REMOVE (Duplicate code)
### Location: Lines 31-35
### Time: 2 minutes

**Current code to remove**:
```typescript
router.post('/payout', (req, res, next) => {
  // Redirect to /payout endpoint for compatibility
  req.url = '/payout';
  payoutRouter(req, res, next);
});
```

**Why**: Duplicate routing - line 30 already handles this with `router.use('/payout', payoutRouter);`  
**Risk**: LOW - Removing duplicate code

**Verification**:
```bash
# After changes, verify only one handler:
grep -n "router.post('/payout'" backend/api/api.ts
# Should return 0 results (no direct POST handler)
```

---

## FILE 4: src/components/DepositView.tsx

### Change Type: MODIFY (Fix async race condition)
### Location: Lines 85-95
### Time: 5 minutes

**Current code**:
```typescript
try {
  const userId = (userContext as any)?.uid || null;
  if (!userId) {
    window.location.href = targetUrl;
    return;
  }

  void (async () => {
    try {
      // Insert into deposit_history with PKPay order_id
      await (supabase as any)
        .from('deposit_history')
        .insert([{...}]);
      console.log(`Created pending deposit for order_id: ${orderId}`);
      window.location.href = targetUrl;  // ← INSIDE async
    } catch (error) {
      console.error('Failed to create deposit record:', error);
      window.location.href = targetUrl;
    }
  })();
  return;
}
```

**Change to**:
```typescript
try {
  const userId = (userContext as any)?.uid || null;
  if (!userId) {
    window.location.href = targetUrl;
    return;
  }

  // Create pending deposit_history record BEFORE redirect
  try {
    await (supabase as any)
      .from('deposit_history')
      .insert([{
        user_id: userId,
        amount: amountToPay,
        method: selectedPaymentMethod.toUpperCase(),
        order_id: orderId,
        gateway_ref: targetUrl,
        status: 'pending',
        remarks: `PKPay deposit via ${selectedPaymentMethod.toUpperCase()}. Amount Rs ${amountToPay}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
    console.log(`Created pending deposit for order_id: ${orderId}`);
  } catch (error) {
    console.error('Failed to create deposit record:', error);
    // Continue anyway - webhook will create record
  }
  
  // NOW redirect (after insert completes or fails)
  window.location.href = targetUrl;
  return;
}
```

**Why**: Ensures deposit record is created before redirect  
**Risk**: LOW - Improves reliability, doesn't break existing flow

**Verification**:
```bash
# After changes, test deposit flow:
1. Click "Pay Now"
2. Check database: SELECT * FROM deposit_history WHERE order_id = '<order_id>'
3. Should see pending record BEFORE redirect
```

---

## FILE 5: PKPay Dashboard (Configuration)

### Change Type: VERIFY (No code changes)
### Location: PKPay Merchant Settings
### Time: 5 minutes

**What to verify**:
1. Webhook URL is set to: `https://winclub-officiall.vercel.app/api/webhook/deposit`
2. Webhook secret matches `WEBHOOK_SECRET` environment variable
3. Webhook is enabled
4. Webhook method is POST
5. Content-Type is application/json

**Why**: Webhook not reaching backend  
**Risk**: NONE - Configuration only

**Verification**:
```bash
# After verification, test webhook:
1. Go to PKPay Dashboard
2. Find "Send Test Webhook" button
3. Click it
4. Check backend logs for: "[webhook/deposit] PKPAY WEBHOOK HIT"
5. Should see success message
```

---

## ENVIRONMENT VARIABLES TO VERIFY

### Required Variables
```
WEBHOOK_SECRET=<pkpay_webhook_secret>
Payout_API_key=<pkpay_payout_api_key>
Payout_API_secret=<pkpay_payout_api_secret>
Merchant_ID=<pkpay_merchant_id>
ADMIN_INTERNAL_MUTATION_KEY=<admin_secret_token>
```

### Verification Checklist
- [ ] All variables set in Vercel
- [ ] All variables set in .env.local
- [ ] Values match PKPay Dashboard
- [ ] No typos in variable names

---

## IMPLEMENTATION ORDER

### Step 1: Database Changes (15 min)
1. Open `backend/supabase/MASTER_PRODUCTION_SCHEMA.sql`
2. Add `approve_withdrawal()` RPC function
3. Add `fail_withdrawal()` RPC function
4. Deploy to Supabase

### Step 2: Backend Changes (30 min)
1. Open `backend/api/payout.ts`
2. Fix account_no field name (line 80)
3. Add payout webhook handler
4. Open `backend/api/api.ts`
5. Remove duplicate payout routing (lines 31-35)
6. Test locally

### Step 3: Frontend Changes (5 min)
1. Open `src/components/DepositView.tsx`
2. Fix async race condition
3. Test locally

### Step 4: Configuration (5 min)
1. Verify webhook URL in PKPay Dashboard
2. Verify environment variables
3. Test webhook delivery

### Step 5: Testing (1-2 hours)
1. Test deposit flow locally
2. Test payout flow locally
3. Test webhook delivery
4. Test admin approval/rejection

### Step 6: Deployment (30 min)
1. Deploy schema changes
2. Deploy backend changes
3. Deploy frontend changes
4. Verify in production

---

## TESTING CHECKLIST

### Local Testing (with ngrok)
- [ ] Deposit creates pending record before redirect
- [ ] Webhook receives and processes deposit
- [ ] Webhook updates existing record (no duplicates)
- [ ] Admin can approve withdrawal
- [ ] Admin can reject withdrawal
- [ ] Payout API sends to PKPay
- [ ] Payout webhook updates status to completed
- [ ] Balance updated correctly
- [ ] No errors in logs

### Production Testing
- [ ] Deposit flow works end-to-end
- [ ] Payout flow works end-to-end
- [ ] Webhook delivery successful
- [ ] User receives funds
- [ ] Balance updated correctly
- [ ] No duplicate records
- [ ] Realtime updates work

---

## ROLLBACK PLAN

If anything breaks:

### Rollback Database
```sql
-- Remove new RPC functions
DROP FUNCTION IF EXISTS public.approve_withdrawal(UUID);
DROP FUNCTION IF EXISTS public.fail_withdrawal(UUID, TEXT);
```

### Rollback Backend
```bash
# Revert payout.ts to previous version
git checkout backend/api/payout.ts
git checkout backend/api/api.ts
```

### Rollback Frontend
```bash
# Revert DepositView.tsx to previous version
git checkout src/components/DepositView.tsx
```

---

## MONITORING AFTER DEPLOYMENT

### Logs to Monitor
```
[webhook/deposit] PKPAY WEBHOOK HIT
[webhook/payout] PKPAY PAYOUT WEBHOOK HIT
[payout] Initiating secure payout
[payout] Gateway response
```

### Metrics to Track
- Webhook delivery success rate
- Payout success rate
- Duplicate record count
- Error rate

### Alerts to Set Up
- Webhook delivery failure
- Payout failure
- Database errors
- API errors

---

## SIGN-OFF CHECKLIST

Before marking as complete:

- [ ] All code changes implemented
- [ ] All tests passed locally
- [ ] All tests passed in production
- [ ] No errors in logs
- [ ] No duplicate records
- [ ] User funds received
- [ ] Balance updated correctly
- [ ] Realtime updates work
- [ ] Documentation updated
- [ ] Team notified

---

## ESTIMATED TIMELINE

| Phase | Task | Time |
|-------|------|------|
| 1 | Database changes | 15 min |
| 2 | Backend changes | 30 min |
| 3 | Frontend changes | 5 min |
| 4 | Configuration | 5 min |
| 5 | Local testing | 1-2 hours |
| 6 | Deployment | 30 min |
| 7 | Production testing | 1 hour |
| **Total** | | **3-4 hours** |

---

## NOTES

- All changes are backward compatible
- No breaking changes to existing APIs
- No database schema changes (only new functions)
- No frontend breaking changes
- Can be deployed incrementally

---

**Ready to implement**: ✅  
**Risk level**: LOW  
**Estimated time**: 3-4 hours  
**Confidence**: 95%

