# RPC Functions Deployment Guide

## Overview

This document lists all RPC (Remote Procedure Call) functions that must exist in the production Supabase database. These functions are called from the frontend and backend to perform operations that require database-level logic.

## Deployment Steps

1. **Copy the SQL migration file** to your Supabase SQL Editor
2. **Run the entire migration** in the Supabase Dashboard → SQL Editor
3. **Verify functions exist** by checking the schema cache
4. **Test each function** with sample parameters

## Existing RPC Functions (Already in MASTER_PRODUCTION_SCHEMA.sql)

These functions are already defined and should NOT be recreated:

### 1. validate_invite_code(p_code TEXT)
- **Purpose**: Validate a 6-character invite code
- **Returns**: referrer_id UUID, referrer_phone TEXT
- **Usage**: Frontend registration form
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
```

### 2. validate_referral_code(p_code TEXT)
- **Purpose**: Validate a 9-digit numeric referral code (user-facing UID)
- **Returns**: referrer_id UUID, referrer_phone TEXT
- **Usage**: Frontend registration form, referral links
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE(referrer_id UUID, referrer_phone TEXT)
```

### 3. get_referral_stats(p_user_id UUID)
- **Purpose**: Get referral statistics for a user
- **Returns**: total_invitees BIGINT, active_invitees BIGINT, total_commission NUMERIC
- **Usage**: Promotion page, partner rewards
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS TABLE(total_invitees BIGINT, active_invitees BIGINT, total_commission NUMERIC)
```

### 4. get_user_rtp_phase(p_user_id UUID)
- **Purpose**: Get the current RTP phase for a user
- **Returns**: TEXT ('honeymoon', 'normal', 'controlled_loss')
- **Usage**: Game engine, risk management
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_user_rtp_phase(p_user_id UUID)
RETURNS TEXT
```

### 5. get_active_round(p_game_type TEXT, p_mode TEXT)
- **Purpose**: Get the currently active game round
- **Returns**: id UUID, period TEXT, ends_at TIMESTAMPTZ, target_result TEXT, total_big NUMERIC, total_small NUMERIC, status TEXT
- **Usage**: Game controller, betting interface
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_active_round(p_game_type TEXT, p_mode TEXT)
RETURNS TABLE(id UUID, period TEXT, ends_at TIMESTAMPTZ, target_result TEXT, total_big NUMERIC, total_small NUMERIC, status TEXT)
```

### 6. set_round_target(p_period TEXT, p_target_result TEXT)
- **Purpose**: Set admin override for game round result
- **Returns**: VOID
- **Usage**: Admin game controller
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.set_round_target(p_period TEXT, p_target_result TEXT)
RETURNS VOID
```

### 7. complete_round(p_period TEXT, p_number INT, p_size TEXT, p_color TEXT)
- **Purpose**: Manually complete a game round (fallback)
- **Returns**: VOID
- **Usage**: Admin game controller
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.complete_round(p_period TEXT, p_number INT, p_size TEXT, p_color TEXT)
RETURNS VOID
```

### 8. get_server_time()
- **Purpose**: Get current server time in UTC
- **Returns**: JSONB with utc_epoch_ms and utc_iso
- **Usage**: Frontend time sync
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS JSONB
```

### 9. submit_withdrawal(p_user_id UUID, p_amount NUMERIC, p_method TEXT, p_account_name TEXT, p_account_number TEXT, p_remarks TEXT)
- **Purpose**: Submit a withdrawal request
- **Returns**: JSONB with success flag and withdrawal_id
- **Usage**: Withdrawal form
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_account_name TEXT,
  p_account_number TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
```

### 10. approve_withdrawal(p_withdrawal_id UUID)
- **Purpose**: Approve a pending withdrawal
- **Returns**: JSONB with success flag
- **Usage**: Admin withdrawal management
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
```

### 11. fail_withdrawal(p_withdrawal_id UUID, p_reason TEXT)
- **Purpose**: Reject a withdrawal request
- **Returns**: JSONB with success flag
- **Usage**: Admin withdrawal management
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.fail_withdrawal(p_withdrawal_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
```

## New RPC Functions (To Be Created)

These functions are defined in `migration_rpc_functions.sql`:

### 1. get_commission_history(p_user_id UUID, p_limit INT DEFAULT 50)
- **Purpose**: Get commission history for a user
- **Returns**: Table with id, member_uid, deposit_amount, commission_percent, commission_amount, status, claimed, created_at
- **Usage**: Commission details page
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_commission_history(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  member_uid TEXT,
  deposit_amount NUMERIC,
  commission_percent NUMERIC,
  commission_amount NUMERIC,
  status TEXT,
  claimed BOOLEAN,
  created_at TIMESTAMPTZ
)
```

### 2. get_invitees_with_uids(p_user_id UUID, p_limit INT DEFAULT 100)
- **Purpose**: Get list of invitees with real UIDs
- **Returns**: Table with id, uid, phone_number, total_deposit, total_bets, created_at
- **Usage**: Invitees overview
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_invitees_with_uids(p_user_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_bets INT,
  created_at TIMESTAMPTZ
)
```

### 3. search_invitees(p_user_id UUID, p_search_term TEXT, p_limit INT DEFAULT 50)
- **Purpose**: Search invitees by UID or phone number
- **Returns**: Table with id, uid, phone_number, total_deposit, total_bets, created_at
- **Usage**: Invitees search
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.search_invitees(
  p_user_id UUID,
  p_search_term TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  uid TEXT,
  phone_number TEXT,
  total_deposit NUMERIC,
  total_bets INT,
  created_at TIMESTAMPTZ
)
```

### 4. get_partner_rewards_stats(p_user_id UUID)
- **Purpose**: Get partner rewards statistics
- **Returns**: Table with invitation_count, effective_invitation_count, invitation_total_bonus
- **Usage**: Partner rewards page
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.get_partner_rewards_stats(p_user_id UUID)
RETURNS TABLE(
  invitation_count BIGINT,
  effective_invitation_count BIGINT,
  invitation_total_bonus NUMERIC
)
```

### 5. claim_commission(p_user_id UUID, p_amount NUMERIC)
- **Purpose**: Claim commission with idempotency check (prevent duplicate claims)
- **Returns**: JSONB with success flag, new_balance, claimed_amount
- **Usage**: Commission claim button
- **Signature**:
```sql
CREATE OR REPLACE FUNCTION public.claim_commission(p_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
```

## Database Column Mapping

### deposit_history Table
```
id                    → Deposit ID
user_id               → User ID
amount                → Deposit Amount
method                → Payment Method
order_id              → Order ID (Checkout Order ID from PKPay)
merchant_order_id     → Merchant Order ID
gateway_ref           → Gateway Reference
pkpay_transaction_id  → PKPay Transaction ID
callback_status       → Callback Status
callback_time         → Callback Time
gateway_response      → PKPay Metadata / Raw Response (JSONB)
payment_gateway       → Payment Gateway
bonus                 → Bonus Amount
bonus_rate            → Bonus Rate
status                → Status
remarks               → Remarks
created_at            → Created At
updated_at            → Updated At
```

### withdrawal_history Table
```
id                    → Withdrawal ID
user_id               → User ID
amount                → Withdrawal Amount
method                → Method
order_id              → Payout Order ID
merchant_order_id     → Merchant Order ID
gateway_ref           → Gateway Reference
pkpay_transaction_id  → PKPay Payout Transaction ID
callback_status       → Callback Status
callback_time         → Callback Time
gateway_response      → Gateway Response (JSONB)
payment_gateway       → Payment Gateway
account_name          → Account Name (User's bank account name)
account_no            → Account Number (User's bank account number)
bank_name             → Bank / Wallet Name
status                → Status
remarks               → Remarks
created_at            → Created At
updated_at            → Updated At
```

## Important Notes

1. **Parameter Names Matter**: Frontend calls use exact parameter names. If a function parameter is `p_user_id`, the frontend must pass it as `p_user_id`.

2. **Return Types**: Functions must return the exact types specified. If a function returns a TABLE, all columns must match.

3. **Security Definer**: Functions use `SECURITY DEFINER` to bypass RLS policies when needed.

4. **Grants**: All functions have `GRANT EXECUTE` to allow authenticated users to call them.

5. **Idempotency**: Functions like `claim_commission` check for duplicate claims to prevent double-crediting.

6. **Real UIDs**: Functions use `referral_code` column (9-digit numeric) as the real user-facing UID, not `invite_code` (6-char alphanumeric).

## Verification Checklist

After deploying migrations:

- [ ] All functions appear in Supabase Dashboard → SQL Editor → Functions
- [ ] Each function has correct parameter names and types
- [ ] Each function has correct return type
- [ ] All functions have GRANT EXECUTE to authenticated role
- [ ] Test each function with sample data
- [ ] Frontend can call functions without "does not exist" errors

## Troubleshooting

### "Function does not exist" Error
1. Check function name spelling (case-sensitive)
2. Verify parameter names match exactly
3. Run migration again to ensure function is created
4. Clear Supabase schema cache (may take 1-2 minutes)

### Parameter Type Mismatch
1. Verify parameter types in function definition
2. Ensure frontend passes correct types (UUID, TEXT, INT, NUMERIC, etc.)
3. Check if parameter is optional (has DEFAULT value)

### Return Type Mismatch
1. Verify return type matches function definition
2. If returning TABLE, ensure all columns are present
3. Check column names and types match exactly
