# Production Issues Analysis & Fix Plan

## PRIORITY 1: PKPay Deposit Flow (CRITICAL)

### Status: ✅ FIXED
**File:** `src/components/Deposit.tsx`
**Issue:** Hardcoded static order_ids causing duplicate key violations
**Solution:** Already implemented - replaced with dynamic API-based checkout generation

---

## PRIORITY 2: Deposit & Withdrawal Issues

### Issue 2.1: "Failed to create deposit record"
**Root Cause:** 
- Frontend tries to create deposit_history record directly
- Missing proper error handling and validation
- No transaction atomicity

**Current Flow:**
1. User clicks Deposit
2. Frontend extracts order_id from static URL
3. Frontend tries to insert into deposit_history
4. Fails due to duplicate order_id or missing fields

**Fix Applied:**
- Deposit.tsx now calls `/api/create-checkout` endpoint
- Backend generates unique order_id
- Backend creates deposit_history atomically
- Backend calls PKPay API
- Returns checkout URL to frontend

**Files Modified:**
- `src/components/Deposit.tsx` ✅

---

### Issue 2.2: Withdrawal Status Not Updating in Real-Time
**Root Cause:**
- Admin approves withdrawal via RPC `approve_withdrawal()`
- Status changes to 'processing' in database
- Frontend doesn't subscribe to real-time updates
- User sees stale 'pending' status

**Current Implementation:**
- `WithdrawView.tsx` shows withdrawal history
- No real-time subscription to `withdrawal_history` table
- User must manually refresh to see status changes

**Fix Required:**
- Add real-time subscription to `withdrawal_history` table
- Listen for status changes
- Update UI immediately when admin approves

**Files to Modify:**
- `src/components/WithdrawHistoryView.tsx` (if exists)
- `src/components/DepositHistoryView.tsx` (already has subscription)

---

## PRIORITY 3: Agent Management (Real Data Only)

### Issue 3.1: Agent Dashboard Shows Hardcoded/Zero Values

**Current Problems:**
1. **Total Team Deposit** - Shows 0
2. **Today's Team Deposit** - Shows 0
3. **Total Withdraw** - Shows 0
4. **Today's Withdraw** - Shows 0
5. **Total Commission** - Shows 0
6. **Today's Commission** - Shows 0
7. **Yesterday Commission** - Shows 0
8. **Pending Commission** - Shows 0
9. **Claimed Commission** - Shows 0
10. **Active Members** - Shows 0
11. **Total Members** - Shows 0
12. **First Deposit Users** - Shows 0

**Root Cause:**
- No SQL functions to calculate agent team statistics
- Frontend doesn't fetch from database
- Likely hardcoded values or missing RPC functions

**Required Fixes:**
1. Create RPC function: `get_agent_team_stats(agent_id)`
   - Returns: total_deposit, today_deposit, total_withdraw, today_withdraw, active_members, total_members, first_deposit_users
   
2. Create RPC function: `get_agent_commission_stats(agent_id)`
   - Returns: total_commission, today_commission, yesterday_commission, pending_commission, claimed_commission

3. Update frontend to call these functions

**Database Queries Needed:**
```sql
-- Team deposits (recursive referral tree)
SELECT SUM(dh.amount) 
FROM deposit_history dh
JOIN users u ON dh.user_id = u.id
WHERE u.referred_by = agent_id OR u.referred_by IN (
  SELECT id FROM users WHERE referred_by = agent_id
  -- ... recursive
)
AND dh.status = 'completed'

-- Commission from transactions table
SELECT SUM(amount) FROM transactions
WHERE user_id = agent_id AND type = 'commission'
```

---

### Issue 3.2: Promotion Page Shows Lifetime Statistics (Incorrect)
**Current:** Shows hardcoded or zero values
**Required:** Fetch real lifetime stats from database

---

### Issue 3.3: Invitees Overview Shows Zero Statistics
**Current Display:**
- Deposit Amount = Rs 0.00
- Number of Bettors = 0
- First Deposit Users = 0
- Total Bet = Rs 0.00
- First Deposit Amount = Rs 0.00

**Root Cause:**
- No SQL functions to calculate these statistics
- Frontend doesn't aggregate data from betting_history and deposit_history

**Required Fixes:**
1. Create RPC: `get_invitees_stats(agent_id)`
   - total_deposit_amount
   - number_of_bettors (COUNT DISTINCT users with bets)
   - first_deposit_users (COUNT users with first deposit completed)
   - total_bet_amount (SUM of all bets)
   - first_deposit_amount (SUM of first deposits only)

---

### Issue 3.4: Subordinates List Shows Zero Statistics
**Current:** Each member row shows zeros
**Required:** Show real data for each subordinate:
- Numeric UID
- Registration Date
- Today's Deposit
- Lifetime Deposit
- Total Bet
- Commission

**Fix:** Create RPC: `get_subordinate_stats(subordinate_id)`

---

### Issue 3.5: Team Statistics (Recursive Hierarchy)
**Problem:** Agent sees stats for unrelated users
**Solution:** Use recursive CTE to get only users in referral tree

```sql
WITH RECURSIVE team AS (
  SELECT id FROM users WHERE id = agent_id
  UNION ALL
  SELECT u.id FROM users u
  JOIN team t ON u.referred_by = t.id
)
SELECT ... FROM team
```

---

### Issue 3.6: Commission Values Incorrect
**Current:** Shows zero or hardcoded values
**Root Cause:** 
- Commission not being calculated correctly
- Trigger `trg_credit_agent_commission` may not be firing
- Or commission stored in wrong table

**Fix:**
- Verify trigger is firing on betting_history INSERT
- Check transactions table for commission records
- Create RPC to sum commissions correctly

---

### Issue 3.7: Analyze Button Shows Zeros/Hardcoded Values
**Current Display:**
- Total Network Accounts = 0
- Genuine Profiles = 0
- Today's Deposits = 0
- Today's Withdrawals = 0
- Lifetime Deposits = 0
- Lifetime Withdrawals = 0

**Fix:** Create RPC: `get_network_analysis(agent_id)`

---

## PRIORITY 4: Admin Dashboard

### Issue 4.1: Recharge History Not Loading
**File:** `src/admin/pages/DepositRequestDetails.tsx` (or similar)
**Problem:** 
- Query fails or returns empty
- Likely using wrong table or field names

**Fix:**
- Query `deposit_history` table
- Filter by status = 'completed' or 'pending'
- Join with users table for user details

---

### Issue 4.2: Deposit Request Details Shows Wrong Fields
**Required Fields:**
- Numeric UID (from users.id, formatted)
- User Name (from users.phone_number)
- Deposit Amount (from deposit_history.amount)
- Deposit Method (from deposit_history.method)
- Merchant Order ID (from deposit_history.order_id)
- PKPay Order ID (from deposit_history.pkpay_order_id)
- Gateway Reference (from deposit_history.gateway_ref)
- Status (from deposit_history.status)
- Created Time (from deposit_history.created_at)
- Updated Time (from deposit_history.updated_at)

---

### Issue 4.3: Withdrawal Request Details Shows Wrong Fields
**Required Fields:**
- Numeric UID
- User Name
- Withdrawal Amount
- Withdrawal Method
- Wallet Name
- Wallet Account Number
- Main Balance
- Status
- Created Time
- Updated Time

**Source:** `withdrawal_history` table

---

## PRIORITY 5: Betting Statistics

### Issue 5.1: Number of Bettors Always Zero
**Definition:** Count of unique registered members under agent who have placed at least one bet
**Query:**
```sql
SELECT COUNT(DISTINCT bh.user_id)
FROM betting_history bh
JOIN users u ON bh.user_id = u.id
WHERE u.referred_by = agent_id
  AND bh.status = 'completed'
```

---

### Issue 5.2: Total Bet Always Zero
**Definition:** Sum of all bets placed by members under agent
**Query:**
```sql
SELECT SUM(bh.amount)
FROM betting_history bh
JOIN users u ON bh.user_id = u.id
WHERE u.referred_by = agent_id
  AND bh.status = 'completed'
```

---

### Issue 5.3: Deposit Amount Always Zero
**Definition:** Sum of approved deposits made by members under agent
**Query:**
```sql
SELECT SUM(dh.amount)
FROM deposit_history dh
JOIN users u ON dh.user_id = u.id
WHERE u.referred_by = agent_id
  AND dh.status = 'completed'
```

---

### Issue 5.4: First Deposit Users Always Zero
**Definition:** Number of members whose first successful deposit has been completed
**Query:**
```sql
SELECT COUNT(DISTINCT u.id)
FROM users u
WHERE u.referred_by = agent_id
  AND EXISTS (
    SELECT 1 FROM deposit_history dh
    WHERE dh.user_id = u.id
      AND dh.status = 'completed'
    LIMIT 1
  )
```

---

### Issue 5.5: First Deposit Amount Always Zero
**Definition:** Sum of those first successful deposits
**Query:**
```sql
SELECT SUM(first_deposits.amount)
FROM (
  SELECT DISTINCT ON (dh.user_id) dh.amount
  FROM deposit_history dh
  JOIN users u ON dh.user_id = u.id
  WHERE u.referred_by = agent_id
    AND dh.status = 'completed'
  ORDER BY dh.user_id, dh.created_at ASC
) first_deposits
```

---

## Summary of Required SQL Functions

### New RPC Functions to Create:

1. **get_agent_team_stats(agent_id UUID)**
   - Returns: total_deposit, today_deposit, total_withdraw, today_withdraw, active_members, total_members, first_deposit_users

2. **get_agent_commission_stats(agent_id UUID)**
   - Returns: total_commission, today_commission, yesterday_commission, pending_commission, claimed_commission

3. **get_invitees_stats(agent_id UUID)**
   - Returns: total_deposit_amount, number_of_bettors, first_deposit_users, total_bet_amount, first_deposit_amount

4. **get_subordinate_stats(subordinate_id UUID)**
   - Returns: uid_short, registration_date, today_deposit, lifetime_deposit, total_bet, commission

5. **get_network_analysis(agent_id UUID)**
   - Returns: total_network_accounts, genuine_profiles, today_deposits, today_withdrawals, lifetime_deposits, lifetime_withdrawals

6. **get_betting_stats(agent_id UUID)**
   - Returns: number_of_bettors, total_bet, deposit_amount, first_deposit_users, first_deposit_amount

---

## Files to Modify

### Frontend Components:
- [ ] `src/components/Deposit.tsx` ✅ (Already fixed)
- [ ] `src/components/DepositHistoryView.tsx` (Add real-time subscription)
- [ ] `src/components/WithdrawHistoryView.tsx` (Add real-time subscription)
- [ ] Agent Dashboard component (Fetch real data)
- [ ] Promotion Page component (Fetch real data)
- [ ] Invitees Overview component (Fetch real data)
- [ ] Subordinates List component (Fetch real data)
- [ ] Analyze popup component (Fetch real data)
- [ ] Admin Deposit Requests component (Fetch real data)
- [ ] Admin Withdrawal Requests component (Fetch real data)

### Backend:
- [ ] `backend/supabase/MASTER_PRODUCTION_SCHEMA.sql` (Add new RPC functions)
- [ ] `backend/api/create-checkout.ts` ✅ (Already correct)
- [ ] `backend/api/deposit-webhook.ts` ✅ (Already correct)

---

## Implementation Priority

1. **CRITICAL:** Fix PKPay deposit flow ✅
2. **HIGH:** Create SQL RPC functions for agent statistics
3. **HIGH:** Update frontend components to fetch real data
4. **MEDIUM:** Add real-time subscriptions for withdrawal status
5. **MEDIUM:** Fix admin dashboard queries

---

## Testing Checklist

- [ ] User can make multiple deposits (each with unique order_id)
- [ ] Withdrawal status updates in real-time when admin approves
- [ ] Agent dashboard shows real team statistics
- [ ] Promotion page shows real lifetime statistics
- [ ] Invitees overview shows real statistics
- [ ] Subordinates list shows real individual statistics
- [ ] Commission calculations are accurate
- [ ] Admin can view deposit/withdrawal request details with correct fields
- [ ] Betting statistics show real data
- [ ] No hardcoded values anywhere
- [ ] No zero values unless user actually has zero activity
