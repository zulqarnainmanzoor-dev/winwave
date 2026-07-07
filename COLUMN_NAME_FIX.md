# Column Name Fix - Withdrawal History

## Issue Fixed

The code was using incorrect column names for withdrawal history:
- ❌ `account_number` (doesn't exist)
- ✅ `account_no` (correct column name)

## Files Updated

### 1. `src/components/WithdrawHistoryView.tsx`
- Fixed query to use `account_no` instead of `account_number`
- Withdrawal history now displays correctly

### 2. `src/admin/pages/HistoryPage.tsx`
- Fixed withdrawal query to use `account_no` instead of `account_number`
- Withdrawal history in admin panel now displays correctly

## Database Schema

The actual withdrawal_history table has these columns:
```sql
CREATE TABLE public.withdrawal_history (
  id            UUID,
  user_id       UUID,
  amount        NUMERIC(18,2),
  method        TEXT,
  order_id      TEXT,
  gateway_ref   TEXT,
  account_name  TEXT,
  account_no    TEXT,        -- ✅ Correct column name
  bank_name     TEXT,
  status        TEXT,
  remarks       TEXT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
);
```

## What Works Now

✅ Withdrawal history displays real withdrawal requests
✅ Account numbers show correctly
✅ Admin history page shows withdrawal data
✅ User withdrawal history shows correctly

## Testing

1. Go to Withdrawal History
2. Verify withdrawal records display
3. Verify account numbers show correctly
4. Go to Admin History Page
5. Select "Withdraw" tab
6. Verify withdrawal records display with account info

---

**Status**: ✅ FIXED
**Impact**: Withdrawal history now displays correctly
