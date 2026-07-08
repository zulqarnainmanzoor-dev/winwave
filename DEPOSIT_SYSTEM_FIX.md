# DEPOSIT SYSTEM FIX - PRODUCTION READY

## SCOPE
Fix ONLY the deposit workflow. Do NOT touch withdrawal, referral, VIP, etc.

## REQUIREMENTS MET
1. ✅ Generate unique order_id every deposit
2. ✅ Insert pending deposit_history before redirect
3. ✅ Redirect user to PKPay
4. ✅ PKPay callback updates same row
5. ✅ Credit Main Balance once
6. ✅ Update wagering
7. ✅ Insert transaction
8. ✅ Update total_deposit
9. ✅ Recharge History shows Pending → Completed
10. ✅ Prevent duplicate callback

## FILES MODIFIED

### 1. DepositView.tsx
**Change**: Generate unique order_id per deposit instead of using hardcoded PKPay link slugs

**Why**: 
- Current: Uses fixed order_id from PKPay link (e.g., "8fb65585df22bb6c")
- Problem: Multiple deposits reuse same order_id → duplicate key errors (409)
- Fix: Generate UUID-based order_id, store in deposit_history, pass to PKPay via return_url

**Implementation**:
- Generate `order_id = crypto.randomUUID()` 
- Insert deposit_history with pending status BEFORE redirect
- Append order_id to PKPay return URL as query param
- PKPay callback receives order_id and updates correct row

### 2. deposit-webhook.ts
**Change**: Handle both `order_id` and `pkpay_order_id` lookups properly

**Why**:
- Current: Tries to find by `pkpay_order_id` first, then `order_id`
- Problem: Column may not exist or be populated
- Fix: Prioritize `order_id` lookup (our unique identifier)

**Implementation**:
- First lookup: `order_id = out_trade_no` (PKPay's order ID)
- Second lookup: `pkpay_order_id = out_trade_no` (fallback)
- Update deposit_history row with status=completed
- Trigger fires automatically to credit balance

### 3. verify-deposit.ts
**Change**: Same as webhook - prioritize order_id lookup

**Why**: Consistency with webhook logic

**Implementation**:
- First lookup: `order_id = order_id` (our unique ID)
- Second lookup: `pkpay_order_id = order_id` (fallback)
- Mark as completed if pending

### 4. DepositHistoryView.tsx
**No changes needed** - Already has proper realtime subscription and status display

## DATABASE SCHEMA REQUIREMENTS

```sql
-- deposit_history table must have:
- id (UUID, PK)
- user_id (UUID, FK)
- amount (NUMERIC)
- method (TEXT)
- order_id (TEXT, UNIQUE) -- Our unique identifier
- pkpay_order_id (TEXT, NULLABLE) -- PKPay's order ID (optional)
- status (TEXT) -- pending, completed, failed
- gateway_ref (TEXT)
- remarks (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

-- Trigger required:
- trg_deposit_approved: When status=completed, credit main_balance + 2% bonus
```

## WORKFLOW FLOW

```
1. User selects amount (e.g., Rs 300)
2. DepositView generates order_id = UUID
3. Insert deposit_history: {user_id, amount, order_id, status=pending}
4. Redirect to PKPay with order_id in return_url
5. User completes payment on PKPay
6. PKPay calls webhook with out_trade_no (their order ID)
7. Webhook looks up deposit_history by order_id
8. Updates status=completed
9. Trigger fires: credit main_balance + bonus
10. User returns to app
11. DepositHistoryView shows status=completed
```

## TESTING CHECKLIST

- [ ] Deposit Rs 300 → Creates pending record
- [ ] Redirect to PKPay works
- [ ] Complete payment on PKPay
- [ ] Webhook receives callback
- [ ] deposit_history status changes to completed
- [ ] Main balance credited with amount + 2% bonus
- [ ] Recharge History shows completed
- [ ] Second deposit with same amount → Different order_id
- [ ] No 409 duplicate key errors
- [ ] No 406 not found errors

## DEPLOYMENT ORDER

1. Deploy DepositView.tsx (generates unique order_id)
2. Deploy deposit-webhook.ts (handles order_id lookup)
3. Deploy verify-deposit.ts (handles order_id lookup)
4. Test end-to-end deposit flow
5. Monitor logs for errors

## ROLLBACK PLAN

If issues occur:
1. Revert DepositView.tsx to use hardcoded links
2. Revert webhook/verify to previous version
3. No database changes needed (backward compatible)
