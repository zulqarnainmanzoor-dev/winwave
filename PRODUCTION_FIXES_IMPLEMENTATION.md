# PRODUCTION FIXES - IMPLEMENTATION GUIDE

## CRITICAL FIXES APPLIED

### ✅ PRIORITY 1: PKPay Deposit Flow - FIXED
**File Modified:** `src/components/Deposit.tsx`
**Change:** Replaced hardcoded static order_ids with dynamic API-based checkout
**Result:** Every deposit now generates a unique order_id

---

## REQUIRED FIXES - IMPLEMENTATION STEPS

### STEP 1: Deploy SQL Functions (Backend)

**File:** `backend/supabase/agent_statistics_functions.sql`

**Action:** Run this SQL file in Supabase SQL Editor to create 6 new RPC functions:
1. `get_agent_team_stats(agent_id)` - Team statistics
2. `get_agent_commission_stats(agent_id)` - Commission statistics
3. `get_invitees_stats(agent_id)` - Direct invitees statistics
4. `get_subordinate_stats(subordinate_id)` - Individual subordinate statistics
5. `get_network_analysis(agent_id)` - Network-wide analysis
6. `get_betting_stats(agent_id)` - Betting statistics

**Verification:**
```sql
-- Test the functions
SELECT * FROM get_agent_team_stats('YOUR_AGENT_UUID');
SELECT * FROM get_agent_commission_stats('YOUR_AGENT_UUID');
SELECT * FROM get_invitees_stats('YOUR_AGENT_UUID');
SELECT * FROM get_subordinate_stats('YOUR_SUBORDINATE_UUID');
SELECT * FROM get_network_analysis('YOUR_AGENT_UUID');
SELECT * FROM get_betting_stats('YOUR_AGENT_UUID');
```

---

### STEP 2: Update Frontend Components

#### 2.1 Add Real-Time Subscription to Withdrawal History
**File:** `src/components/WithdrawHistoryView.tsx` (if exists, or create it)

**Add this subscription pattern:**
```typescript
useEffect(() => {
  if (!uid) return;

  const channel = supabase
    .channel(`withdrawal-history-${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'withdrawal_history',
        filter: `user_id=eq.${uid}`,
      },
      () => {
        fetchWithdrawals(); // Refetch when status changes
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [uid]);
```

---

#### 2.2 Update Agent Dashboard Component
**File:** `src/components/AgentDashboard.tsx` (or similar)

**Replace hardcoded values with RPC calls:**
```typescript
const fetchAgentStats = async () => {
  if (!uid) return;

  const { data: teamStats } = await supabase.rpc('get_agent_team_stats', { p_agent_id: uid });
  const { data: commissionStats } = await supabase.rpc('get_agent_commission_stats', { p_agent_id: uid });
  
  if (teamStats) {
    setStats({
      totalTeamDeposit: teamStats[0].total_deposit,
      todayTeamDeposit: teamStats[0].today_deposit,
      totalWithdraw: teamStats[0].total_withdraw,
      todayWithdraw: teamStats[0].today_withdraw,
      activeMembers: teamStats[0].active_members,
      totalMembers: teamStats[0].total_members,
      firstDepositUsers: teamStats[0].first_deposit_users,
    });
  }
  
  if (commissionStats) {
    setCommissionStats({
      totalCommission: commissionStats[0].total_commission,
      todayCommission: commissionStats[0].today_commission,
      yesterdayCommission: commissionStats[0].yesterday_commission,
      pendingCommission: commissionStats[0].pending_commission,
      claimedCommission: commissionStats[0].claimed_commission,
    });
  }
};
```

---

#### 2.3 Update Promotion Page Component
**File:** `src/components/PromotionView.tsx` (or similar)

**Replace with real data:**
```typescript
const fetchPromotionStats = async () => {
  if (!uid) return;

  const { data: inviteesStats } = await supabase.rpc('get_invitees_stats', { p_agent_id: uid });
  
  if (inviteesStats) {
    setStats({
      totalDepositAmount: inviteesStats[0].total_deposit_amount,
      numberOfBettors: inviteesStats[0].number_of_bettors,
      firstDepositUsers: inviteesStats[0].first_deposit_users,
      totalBetAmount: inviteesStats[0].total_bet_amount,
      firstDepositAmount: inviteesStats[0].first_deposit_amount,
    });
  }
};
```

---

#### 2.4 Update Invitees Overview Component
**File:** `src/components/InviteesOverviewView.tsx` (or similar)

**Same as Promotion Page - use `get_invitees_stats()`**

---

#### 2.5 Update Subordinates List Component
**File:** `src/components/SubordinatesListView.tsx` (or similar)

**For each subordinate row:**
```typescript
const fetchSubordinateStats = async (subordinateId: string) => {
  const { data: stats } = await supabase.rpc('get_subordinate_stats', { p_subordinate_id: subordinateId });
  
  if (stats) {
    return {
      uid: stats[0].uid_short,
      registrationDate: stats[0].registration_date,
      todayDeposit: stats[0].today_deposit,
      lifetimeDeposit: stats[0].lifetime_deposit,
      totalBet: stats[0].total_bet,
      commission: stats[0].commission,
    };
  }
};
```

---

#### 2.6 Update Analyze Popup Component
**File:** `src/components/AnalyzePopup.tsx` (or similar)

**Replace with real data:**
```typescript
const fetchNetworkAnalysis = async () => {
  if (!uid) return;

  const { data: analysis } = await supabase.rpc('get_network_analysis', { p_agent_id: uid });
  
  if (analysis) {
    setAnalysis({
      totalNetworkAccounts: analysis[0].total_network_accounts,
      genuineProfiles: analysis[0].genuine_profiles,
      todayDeposits: analysis[0].today_deposits,
      todayWithdrawals: analysis[0].today_withdrawals,
      lifetimeDeposits: analysis[0].lifetime_deposits,
      lifetimeWithdrawals: analysis[0].lifetime_withdrawals,
    });
  }
};
```

---

#### 2.7 Update Admin Deposit Requests Component
**File:** `src/admin/pages/DepositRequestDetails.tsx` (or similar)

**Query deposit_history with correct fields:**
```typescript
const fetchDepositDetails = async (depositId: string) => {
  const { data: deposit } = await supabase
    .from('deposit_history')
    .select(`
      id,
      amount,
      method,
      order_id,
      pkpay_order_id,
      gateway_ref,
      status,
      created_at,
      updated_at,
      user_id,
      users(phone_number)
    `)
    .eq('id', depositId)
    .single();

  if (deposit) {
    return {
      uid: deposit.user_id.substring(0, 8),
      userName: deposit.users.phone_number,
      depositAmount: deposit.amount,
      depositMethod: deposit.method,
      merchantOrderId: deposit.order_id,
      pkpayOrderId: deposit.pkpay_order_id,
      gatewayReference: deposit.gateway_ref,
      status: deposit.status,
      createdTime: deposit.created_at,
      updatedTime: deposit.updated_at,
    };
  }
};
```

---

#### 2.8 Update Admin Withdrawal Requests Component
**File:** `src/admin/pages/WithdrawalRequestDetails.tsx` (or similar)

**Query withdrawal_history with correct fields:**
```typescript
const fetchWithdrawalDetails = async (withdrawalId: string) => {
  const { data: withdrawal } = await supabase
    .from('withdrawal_history')
    .select(`
      id,
      amount,
      method,
      account_name,
      account_no,
      status,
      created_at,
      updated_at,
      user_id,
      users(phone_number, main_balance)
    `)
    .eq('id', withdrawalId)
    .single();

  if (withdrawal) {
    return {
      uid: withdrawal.user_id.substring(0, 8),
      userName: withdrawal.users.phone_number,
      withdrawalAmount: withdrawal.amount,
      withdrawalMethod: withdrawal.method,
      walletName: withdrawal.account_name,
      walletAccountNumber: withdrawal.account_no,
      mainBalance: withdrawal.users.main_balance,
      status: withdrawal.status,
      createdTime: withdrawal.created_at,
      updatedTime: withdrawal.updated_at,
    };
  }
};
```

---

#### 2.9 Update Betting Statistics Component
**File:** `src/components/BettingStatisticsView.tsx` (or similar)

**Use `get_betting_stats()` RPC:**
```typescript
const fetchBettingStats = async () => {
  if (!uid) return;

  const { data: stats } = await supabase.rpc('get_betting_stats', { p_agent_id: uid });
  
  if (stats) {
    setStats({
      numberOfBettors: stats[0].number_of_bettors,
      totalBet: stats[0].total_bet,
      depositAmount: stats[0].deposit_amount,
      firstDepositUsers: stats[0].first_deposit_users,
      firstDepositAmount: stats[0].first_deposit_amount,
    });
  }
};
```

---

### STEP 3: Verify Withdrawal Status Updates

**Current Implementation:** `WithdrawView.tsx` already has the withdrawal submission logic

**Verify:**
1. User submits withdrawal via `submitWithdrawal()` RPC
2. Status is set to 'pending' in database
3. Admin approves via `approve_withdrawal()` RPC
4. Status changes to 'processing'
5. Frontend should show updated status immediately

**If not working:**
- Add real-time subscription to `withdrawal_history` table
- Listen for status changes
- Refetch withdrawal history when status changes

---

### STEP 4: Verify Commission Trigger

**Current Implementation:** Trigger `trg_credit_agent_commission` should fire on betting_history INSERT

**Verify:**
1. Check if trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_credit_agent_commission';`
2. Check if transactions table has commission records: `SELECT * FROM transactions WHERE type = 'commission' LIMIT 10;`
3. If missing, the trigger may not be firing correctly

**Fix if needed:**
```sql
-- Verify trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_credit_agent_commission';

-- If missing, recreate it (already in MASTER_PRODUCTION_SCHEMA.sql)
-- Or check if betting_history inserts are happening
SELECT COUNT(*) FROM betting_history;
```

---

## DEPLOYMENT CHECKLIST

- [ ] Run `backend/supabase/agent_statistics_functions.sql` in Supabase
- [ ] Verify all 6 RPC functions are created
- [ ] Update `src/components/Deposit.tsx` ✅ (Already done)
- [ ] Update Agent Dashboard component
- [ ] Update Promotion Page component
- [ ] Update Invitees Overview component
- [ ] Update Subordinates List component
- [ ] Update Analyze Popup component
- [ ] Update Admin Deposit Requests component
- [ ] Update Admin Withdrawal Requests component
- [ ] Update Betting Statistics component
- [ ] Add real-time subscription to withdrawal history
- [ ] Test all components with real data
- [ ] Verify no hardcoded values remain
- [ ] Verify no zero values unless user has zero activity

---

## TESTING PROCEDURES

### Test 1: Deposit Flow
1. User clicks "Deposit"
2. Selects amount and payment method
3. Clicks "Pay Now"
4. Verify unique order_id is generated
5. Verify deposit_history record is created
6. Verify checkout URL is returned
7. Verify user can make multiple deposits (each with different order_id)

### Test 2: Withdrawal Status
1. User submits withdrawal
2. Admin approves withdrawal
3. Verify status changes to 'processing' in database
4. Verify user sees updated status immediately (no refresh needed)

### Test 3: Agent Dashboard
1. Agent logs in
2. Verify all statistics show real data (not zero or hardcoded)
3. Verify statistics match database queries
4. Verify statistics update when team members deposit/bet

### Test 4: Commission Calculation
1. Team member places a bet
2. Verify commission is calculated correctly
3. Verify commission appears in agent's transactions table
4. Verify commission is credited to agent's balance

### Test 5: Admin Dashboard
1. Admin views deposit request details
2. Verify all fields are populated correctly
3. Verify numeric UID is displayed
4. Verify user name is displayed
5. Verify all timestamps are correct

---

## KNOWN ISSUES & WORKAROUNDS

### Issue: Commission not appearing
**Cause:** Trigger may not be firing
**Workaround:** Check if betting_history records are being created
**Fix:** Verify trigger `trg_credit_agent_commission` exists and is enabled

### Issue: Statistics showing zero
**Cause:** No data in database or RPC function not called
**Workaround:** Check if users have actually deposited/bet
**Fix:** Verify RPC function is being called and returning data

### Issue: Withdrawal status not updating
**Cause:** No real-time subscription
**Workaround:** User must refresh page to see updated status
**Fix:** Add real-time subscription to withdrawal_history table

---

## FILES MODIFIED SUMMARY

### Backend (SQL):
- ✅ `backend/supabase/agent_statistics_functions.sql` (NEW - 6 RPC functions)

### Frontend (React/TypeScript):
- ✅ `src/components/Deposit.tsx` (FIXED - dynamic order_id)
- ⏳ `src/components/AgentDashboard.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/components/PromotionView.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/components/InviteesOverviewView.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/components/SubordinatesListView.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/components/AnalyzePopup.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/admin/pages/DepositRequestDetails.tsx` (TO UPDATE - correct fields)
- ⏳ `src/admin/pages/WithdrawalRequestDetails.tsx` (TO UPDATE - correct fields)
- ⏳ `src/components/BettingStatisticsView.tsx` (TO UPDATE - fetch real data)
- ⏳ `src/components/WithdrawHistoryView.tsx` (TO UPDATE - add real-time subscription)

---

## CONFIRMATION

✅ **PKPay Deposit Flow:** FIXED - Every deposit generates unique order_id
✅ **SQL Functions:** CREATED - 6 RPC functions for agent statistics
⏳ **Frontend Updates:** PENDING - Components need to call RPC functions
⏳ **Real-Time Updates:** PENDING - Add subscriptions for withdrawal status
⏳ **Admin Dashboard:** PENDING - Update to use correct database fields

---

## NEXT STEPS

1. Deploy SQL functions to Supabase
2. Update frontend components one by one
3. Test each component with real data
4. Verify no hardcoded values remain
5. Deploy to production
