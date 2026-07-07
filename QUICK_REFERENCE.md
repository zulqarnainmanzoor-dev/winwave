# Quick Reference: Deposit/Withdrawal Details & Promotion Module Fix

## 🚀 Quick Start

### 1. Deploy Database Migrations (FIRST)
```bash
# In Supabase Dashboard → SQL Editor:
# 1. Copy backend/supabase/migration_deposit_withdrawal_fields.sql
# 2. Paste and Run
# 3. Copy backend/supabase/migration_rpc_functions.sql
# 4. Paste and Run
# 5. Wait 1-2 minutes for schema cache update
```

### 2. Deploy Components
- ✅ `src/admin/pages/DepositRequestDetails.tsx` (already created)
- ✅ `src/admin/pages/WithdrawalRequestDetails.tsx` (already created)

### 3. Update Promotion Module
- ⏳ `src/components/InviteesOverviewView.tsx`
- ⏳ `src/components/CommissionDetailsView.tsx`
- ⏳ `src/components/PartnerRewards.tsx`
- ⏳ `src/components/PromotionView.tsx`

---

## 📋 What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| **Order ID Display** | Mixed with Account Number | Separate dedicated field |
| **Account Number** | Showing Order ID | Showing actual account number |
| **UID Display** | Generated (9F4AC397) | Real (162334511) |
| **Search** | Phone only | UID + Phone |
| **Commission Data** | Static (Rs 0) | Real from database |
| **Invitees Stats** | Hardcoded | Calculated real-time |
| **Duplicate Claims** | Risk of double-credit | Prevented with idempotency |

---

## 🗄️ Database Changes

### New Columns Added

#### deposit_history
```sql
merchant_order_id TEXT
pkpay_transaction_id TEXT
callback_status TEXT
callback_time TIMESTAMPTZ
gateway_response JSONB
payment_gateway TEXT
```

#### withdrawal_history
```sql
merchant_order_id TEXT
pkpay_transaction_id TEXT
callback_status TEXT
callback_time TIMESTAMPTZ
gateway_response JSONB
payment_gateway TEXT
```

---

## 🔧 RPC Functions Created

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_commission_history()` | Fetch commission records | TABLE |
| `get_invitees_with_uids()` | Get invitees with real UIDs | TABLE |
| `search_invitees()` | Search by UID or phone | TABLE |
| `get_partner_rewards_stats()` | Calculate rewards stats | TABLE |
| `claim_commission()` | Claim with idempotency | JSONB |

---

## 📊 Field Mapping

### Deposit Request Details

| UI Label | Database Column | Table |
|----------|-----------------|-------|
| UID | referral_code | users |
| Phone Number | phone_number | users |
| User ID | user_id | deposit_history |
| Amount | amount | deposit_history |
| Bonus Amount | bonus | deposit_history |
| Bonus Rate | bonus_rate | deposit_history |
| Payment Method | method | deposit_history |
| Order ID (Checkout) | order_id | deposit_history |
| Merchant Order ID | merchant_order_id | deposit_history |
| PKPay Transaction ID | pkpay_transaction_id | deposit_history |
| Gateway Reference | gateway_ref | deposit_history |
| Payment Gateway | payment_gateway | deposit_history |
| Callback Status | callback_status | deposit_history |
| Callback Time | callback_time | deposit_history |
| PKPay Metadata | gateway_response | deposit_history |

### Withdrawal Request Details

| UI Label | Database Column | Table |
|----------|-----------------|-------|
| UID | referral_code | users |
| Phone | phone_number | users |
| User ID | user_id | withdrawal_history |
| Amount | amount | withdrawal_history |
| Method | method | withdrawal_history |
| Account Name | account_name | withdrawal_history |
| Account Number | account_no | withdrawal_history |
| Bank / Wallet Name | bank_name | withdrawal_history |
| Payout Order ID | order_id | withdrawal_history |
| Merchant Order ID | merchant_order_id | withdrawal_history |
| PKPay Payout Transaction ID | pkpay_transaction_id | withdrawal_history |
| Gateway Reference | gateway_ref | withdrawal_history |
| Payment Gateway | payment_gateway | withdrawal_history |
| Callback Status | callback_status | withdrawal_history |
| Callback Time | callback_time | withdrawal_history |
| Gateway Response | gateway_response | withdrawal_history |

---

## 🔍 Real UID Reference

```
referral_code  → 162334511 (9-digit numeric)  ✅ USE THIS
invite_code    → A1B2C3 (6-char alphanumeric)  ❌ Don't use
id             → UUID format  ❌ Don't use
```

---

## 🧪 Testing Checklist

- [ ] Database migrations deployed
- [ ] RPC functions exist in Supabase
- [ ] DepositRequestDetails shows correct fields
- [ ] WithdrawalRequestDetails shows correct fields
- [ ] Order ID not mixed with Account Number
- [ ] Account Number shows actual account
- [ ] Search works for UID
- [ ] Search works for phone
- [ ] Commission data loads
- [ ] Invitees show real UIDs
- [ ] Statistics calculate correctly
- [ ] No duplicate commission claims
- [ ] No "function does not exist" errors

---

## 📁 Files Reference

### New Files
```
backend/supabase/migration_deposit_withdrawal_fields.sql
backend/supabase/migration_rpc_functions.sql
src/admin/pages/DepositRequestDetails.tsx
src/admin/pages/WithdrawalRequestDetails.tsx
RPC_FUNCTIONS_DEPLOYMENT_GUIDE.md
ACTION_ITEMS_DATABASE_PROMOTION_FIX.md
COMPLETE_FIX_SUMMARY.md
QUICK_REFERENCE.md (this file)
```

### Files to Update
```
src/components/InviteesOverviewView.tsx
src/components/CommissionDetailsView.tsx
src/components/PartnerRewards.tsx
src/components/PromotionView.tsx
```

---

## ⚡ Common Issues & Solutions

### "Function does not exist"
```
✓ Deploy migration_rpc_functions.sql
✓ Wait 1-2 minutes for schema cache
✓ Refresh Supabase Dashboard
✓ Check function name spelling
```

### Order ID showing in Account Number field
```
✓ Deploy migration_deposit_withdrawal_fields.sql
✓ Update component to use correct column
✓ Verify database has new columns
```

### Search not finding users
```
✓ Verify search queries referral_code AND phone_number
✓ Check invitees exist in database
✓ Verify referral_code is populated
✓ Check search term is not empty
```

### Commission showing Rs 0
```
✓ Verify transactions table has commission records
✓ Check commission records have status='completed'
✓ Verify user_id matches in transactions
✓ Check created_at is recent
```

### Duplicate commission claims
```
✓ Verify claim_commission() RPC exists
✓ Check function checks for same-day claims
✓ Verify transactions table records claims
✓ Check browser console for errors
```

---

## 🎯 Key Points

1. **Always deploy database migrations FIRST**
2. **Wait 1-2 minutes for schema cache update**
3. **Use referral_code for real UIDs (not invite_code or id)**
4. **Separate payment gateway data from user account data**
5. **Search by both UID and phone number**
6. **Prevent duplicate commission claims with idempotency**
7. **Load all data from production database (no hardcoded values)**

---

## 📞 Support

For detailed information:
- **RPC Functions**: See `RPC_FUNCTIONS_DEPLOYMENT_GUIDE.md`
- **Action Items**: See `ACTION_ITEMS_DATABASE_PROMOTION_FIX.md`
- **Complete Details**: See `COMPLETE_FIX_SUMMARY.md`
- **Database Schema**: See `MASTER_PRODUCTION_SCHEMA.sql`

---

## ✅ Deployment Order

1. Deploy `migration_deposit_withdrawal_fields.sql`
2. Deploy `migration_rpc_functions.sql`
3. Wait 1-2 minutes
4. Deploy `DepositRequestDetails.tsx`
5. Deploy `WithdrawalRequestDetails.tsx`
6. Update `InviteesOverviewView.tsx`
7. Update `CommissionDetailsView.tsx`
8. Update `PartnerRewards.tsx`
9. Update `PromotionView.tsx`
10. Test all functionality
11. Deploy to production

---

**Last Updated**: 2024
**Status**: Ready for Deployment
