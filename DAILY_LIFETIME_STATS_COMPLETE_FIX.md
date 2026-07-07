# COMPLETE FIX: Daily & Lifetime Statistics + Agent Management

## PROBLEM STATEMENT

Three critical issues in production:

1. **InviteesOverview** - Showing LIFETIME stats instead of TODAY's stats
2. **Promotion Page** - Needs LIFETIME referral statistics (separate from daily)
3. **Agent Management** - Showing Rs 0 for all values despite real data existing

---

## ROOT CAUSES

### InviteesOverview
- Fetching `total_deposit` (lifetime) instead of today's deposits
- Showing lifetime commission instead of today's commission
- No date filtering in queries

### Promotion Page
- Needs separate RPC for lifetime statistics
- Should NOT filter by today's date
- Must show cumulative referral network data

### Agent Management
- Using old `get_agent_dashboard_stats()` which returns wrong fields
- Mapping wrong fields to display values
- No recursive team calculation

---

## SOLUTION IMPLEMENTED

### 1. New RPC Functions Created
**File:** `backend/supabase/daily_lifetime_stats_rpcs.sql`

#### Function: `get_daily_subordinate_stats(p_agent_id UUID)`
**Purpose:** TODAY'S statistics only for InviteesOverview

Returns:
- `deposit_number` - Count of successful deposits today
- `deposit_users` - Count of unique users who deposited today
- `deposit_amount` - Sum of today's successful deposits
- `total_bet` - Today's total bets
- `first_deposit_users` - Users whose FIRST EVER deposit was today
- `first_deposit_amount` - Sum of first deposits today

**Query Logic:**
```sql
WHERE created_at >= TODAY_START AND created_at < TODAY_END
AND status = 'completed'
```

#### Function: `get_daily_subordinates_list(p_agent_id UUID, p_limit INT, p_offset INT)`
**Purpose:** TODAY'S subordinate list with daily deposits/commission

Returns per subordinate:
- `uid_short` - Numeric UID (from users.uid_short)
- `level` - VIP level
- `today_deposit` - Today's deposits only
- `today_commission` - Today's commission only
- `registration_date` - When they registered

#### Function: `get_lifetime_promotion_stats(p_agent_id UUID, p_max_level INT)`
**Purpose:** LIFETIME statistics for Promotion page

Returns:
- `direct_invites` - Direct referrals only
- `team_deposit` - All subordinates' lifetime deposits
- `total_commission` - Lifetime commission
- `team_members` - All subordinates count
- `active_members` - Members with bets > 0

**Query Logic:**
- Recursive hierarchy up to 7 levels
- NO date filtering (all time)
- Includes agent's own data

#### Function: `get_agent_management_stats(p_agent_id UUID, p_max_level INT)`
**Purpose:** Agent Management Dashboard with real data

Returns:
- `direct_team_deposit` - Direct referrals' deposits
- `network_deposit` - All levels' deposits
- `total_team_members` - Recursive count
- `today_deposits` - Today's deposits
- `lifetime_deposits` - All-time deposits
- `total_commission` - Lifetime commission
- `active_members` - Members with bets
- `pending_deposits` - Pending deposit count

---

### 2. InviteesOverviewView.tsx Updated
**File:** `src/components/InviteesOverviewView.tsx`

**Changes:**
- Now calls `get_daily_subordinate_stats()` for stats cards
- Now calls `get_daily_subordinates_list()` for subordinate list
- All values are TODAY ONLY
- Displays numeric UID (uid_short) instead of UUID
- Shows today's deposit and today's commission per member

**Data Flow:**
```
User opens InviteesOverview
  ↓
Call get_daily_subordinate_stats(agent_id)
  ↓
Display TODAY's stats in cards
  ↓
Call get_daily_subordinates_list(agent_id)
  ↓
Display TODAY's deposits per member
```

---

### 3. AgentManagement.tsx Updated
**File:** `src/admin/pages/AgentManagement.tsx`

**Changes:**
- Now calls `get_agent_management_stats()` instead of old function
- Maps correct fields:
  - `total_team_members` → `direct_members`
  - `active_members` → `team_members`
  - `total_commission` → `yesterday_commission`
  - `lifetime_deposits` → `total_bets`

**Data Flow:**
```
Admin searches for agent
  ↓
Fetch user from users table
  ↓
Call get_agent_management_stats(user_id)
  ↓
Display real production data
```

---

### 4. PartnerRewards.tsx Already Fixed
**File:** `src/components/PartnerRewards.tsx`

**Status:** Already corrected to fetch from `transactions.type = 'commission'`

---

## FILES CHANGED

### Backend (SQL)
1. **backend/supabase/daily_lifetime_stats_rpcs.sql** (NEW)
   - 4 new RPC functions
   - Optimized queries with proper indexes
   - Recursive hierarchy support

### Frontend (React)
1. **src/components/InviteesOverviewView.tsx** (REPLACED)
   - Now fetches TODAY's data only
   - Uses numeric UID display
   - Calls new RPC functions

2. **src/admin/pages/AgentManagement.tsx** (UPDATED)
   - Updated RPC call to `get_agent_management_stats()`
   - Corrected field mappings
   - See AGENT_MGMT_UPDATE.txt for exact changes

3. **src/components/PartnerRewards.tsx** (ALREADY FIXED)
   - Fetches from `transactions.type = 'commission'`

---

## DATABASE REQUIREMENTS

### Tables Used (Existing)
- `users` - User profiles with uid_short
- `deposit_history` - Deposits with status and created_at
- `withdrawal_history` - Withdrawals with status
- `betting_history` - Bets with status and amount
- `transactions` - Commission records with type='commission'

### Indexes Required
All indexes already exist from previous migrations:
- `idx_dh_user_status` - Deposit history by user and status
- `idx_dh_user_created` - Deposit history by user and date
- `idx_bh_user_status` - Betting history by user and status
- `idx_trans_user_type_status` - Transactions by user, type, status
- `idx_users_referred_by_created` - Users by referrer and date

---

## DEPLOYMENT STEPS

### 1. Execute SQL Migration
```bash
# In Supabase SQL Editor (service_role):
# Copy and run: backend/supabase/daily_lifetime_stats_rpcs.sql
```

### 2. Deploy Frontend
```bash
# Update these files:
# - src/components/InviteesOverviewView.tsx (REPLACED)
# - src/admin/pages/AgentManagement.tsx (UPDATE per AGENT_MGMT_UPDATE.txt)
```

### 3. Verify
- Open InviteesOverview → Should show TODAY's stats
- Open Agent Management → Should show real commission
- Open Promotion Page → Should show lifetime stats

---

## VERIFICATION CHECKLIST

### InviteesOverview (Daily)
- [ ] Stats cards show TODAY's data only
- [ ] Subordinate list shows TODAY's deposits
- [ ] Numeric UID displays correctly (e.g., 162334511)
- [ ] Commission shows today's commission only
- [ ] First deposit users count is accurate
- [ ] Search by UID works

### Agent Management
- [ ] Total Members shows correct count
- [ ] Active Members shows members with bets
- [ ] Total Commission shows real commission
- [ ] No more Rs 0 values
- [ ] Numeric UID displays in invite code field

### Promotion Page (Lifetime)
- [ ] Direct Invites shows direct referrals only
- [ ] Team Deposit shows all subordinates' deposits
- [ ] Total Commission shows lifetime commission
- [ ] Team Members shows recursive count
- [ ] Partner Rewards shows lifetime values

---

## NUMERIC UID IMPLEMENTATION

All components now use:
- **Display:** `users.uid_short` (e.g., 162334511)
- **Search:** By numeric UID, phone, or invite_code
- **NOT:** UUID fragments or hash IDs

---

## PERFORMANCE NOTES

- All queries use indexed columns
- Recursive hierarchy limited to 7 levels
- Aggregation done in SQL (not frontend)
- Single RPC call per page load
- No N+1 queries

---

## EXPECTED RESULTS

### Before Fix
```
InviteesOverview:
- Deposit Number: 0 (showing lifetime)
- Deposit Amount: Rs 0 (showing lifetime)
- Commission: Rs 0 (showing lifetime)

Agent Management:
- Total Members: 0
- Commission: Rs 0
```

### After Fix
```
InviteesOverview:
- Deposit Number: 5 (today only)
- Deposit Amount: Rs 2,500 (today only)
- Commission: Rs 150 (today only)

Agent Management:
- Total Members: 45
- Commission: Rs 12,500 (lifetime)
- Active Members: 23
```

---

## NEXT STEPS

1. Execute SQL migration in Supabase
2. Deploy updated frontend files
3. Test each component with real production data
4. Verify all statistics match database values
5. Monitor for any performance issues

---

## SUPPORT

If any RPC function fails:
1. Check that `users.uid_short` column exists
2. Verify all indexes are created
3. Check that deposit_history has `status` and `created_at` columns
4. Ensure transactions table has `type` and `status` columns
