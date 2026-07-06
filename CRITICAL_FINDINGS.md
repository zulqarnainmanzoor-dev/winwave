# CRITICAL FINDINGS - BLOCKING ISSUES

**Status**: AUDIT COMPLETE  
**Severity**: 🔴 CRITICAL - Multiple blocking issues found  
**Action Required**: IMMEDIATE

---

## ISSUE #1: Missing RPC Functions (BLOCKING)

### Problem
Admin Dashboard calls RPC functions that don't exist:
- `approve_withdrawal()` - Called by FundsManagement.tsx line 180
- `fail_withdrawal()` - Called by FundsManagement.tsx line 220

### Evidence
- Searched MASTER_PRODUCTION_SCHEMA.sql
- No `CREATE OR REPLACE FUNCTION public.approve_withdrawal` found
- No `CREATE OR REPLACE FUNCTION public.fail_withdrawal` found
- Only `submit_withdrawal()` RPC exists

### Impact
- ❌ Admin cannot approve withdrawals
- ❌ Admin cannot reject withdrawals
- ❌ All withdrawal approvals fail with "function not found" error
- ❌ Payout flow completely broken

### Files Affected
- `src/admin/pages/FundsManagement.tsx` - Lines 180, 220
- `backend/api/payout.ts` - Depends on approve_withdrawal RPC

### Solution Required
Create two RPC functions in MASTER_PRODUCTION_SCHEMA.sql:

```sql
-- Approve withdrawal: deduct balance, set status to processing
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_balance NUMERIC;
BEGIN
  -- Fetch withdrawal details
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- Check if already processed
  SELECT status INTO v_balance
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id;

  IF v_balance IN ('completed', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  -- Verify balance
  SELECT main_balance INTO v_balance
  FROM public.users
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  UPDATE public.users
  SET main_balance = main_balance - v_amount
  WHERE id = v_user_id;

  -- Set status to processing
  UPDATE public.withdrawal_history
  SET status = 'processing', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID) TO authenticated;

-- Reject withdrawal: refund balance, set status to rejected
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_withdrawal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Fetch withdrawal details
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.withdrawal_history
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- Refund balance
  UPDATE public.users
  SET main_balance = main_balance + v_amount
  WHERE id = v_user_id;

  -- Set status to rejected
  UPDATE public.withdrawal_history
  SET status = 'rejected', reason = p_reason, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_withdrawal(UUID, TEXT) TO authenticated;
```

---

## ISSUE #2: Payout Webhook Not Implemented (BLOCKING)

### Problem
Payout webhook endpoint exists but has no handler:
- `api.ts` line 19: `router.post('/webhook/payout', payoutRouter);`
- `payout.ts` has no webhook handler
- Payout status never updated to "completed"

### Impact
- ❌ Payout status stuck at "processing"
- ❌ User never receives funds
- ❌ Admin sees withdrawal as pending forever

### Solution Required
Add webhook handler to `payout.ts`:

```typescript
// Add to payout.ts after the POST /payout handler

router.post('/webhook', async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  console.log(`[webhook/payout][${requestId}] PKPAY PAYOUT WEBHOOK HIT`);
  
  try {
    const payload = req.body;
    const { out_trade_no, status, transaction_id } = payload;

    if (!out_trade_no) {
      return res.status(200).json({ received: true, note: "Missing out_trade_no" });
    }

    // Find withdrawal by ID
    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from("withdrawal_history")
      .select("*")
      .eq("id", out_trade_no)
      .maybeSingle();

    if (fetchError || !withdrawal) {
      console.error(`[webhook/payout][${requestId}] Withdrawal not found: ${out_trade_no}`);
      return res.status(200).json({ received: true, note: "Withdrawal not found" });
    }

    // Check if already completed
    if (withdrawal.status === "completed") {
      console.log(`[webhook/payout][${requestId}] Already completed`);
      return res.status(200).json({ code: 0, msg: "already_processed" });
    }

    // Update status based on PKPay response
    const isSuccess = ["success", "SUCCESS", "1"].includes(String(status).toUpperCase());
    
    if (isSuccess) {
      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_history")
        .update({
          status: "completed",
          gateway_ref: transaction_id || out_trade_no,
          updated_at: new Date().toISOString(),
        })
        .eq("id", out_trade_no);

      if (updateError) {
        console.error(`[webhook/payout][${requestId}] Update error:`, updateError);
        return res.status(500).json({ error: "Update failed" });
      }

      console.log(`[webhook/payout][${requestId}] ✅ Payout completed for ${out_trade_no}`);
      return res.status(200).json({ code: 0, msg: "success" });
    } else {
      // Mark as failed
      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_history")
        .update({
          status: "failed",
          remarks: `PKPay payout failed (status=${status})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", out_trade_no);

      console.log(`[webhook/payout][${requestId}] ✗ Payout failed for ${out_trade_no}`);
      return res.status(200).json({ code: 0, msg: "noted_failed" });
    }

  } catch (error: any) {
    console.error(`[webhook/payout] Error:`, error?.message);
    return res.status(200).json({ success: false, error: error?.message });
  }
});
```

---

## ISSUE #3: Account Number Field Mismatch (BLOCKING)

### Problem
Database schema uses `account_no` but payout.ts sends `account_number`:
- Database column: `withdrawal_history.account_no`
- Payout API sends: `account_number: withdrawal.account_number`
- Result: Undefined value sent to PKPay

### Evidence
- `MASTER_PRODUCTION_SCHEMA.sql` line 350: `account_no TEXT,`
- `payout.ts` line 80: `account_number: withdrawal.account_number,`

### Impact
- ❌ PKPay receives undefined account number
- ❌ Payout fails with "invalid account"
- ❌ User funds not transferred

### Solution
Change `payout.ts` line 80:
```typescript
// FROM:
account_number: withdrawal.account_number,

// TO:
account_number: withdrawal.account_no,
```

---

## ISSUE #4: Async Race Condition in DepositView.tsx (BLOCKING)

### Problem
Creates deposit record ASYNC but redirects immediately:
```typescript
// Line ~90: Async insert
await (supabase as any)
  .from('deposit_history')
  .insert([{...}]);

// Line ~95: Immediate redirect (doesn't wait for insert)
window.location.href = targetUrl;
```

### Impact
- ⚠️ If redirect happens before insert completes → webhook finds no record
- ⚠️ Webhook creates new record (works but not ideal)
- ⚠️ Race condition can cause duplicate records

### Solution
Ensure redirect waits for insert:
```typescript
try {
  await (supabase as any)
    .from('deposit_history')
    .insert([{...}]);
  console.log(`Created pending deposit for order_id: ${orderId}`);
} catch (error) {
  console.error('Failed to create deposit record:', error);
}
// Now redirect (after insert completes)
window.location.href = targetUrl;
```

---

## ISSUE #5: Duplicate Payout Routing (MINOR)

### Problem
`api.ts` has duplicate routing for `/payout`:
- Line 30: `router.use('/payout', payoutRouter);`
- Line 31-35: `router.post('/payout', ...)`

### Impact
- ⚠️ Both handlers might execute
- ⚠️ Unpredictable behavior

### Solution
Remove lines 31-35, keep only `router.use('/payout', payoutRouter);`

---

## ISSUE #6: Webhook Not Reaching Backend (CRITICAL)

### Problem
PKPay Dashboard shows: "Callback Delivered: 0 Attempts"
- Webhook handler has comprehensive logging
- No logs appear in backend
- Deposits not created automatically

### Root Cause
Webhook URL not registered in PKPay Dashboard OR incorrect URL

### Solution Required
1. **Verify webhook URL in PKPay Dashboard**:
   - Go to PKPay Merchant Settings
   - Check Webhook URL configuration
   - Should be: `https://winclub-officiall.vercel.app/api/webhook/deposit`

2. **Verify environment variables**:
   - `WEBHOOK_SECRET` must be set in Vercel
   - Must match PKPay webhook secret

3. **Test locally**:
   - Use ngrok to expose local server
   - Update webhook URL in PKPay Dashboard to ngrok URL
   - Send test webhook
   - Verify logs appear

---

## ISSUE #7: Missing Environment Variables

### Required Variables Not Verified
- [ ] `WEBHOOK_SECRET` - Webhook signature verification
- [ ] `Payout_API_key` - PKPay payout API key
- [ ] `Payout_API_secret` - PKPay payout API secret
- [ ] `Merchant_ID` - PKPay merchant ID
- [ ] `ADMIN_INTERNAL_MUTATION_KEY` - Admin secret token

### Solution
1. Verify all variables set in Vercel
2. Verify all variables set in .env.local
3. Verify values match PKPay Dashboard

---

## IMPLEMENTATION ORDER

### Phase 1: CRITICAL (Must fix before testing)
1. ✅ Create `approve_withdrawal()` RPC function
2. ✅ Create `fail_withdrawal()` RPC function
3. ✅ Implement payout webhook handler
4. ✅ Fix account_no field name in payout.ts
5. ✅ Fix async race condition in DepositView.tsx
6. ✅ Remove duplicate payout routing
7. ✅ Verify webhook URL in PKPay Dashboard
8. ✅ Verify all environment variables

### Phase 2: TESTING
1. Test deposit flow locally with ngrok
2. Test payout flow locally
3. Test webhook delivery
4. Test admin approval/rejection
5. Deploy to production
6. Test in production

### Phase 3: MONITORING
1. Monitor webhook delivery
2. Monitor payout success rate
3. Monitor error logs
4. Set up alerts

---

## VERIFICATION CHECKLIST

After implementing all fixes:

- [ ] `approve_withdrawal()` RPC exists and works
- [ ] `fail_withdrawal()` RPC exists and works
- [ ] Payout webhook handler implemented
- [ ] Account number field corrected
- [ ] Async race condition fixed
- [ ] Duplicate routing removed
- [ ] Webhook URL registered in PKPay Dashboard
- [ ] All environment variables set
- [ ] Deposit creates pending record before redirect
- [ ] Webhook updates existing record (no duplicates)
- [ ] Admin can approve withdrawals
- [ ] Admin can reject withdrawals
- [ ] Payout API sends to PKPay
- [ ] Payout webhook updates status to completed
- [ ] User receives funds
- [ ] Balance updated correctly
- [ ] No duplicate records created
- [ ] Realtime updates work
- [ ] All flows tested end-to-end

---

## NEXT IMMEDIATE ACTIONS

1. **RIGHT NOW**: Create the two missing RPC functions
2. **RIGHT NOW**: Implement payout webhook handler
3. **RIGHT NOW**: Fix account_no field name
4. **RIGHT NOW**: Fix async race condition
5. **RIGHT NOW**: Verify webhook URL in PKPay Dashboard
6. **THEN**: Test locally with ngrok
7. **THEN**: Deploy to production
8. **THEN**: Verify all flows work

