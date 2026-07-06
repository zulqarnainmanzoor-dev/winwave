# COMPLETE DEPENDENCY AUDIT - PRIORITY 1-5 FLOWS

**Date**: Current Session  
**Status**: AUDIT COMPLETE - READY FOR IMPLEMENTATION  
**Scope**: All 5 Priority flows traced end-to-end

---

## PRIORITY 1: PKPAY DEPOSIT FLOW

### FLOW TRACE

```
User Clicks "Pay Now" (DepositView.tsx)
    ↓
handlePayNow() extracts order_id from PKPay URL
    ↓
Creates pending deposit_history record (ASYNC)
    ↓
Redirects to PKPay payment link
    ↓
User completes payment on PKPay
    ↓
PKPay sends webhook to /api/webhook/deposit
    ↓
deposit-webhook.ts receives payload
    ↓
Verifies HMAC-SHA256 signature
    ↓
Finds existing deposit_history by order_id
    ↓
Updates status to "pending" (webhook stores as pending)
    ↓
Admin Dashboard fetches deposit_history
    ↓
Admin clicks "Approve"
    ↓
Calls approve_withdrawal RPC
    ↓
RPC deducts balance, sets status to "processing"
    ↓
Admin Dashboard calls /api/payout
    ↓
Payout API sends to PKPay
    ↓
PKPay webhook updates status to "completed"
    ↓
Database trigger fn_on_deposit_approved fires
    ↓
users.main_balance += amount
```

### FILES INVOLVED

**Frontend (User)**
- `src/components/DepositView.tsx` - Creates pending record before redirect
- `src/context/UserContext.tsx` - Manages user balance state

**Frontend (Admin)**
- `src/admin/pages/FundsManagement.tsx` - Fetches deposit_history, displays requests
- `src/components/DepositHistoryView.tsx` - User recharge history view

**Backend**
- `backend/lib/pkpay.ts` - Webhook URL generation
- `backend/api/api.ts` - Express router, canonical endpoints
- `backend/api/deposit-webhook.ts` - Webhook handler
- `backend/api/payout.ts` - Payout API

**Database**
- `deposit_history` table - Stores all deposits
- `users` table - Stores balances
- `fn_on_deposit_approved()` trigger - Credits balance on completion

### CURRENT STATE ANALYSIS

#### ✅ WORKING
1. **Webhook URL Generation** (`pkpay.ts`)
   - Correctly generates: `https://winclub-officiall.vercel.app/api/webhook/deposit`
   - Supports dev/prod overrides via env vars
   - Single source of truth

2. **Express Routing** (`api.ts`)
   - Canonical endpoint: `POST /api/webhook/deposit`
   - Correctly routed to `depositWebhookHandler`
   - Legacy alias `/webhooks/pkpay` forwards to canonical

3. **Webhook Handler** (`deposit-webhook.ts`)
   - ✅ Signature verification (HMAC-SHA256)
   - ✅ Idempotency check (finds existing by order_id)
   - ✅ Handles already_processed gracefully
   - ✅ Stores as "pending" (correct - admin approves)
   - ✅ Calculates 2% bonus
   - ✅ Comprehensive logging

4. **Database Schema** (`MASTER_PRODUCTION_SCHEMA.sql`)
   - ✅ `deposit_history` table exists with correct columns
   - ✅ `fn_on_deposit_approved()` trigger exists
   - ✅ Trigger credits ONLY `main_balance` (never `game_balance`)
   - ✅ RLS policies configured

#### ⚠️ ISSUES FOUND

1. **DepositView.tsx - Async Race Condition**
   - Line ~90: Creates deposit_history record ASYNC
   - Immediately redirects to PKPay (line ~95)
   - If redirect happens before insert completes → webhook finds no record
   - **FIX**: Await the insert before redirect

2. **Deposit.tsx - No Record Creation**
   - Line ~150: Does NOT create deposit_history record
   - Only redirects to PKPay
   - Webhook will create record on first arrival (works but not ideal)
   - **FIX**: Add record creation like DepositView.tsx

3. **Webhook Status Logic**
   - Currently stores as "pending" (correct)
   - But comment says "pending for admin approval" (confusing)
   - Should clarify: webhook stores as "pending", admin approves to "completed"

4. **Admin Dashboard Query**
   - ✅ Correctly queries `deposit_history`
   - ✅ Correctly selects all required fields
   - ✅ Correctly maps data for display

5. **Payout API**
   - ✅ Uses PAYOUT_API_KEY and PAYOUT_API_SECRET (correct credentials)
   - ✅ Handles "already_processed" from gateway
   - ✅ Reverts to "pending" on failure
   - ✅ Updates status to "completed" on success

#### 🔴 CRITICAL ISSUE: Webhook Not Reaching Backend

**Evidence**:
- PKPay Dashboard shows: "Callback Delivered: 0 Attempts"
- Webhook handler has comprehensive logging but no logs appear
- Deposits are NOT being created automatically

**Root Cause Analysis**:
1. **Webhook URL Configuration**
   - `pkpay.ts` generates correct URL
   - But is this URL registered in PKPay Dashboard?
   - Need to verify: PKPay Merchant Settings → Webhook URL

2. **Possible Issues**:
   - Webhook URL not registered in PKPay Dashboard
   - Webhook URL is old/different domain
   - Vercel deployment not receiving requests
   - Firewall/CORS blocking webhook

3. **Verification Needed**:
   - Check PKPay Dashboard webhook configuration
   - Verify webhook URL matches `getWebhookUrl()` output
   - Test webhook locally with ngrok
   - Check Vercel logs for incoming requests

---

## PRIORITY 2: WEBHOOK CALLBACK AUDIT

### WEBHOOK REGISTRATION CHECKLIST

**Required in PKPay Dashboard**:
- [ ] Webhook URL: `https://winclub-officiall.vercel.app/api/webhook/deposit`
- [ ] Method: POST
- [ ] Content-Type: application/json
- [ ] Signature verification: Enabled (HMAC-SHA256)
- [ ] Webhook secret: Matches `WEBHOOK_SECRET` env var

**Backend Configuration**:
- ✅ `WEBHOOK_SECRET` read from env vars (multiple fallbacks)
- ✅ Signature verification implemented
- ✅ Comprehensive error logging
- ✅ Idempotency check implemented

**Express Configuration**:
- ✅ Body parser configured (Express default)
- ✅ JSON parsing enabled
- ✅ Canonical endpoint registered
- ✅ Legacy alias configured

### WEBHOOK FLOW VERIFICATION

```
PKPay Payment Success
    ↓
PKPay reads webhook URL from Dashboard
    ↓
PKPay sends POST to /api/webhook/deposit
    ↓
Vercel receives request
    ↓
Express routes to depositWebhookHandler
    ↓
Handler logs: "[webhook/deposit] PKPAY WEBHOOK HIT"
    ↓
Handler verifies signature
    ↓
Handler checks idempotency
    ↓
Handler updates deposit_history
    ↓
Handler returns 200 OK
```

### CURRENT ISSUES

1. **Webhook Not Arriving**
   - No logs in backend
   - PKPay Dashboard shows 0 attempts
   - **ACTION**: Verify webhook URL in PKPay Dashboard

2. **Possible Vercel Issues**
   - Deployment might not be live
   - Environment variables not set
   - Function timeout
   - **ACTION**: Check Vercel deployment logs

3. **Local Testing**
   - Need to test with ngrok
   - Verify webhook handler works locally
   - **ACTION**: Use webhook-test.ts endpoint

---

## PRIORITY 3: AUTO PAYOUT FLOW

### FLOW TRACE

```
Admin clicks "Approve Withdrawal"
    ↓
FundsManagement.tsx calls approve_withdrawal RPC
    ↓
RPC deducts balance from users.main_balance
    ↓
RPC sets withdrawal_history.status = "processing"
    ↓
RPC returns success
    ↓
Admin Dashboard calls /api/payout
    ↓
Payout API fetches withdrawal_history record
    ↓
Payout API builds PKPay request
    ↓
Payout API sends to PKPay Payout API
    ↓
PKPay processes payout
    ↓
PKPay sends webhook to /api/webhook/payout
    ↓
Webhook updates withdrawal_history.status = "completed"
    ↓
User receives funds
```

### FILES INVOLVED

**Frontend (Admin)**
- `src/admin/pages/FundsManagement.tsx` - Approve button, calls RPC + payout API

**Backend**
- `backend/api/payout.ts` - Payout API implementation
- `backend/supabase/MASTER_PRODUCTION_SCHEMA.sql` - approve_withdrawal RPC

**Database**
- `withdrawal_history` table
- `users` table
- `approve_withdrawal()` RPC function

### CURRENT STATE ANALYSIS

#### ✅ WORKING
1. **Payout API Credentials**
   - ✅ Uses `PAYOUT_API_KEY` (correct)
   - ✅ Uses `PAYOUT_API_SECRET` (correct)
   - ✅ Never uses Deposit credentials (correct)

2. **Signature Building**
   - ✅ HMAC-SHA256 implementation
   - ✅ Sorted key-value pairs
   - ✅ Matches PKPay spec

3. **Idempotency**
   - ✅ Uses withdrawal ID as idempotency key
   - ✅ Prevents duplicate processing

4. **Error Handling**
   - ✅ Handles "already_processed" from gateway
   - ✅ Reverts to "pending" on failure
   - ✅ Comprehensive logging

5. **Admin Dashboard Integration**
   - ✅ Calls approve_withdrawal RPC first
   - ✅ Then calls /api/payout
   - ✅ Handles errors gracefully

#### ⚠️ ISSUES FOUND

1. **Payout API Endpoint Routing**
   - `api.ts` line 30: `router.use('/payout', payoutRouter);`
   - `api.ts` line 31-35: Also has `router.post('/payout', ...)`
   - **ISSUE**: Duplicate routing - both handle POST /payout
   - **FIX**: Remove duplicate, keep only `router.use('/payout', payoutRouter);`

2. **Payout Webhook Not Implemented**
   - `api.ts` line 19: `router.post('/webhook/payout', payoutRouter);`
   - But `payout.ts` doesn't have webhook handler
   - **ISSUE**: Payout webhook endpoint exists but not implemented
   - **FIX**: Add webhook handler to `payout.ts` or create separate file

3. **Account Number Field**
   - `payout.ts` line 80: `account_number: withdrawal.account_number,`
   - But database schema has `account_no` (not `account_number`)
   - **ISSUE**: Field name mismatch
   - **FIX**: Change to `account_no`

4. **Missing RPC Functions** 🔴 CRITICAL
   - `payout.ts` calls `approve_withdrawal` RPC (LINE 1)
   - `FundsManagement.tsx` calls `approve_withdrawal` RPC (LINE 2)
   - `FundsManagement.tsx` calls `fail_withdrawal` RPC (LINE 3)
   - **ISSUE**: These RPC functions DO NOT EXIST in schema
   - **VERIFIED**: Searched MASTER_PRODUCTION_SCHEMA.sql - no approve_withdrawal or fail_withdrawal
   - **IMPACT**: Admin cannot approve/reject withdrawals - RPC calls will fail
   - **FIX**: Create these RPC functions in schema

#### 🔴 CRITICAL ISSUES

1. **Payout Webhook Not Implemented**
   - Payout status never updated to "completed"
   - User never receives funds
   - **FIX**: Implement payout webhook handler

2. **Account Number Field Mismatch**
   - Sending `account_number` to PKPay
   - Database has `account_no`
   - **FIX**: Change field name

---

## PRIORITY 4: UID SYSTEM

### CURRENT STATE

**Database Schema**:
- `users.id` = UUID (primary key)
- `users.invite_code` = 6-char alphanumeric (user-facing)
- `users.referral_code` = 9-digit (legacy, same as invite_code)

**Frontend Display**:
- `formatDisplayUid()` function converts UUID to 8-char uppercase
- Example: `824158987` (from user input) → stored as UUID

### ISSUES FOUND

1. **UID Display Inconsistency**
   - Admin Dashboard shows `invite_code` (6-char)
   - User sees formatted UUID (8-char)
   - **ISSUE**: Inconsistent UID display
   - **FIX**: Use `invite_code` everywhere (6-char)

2. **Invitees Search**
   - `FundsManagement.tsx` line 180: Searches by `invite_code`
   - ✅ Correct - searches by 6-char code
   - ✅ Also searches by phone number
   - ✅ Also searches by UUID

3. **Agent Management**
   - Need to verify displays original UID
   - **ACTION**: Check agent management component

4. **Agent Analyzer**
   - Currently broken
   - **ACTION**: Audit RPC, views, functions

---

## PRIORITY 5: REALTIME SUBSCRIPTIONS

### CURRENT STATE

**Implemented**:
- ✅ `DepositHistoryView.tsx` - Subscribes to deposit_history changes
- ✅ `DepositHistoryView.tsx` - Subscribes to transactions changes
- ✅ `FundsManagement.tsx` - Subscribes to withdrawal_history changes
- ✅ `UserContext.tsx` - Subscribes to users table changes

**Missing**:
- ❌ Wallet balance realtime updates
- ❌ Dashboard cards realtime updates
- ❌ Recharge history realtime updates (partially done)

### ISSUES FOUND

1. **Realtime Publication**
   - `MASTER_PRODUCTION_SCHEMA.sql` line 1100+: Adds tables to realtime publication
   - ✅ deposit_history added
   - ✅ withdrawal_history added
   - ✅ betting_history added
   - ✅ game_rounds added

2. **Subscription Implementation**
   - ✅ DepositHistoryView subscribes correctly
   - ✅ FundsManagement subscribes correctly
   - ✅ UserContext subscribes correctly

3. **Missing Subscriptions**
   - Dashboard cards don't subscribe to realtime
   - Wallet view doesn't subscribe to realtime
   - **FIX**: Add subscriptions to these components

---

## DEPENDENCY MATRIX

### Deposit Flow Dependencies

| Component | Depends On | Status |
|-----------|-----------|--------|
| DepositView.tsx | supabase client | ✅ |
| DepositView.tsx | UserContext | ✅ |
| deposit-webhook.ts | supabaseAdmin | ✅ |
| deposit-webhook.ts | WEBHOOK_SECRET env | ⚠️ Need to verify |
| FundsManagement.tsx | adminSupabase | ✅ |
| FundsManagement.tsx | approve_withdrawal RPC | ⚠️ Need to verify |
| payout.ts | PAYOUT_API_KEY env | ⚠️ Need to verify |
| payout.ts | PAYOUT_API_SECRET env | ⚠️ Need to verify |
| fn_on_deposit_approved trigger | deposit_history table | ✅ |
| fn_on_deposit_approved trigger | users table | ✅ |

### Payout Flow Dependencies

| Component | Depends On | Status |
|-----------|-----------|--------|
| FundsManagement.tsx | approve_withdrawal RPC | ⚠️ Need to verify |
| payout.ts | PAYOUT_API_KEY env | ⚠️ Need to verify |
| payout.ts | PAYOUT_API_SECRET env | ⚠️ Need to verify |
| payout.ts | withdrawal_history table | ✅ |
| payout.ts | users table | ✅ |
| payout-webhook.ts | NOT IMPLEMENTED | 🔴 |

---

## ENVIRONMENT VARIABLES REQUIRED

### Deposit Flow
```
WEBHOOK_SECRET=<pkpay_webhook_secret>
VERCEL_URL=<current_deployment_url>
PROD_WEBHOOK_BASE=https://winclub-officiall.vercel.app (optional)
```

### Payout Flow
```
Payout_API_key=<pkpay_payout_api_key>
Payout_API_secret=<pkpay_payout_api_secret>
Merchant_ID=<pkpay_merchant_id>
ADMIN_INTERNAL_MUTATION_KEY=<admin_secret_token>
```

### Verification Needed
- [ ] All env vars set in Vercel
- [ ] All env vars set in .env.local for local testing
- [ ] Webhook URL registered in PKPay Dashboard
- [ ] Payout credentials correct in PKPay Dashboard

---

## IMPLEMENTATION PRIORITY

### Phase 1: Fix Critical Issues (BLOCKING)
1. Fix DepositView.tsx async race condition
2. Implement payout webhook handler
3. Fix account_no field name in payout.ts
4. Verify webhook URL in PKPay Dashboard
5. Verify all env vars are set

### Phase 2: Add Missing Features
1. Add deposit record creation to Deposit.tsx
2. Add realtime subscriptions to dashboard
3. Implement Agent Analyzer
4. Add UID search functionality

### Phase 3: Optimization
1. Add error recovery mechanisms
2. Add retry logic for failed payouts
3. Add comprehensive logging
4. Add monitoring/alerting

---

## VERIFICATION CHECKLIST

- [ ] Deposit creates pending record before redirect
- [ ] PKPay webhook updates existing record
- [ ] No duplicate deposits created
- [ ] Deposit Requests fetch only deposit_history
- [ ] Recharge History fetches only deposit_history
- [ ] Historical deposits visible
- [ ] Admin approval credits ONLY users.main_balance
- [ ] game_balance never changes
- [ ] Webhook works in production
- [ ] Callback Delivered > Success in PKPay Dashboard
- [ ] Auto payout works end-to-end
- [ ] Payout uses Payout API credentials only
- [ ] UID search works
- [ ] Invitees search works
- [ ] Agent Analyzer works
- [ ] Realtime updates work

---

## NEXT STEPS

1. **Immediate**: Verify webhook URL in PKPay Dashboard
2. **Immediate**: Verify all env vars are set
3. **Immediate**: Fix async race condition in DepositView.tsx
4. **Immediate**: Implement payout webhook handler
5. **Immediate**: Fix account_no field name in payout.ts
6. **Then**: Test locally with ngrok
7. **Then**: Deploy to production
8. **Then**: Verify all flows work end-to-end

