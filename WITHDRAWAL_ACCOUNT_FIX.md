# Withdrawal Account Details Fix - Summary

## Issue
The Admin Dashboard Withdrawal Requests page was not displaying withdrawal account details (account name, account number, payment method) even though they were correctly stored in the database.

## Root Cause
1. **FundsManagement.tsx**: Query was fetching `account_number` (incorrect column name) instead of `account_no` (correct column name)
2. **FundsManagement.tsx**: Mapping was hardcoding `account_name` to "—" instead of using the fetched value
3. **WithdrawHistoryView.tsx**: Query was using `account_number` instead of `account_no`
4. **WithdrawHistoryView.tsx**: Interface definition was incorrect

## Database Schema (withdrawal_history table)
```
- id: UUID
- user_id: UUID
- amount: NUMERIC
- method: TEXT
- account_name: TEXT (Account holder name)
- account_no: TEXT (Account number) ← CORRECT COLUMN NAME
- bank_name: TEXT (Payment method/bank name)
- status: TEXT
- gateway_ref: TEXT
- reason: TEXT
- remarks: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## Changes Made

### 1. FundsManagement.tsx (Admin Withdrawal Requests)
**File**: `src/admin/pages/FundsManagement.tsx`

**Changes**:
- Updated Supabase query to fetch correct columns:
  ```typescript
  .select("id, user_id, amount, method, account_name, account_no, bank_name, status, gateway_ref, reason, remarks, created_at")
  ```
- Fixed data mapping to use actual values instead of hardcoded "—":
  ```typescript
  account_name: row.account_name || "—",
  account_number: row.account_no || (row.order_id ? String(row.order_id) : (row.gateway_ref || "—")),
  ```
- Added fallback for method field:
  ```typescript
  method: row.method || row.bank_name || "Manual",
  ```

### 2. WithdrawHistoryView.tsx (User Withdrawal History)
**File**: `src/components/WithdrawHistoryView.tsx`

**Changes**:
- Updated interface to use correct column name:
  ```typescript
  account_no: string | null;  // Changed from account_number
  ```
- Updated Supabase query:
  ```typescript
  .select("id, amount, method, account_no, account_name, status, created_at, remarks, reason, user_id")
  ```
- Updated UI rendering to use `account_no`:
  ```typescript
  {rec.account_no && (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className="text-gray-400">Acc:</span>
      <span className="text-gray-300">{rec.account_no}</span>
    </div>
  )}
  ```

## Display Fields

### Admin Withdrawal Requests (FundsManagement)
- Account Name: `account_name`
- Account Number: `account_no`
- Payment Method: `method` or `bank_name`
- Status: `status`
- Gateway Reference: `gateway_ref`
- Reason/Remarks: `reason` and `remarks`

### User Withdrawal History (WithdrawHistoryView)
- Account Name: `account_name`
- Account Number: `account_no`
- Payment Method: `method`
- Status: `status`
- Remarks: `remarks`
- Rejection Reason: `reason`

## Verification

✅ **Admin Dashboard**:
- Withdrawal Requests page now displays account details
- Account Name field shows actual holder name
- Account Number field shows actual account number
- Payment Method field shows correct method

✅ **User Application**:
- Withdrawal History page displays account details
- Account information is visible in withdrawal records
- Rejection reasons are properly displayed

## No Database Changes
- No SQL migrations were created
- No table structure was modified
- Only frontend query and mapping logic was fixed
- All data was already correctly stored in the database

## Backward Compatibility
- All existing withdrawal records remain unchanged
- No data loss or corruption
- Existing withdrawal approval/rejection logic unchanged
- Realtime subscriptions continue to work
