# CRITICAL FIXES NEEDED - Priority List

## Issue 1: Account Number Column Name ✅ VERIFIED
**Status:** Database uses `account_no` (correct)
**Problem:** Code might be using `account_number` (wrong)
**Fix:** Verify payout.ts uses `account_no`

## Issue 2: Agent Commission Bug (CRITICAL)
**Problem:** Commission credited multiple times on refresh
**Root Cause:** Missing `claimed` flag and transaction lock
**Solution:** Add idempotency to commission claim

### Current Flow (BROKEN):
```
User clicks "Claim Commission"
    ↓
API called
    ↓
Balance updated (no lock)
    ↓
Page refreshes
    ↓
Same commission credited AGAIN ❌
```

### Fixed Flow:
```
User clicks "Claim Commission"
    ↓
Check if already claimed (WHERE claimed = false)
    ↓
Lock transaction (FOR UPDATE)
    ↓
Update balance
    ↓
Mark as claimed (claimed = true, claimed_at = NOW())
    ↓
Page refreshes
    ↓
Commission NOT credited again ✅
```

## Issue 3: Commission Calculation (CRITICAL)
**Problem:** Agent gets full deposit amount as commission
**Example:** User deposits 300 → Agent gets 300 commission ❌
**Should Be:** User deposits 300 → Agent gets 0.6% = 1.8 commission ✅

**Current Rate:** 0.6% (from schema line 1089)
**Fix:** Ensure commission calculation uses percentage, not full amount

## Issue 4: Remove WinWave Banners
**Location:** Home page
**Action:** Remove 3-4 WinWave branded banners
**Replace With:** WinClub branding

## Issue 5: Test Deposit/Payout Flows
**Status:** Not tested yet
**Action:** Create proper test cases

---

## Implementation Plan

### Step 1: Fix Commission Table (Database)
Add `claimed` flag to commission tracking:
```sql
ALTER TABLE public.transactions ADD COLUMN claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transactions ADD COLUMN claimed_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN claimed_by TEXT;
```

### Step 2: Fix Commission Claim API
Ensure idempotency:
```typescript
// Check if already claimed
WHERE user_id = userId AND type = 'commission' AND claimed = false

// Update atomically
UPDATE transactions
SET claimed = true, claimed_at = NOW()
WHERE id = commissionId AND claimed = false

// If no rows updated, commission already claimed
```

### Step 3: Fix Commission Calculation
Verify percentage calculation:
```typescript
const commissionRate = 0.006; // 0.6%
const commission = depositAmount * commissionRate; // NOT depositAmount
```

### Step 4: Fix Payout Column Names
Verify all uses of `account_no` (not `account_number`)

### Step 5: Remove WinWave Banners
Find and remove from home page component

### Step 6: Test Flows
Create test cases for:
- Deposit → Balance credit
- Payout → Withdrawal processing
- Commission → Single claim only

---

## Files to Modify

1. **Database Schema** - Add `claimed` flag
2. **Commission Claim API** - Add idempotency
3. **Commission Calculation** - Fix percentage
4. **Payout Endpoint** - Verify column names
5. **Home Page Component** - Remove banners

---

## Testing Checklist

- [ ] Deposit 300 → Balance shows 300
- [ ] Agent commission = 300 * 0.006 = 1.8 (not 300)
- [ ] Claim commission once → Balance +1.8
- [ ] Refresh page → Balance still +1.8 (not +3.6)
- [ ] Click claim again → No change (already claimed)
- [ ] Payout uses `account_no` column
- [ ] WinWave banners removed from home

---

## Priority Order

1. **CRITICAL:** Fix commission duplicate claim bug
2. **CRITICAL:** Fix commission calculation (0.6% not 100%)
3. **HIGH:** Fix account column names
4. **HIGH:** Remove WinWave banners
5. **MEDIUM:** Test deposit/payout flows

---

## Expected Results After Fixes

✅ Commission claimed only once
✅ Commission calculated correctly (0.6%)
✅ Payout uses correct column names
✅ Home page shows WinClub branding
✅ All flows tested and working
