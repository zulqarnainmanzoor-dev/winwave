# Action Items: Database Schema & Promotion Module Fixes

## Priority 1: Deploy Database Migrations (CRITICAL)

These migrations must be deployed to the production Supabase database FIRST before any frontend changes will work.

### Step 1: Deploy Payment Gateway Fields Migration
**File**: `backend/supabase/migration_deposit_withdrawal_fields.sql`

**Action**:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `migration_deposit_withdrawal_fields.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify no errors

**What it does**:
- Adds missing columns to `deposit_history` table:
  - `merchant_order_id`
  - `pkpay_transaction_id`
  - `callback_status`
  - `callback_time`
  - `gateway_response` (JSONB)
  - `payment_gateway`
- Adds same columns to `withdrawal_history` table
- Creates indexes for faster lookups

**Why it's needed**:
- Separates payment gateway data from user account information
- Prevents mixing Order IDs with Account Numbers
- Enables proper tracking of payment callbacks

---

### Step 2: Deploy RPC Functions Migration
**File**: `backend/supabase/migration_rpc_functions.sql`

**Action**:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `migration_rpc_functions.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify no errors

**What it does**:
- Creates new RPC functions:
  - `get_commission_history()` - Get commission records
  - `get_invitees_with_uids()` - Get invitees with real UIDs
  - `search_invitees()` - Search by UID or phone
  - `get_partner_rewards_stats()` - Get partner rewards data
  - `claim_commission()` - Claim commission with idempotency

**Why it's needed**:
- Enables frontend to fetch real production data
- Prevents duplicate commission claims
- Provides proper search functionality

---

## Priority 2: Create Admin Detail Pages

These components display deposit and withdrawal request details with proper field mapping.

### Step 1: Create DepositRequestDetails Component
**File**: `src/admin/pages/DepositRequestDetails.tsx`

**Status**: ✅ Already created

**Features**:
- Displays all deposit fields with proper mapping
- Shows payment gateway data separately from user info
- Copyable fields for Order IDs and Transaction IDs
- Expandable JSON for PKPay metadata
- No mixing of Account Number with Order ID

---

### Step 2: Create WithdrawalRequestDetails Component
**File**: `src/admin/pages/WithdrawalRequestDetails.tsx`

**Status**: ✅ Already created

**Features**:
- Displays all withdrawal fields with proper mapping
- Shows payout information separately from user account info
- Copyable fields for Order IDs and Transaction IDs
- Expandable JSON for gateway response
- Proper separation of Account Number from PKPay fields

---

## Priority 3: Fix Promotion Module Components

These components need updates to use real production data instead of static/generated values.

### Step 1: Update InviteesOverviewView
**File**: `src/components/InviteesOverviewView.tsx`

**Changes needed**:
- [ ] Update search to query both `referral_code` AND `phone_number`
- [ ] Display real UIDs from `referral_code` column
- [ ] Use `referral_code` instead of generated short IDs
- [ ] Fix search placeholder to say "Search by UID or Phone Number"

**Current issue**:
```
Search by phone number  ❌
```

**Should be**:
```
Search by UID or Phone Number  ✅
```

---

### Step 2: Update CommissionDetailsView
**File**: `src/components/CommissionDetailsView.tsx`

**Changes needed**:
- [ ] Load real commission data from `transactions` table
- [ ] Display member UID from `referral_code`
- [ ] Show deposit amount from `deposit_history`
- [ ] Show commission percentage and amount
- [ ] Show claim status
- [ ] Show created_at timestamp

**Current issue**:
```
No Records  ❌
```

**Should display**:
```
Date | Member UID | Deposit | Commission % | Commission | Status | Created At
07 Jul | 162334511 | 300 | 6% | 18 | Claimed | 2024-07-07 10:30
```

---

### Step 3: Update PartnerRewards
**File**: `src/components/PartnerRewards.tsx`

**Changes needed**:
- [ ] Calculate `invitation_count` = COUNT(referred_by = current_user)
- [ ] Calculate `effective_invitation_count` = COUNT(members with first_deposit_completed=true)
- [ ] Calculate `invitation_total_bonus` = SUM(commission_history.amount)
- [ ] Remove static values
- [ ] Use real production data

**Current issue**:
```
Invitation count: 0  ❌
Effective Invitation count: 0  ❌
Invitation total bonus: Rs 0  ❌
```

**Should be**:
```
Invitation count: 9  ✅
Effective Invitation count: 5  ✅
Invitation total bonus: Rs 2,450  ✅
```

---

### Step 4: Update PromotionView
**File**: `src/components/PromotionView.tsx`

**Changes needed**:
- [ ] Update search placeholder to "Search by UID or Phone Number"
- [ ] Fix search to query both `referral_code` and `phone_number`
- [ ] Display real UIDs from `referral_code`
- [ ] Calculate real statistics from database
- [ ] Remove hardcoded/generated values

---

## Priority 4: Update Member Profile

**File**: `src/admin/pages/MemberProfile.tsx`

**Status**: ✅ Already good, but verify:
- [ ] Uses `referral_code` as UID
- [ ] Displays real financial data
- [ ] Shows correct referrer information
- [ ] Displays last login timestamp
- [ ] Shows VIP level from database

---

## Database Column Reference

### Real UID Column
```
referral_code  → 9-digit numeric (e.g., 162334511)  ✅ USE THIS
invite_code    → 6-char alphanumeric (e.g., A1B2C3)  ❌ Don't use for display
id             → UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)  ❌ Don't use for display
```

### Commission Data
```
transactions table:
- user_id → Referrer ID
- type = 'commission' → Commission transaction
- amount → Commission amount
- status = 'completed' → Completed commission
- created_at → When commission was earned
```

### Invitees Data
```
users table:
- referred_by = current_user_id → Direct invitees
- referral_code → Real UID to display
- phone_number → Phone for search
- total_deposit → Total deposits by invitee
- created_at → Registration date
```

---

## Testing Checklist

After all changes:

- [ ] Database migrations deployed successfully
- [ ] RPC functions exist in Supabase schema
- [ ] DepositRequestDetails displays correct fields
- [ ] WithdrawalRequestDetails displays correct fields
- [ ] InviteesOverviewView searches by UID and phone
- [ ] CommissionDetailsView loads real data
- [ ] PartnerRewards shows real statistics
- [ ] PromotionView displays real UIDs
- [ ] Member Profile shows accurate data
- [ ] No "function does not exist" errors
- [ ] No mixing of Order IDs with Account Numbers
- [ ] All real UIDs display as 9-digit numbers

---

## Deployment Order

1. **Deploy database migrations** (Step 1 & 2 above)
2. **Wait 1-2 minutes** for schema cache to update
3. **Create admin detail pages** (already done)
4. **Update Promotion module components**
5. **Test all functionality**
6. **Deploy to production**

---

## Files Created/Modified

### New Files
- ✅ `backend/supabase/migration_deposit_withdrawal_fields.sql`
- ✅ `backend/supabase/migration_rpc_functions.sql`
- ✅ `src/admin/pages/DepositRequestDetails.tsx`
- ✅ `src/admin/pages/WithdrawalRequestDetails.tsx`
- ✅ `RPC_FUNCTIONS_DEPLOYMENT_GUIDE.md`

### Files to Update
- ⏳ `src/components/InviteesOverviewView.tsx`
- ⏳ `src/components/CommissionDetailsView.tsx`
- ⏳ `src/components/PartnerRewards.tsx`
- ⏳ `src/components/PromotionView.tsx`
- ✅ `src/admin/pages/MemberProfile.tsx` (verify only)

---

## Support

For questions about:
- **Database schema**: See `MASTER_PRODUCTION_SCHEMA.sql`
- **RPC functions**: See `RPC_FUNCTIONS_DEPLOYMENT_GUIDE.md`
- **Column mapping**: See this document's "Database Column Reference" section
- **Deployment**: Follow "Priority 1: Deploy Database Migrations" section
