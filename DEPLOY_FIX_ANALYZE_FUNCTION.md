# DEPLOYMENT - FIX ANALYZE FUNCTION & AGENT DASHBOARD

## ✅ WHAT'S BROKEN

The `analyze_agent_network_fraud()` function was dropped during migration and doesn't exist in the database.

Frontend is calling it but it returns NULL/error.

## 🚀 FIX (2 STEPS)

### STEP 1: Run SQL Function (2 minutes)

**File:** `backend/supabase/fix_analyze_agent_network_fraud.sql`

1. Open Supabase SQL Editor
2. Copy entire file content
3. Paste into SQL Editor
4. Click "Run"
5. Verify: `SELECT proname FROM pg_proc WHERE proname = 'analyze_agent_network_fraud';`
   - Should return 1 row

### STEP 2: Deploy Backend & Frontend (Already Done)

✅ `backend/api/create-checkout.ts` - Fixed
✅ `src/components/Deposit.tsx` - Fixed
✅ `src/admin/pages/AgentManagement.tsx` - Already calling the function

## ✅ WHAT YOU GET

After deploying the SQL function:

### Agent Dashboard Shows Real Data:
- ✅ Total Network Accounts (7-level recursive)
- ✅ Genuine Profiles (users with bets)
- ✅ Today's Deposits (real sum)
- ✅ Today's Withdrawals (real sum)
- ✅ Lifetime Deposits (real sum)
- ✅ Lifetime Withdrawals (real sum)
- ✅ Active Bettors (count)
- ✅ Total Bet Volume (sum)
- ✅ Fraud Risk Score (0-100)
- ✅ Flagged Accounts (suspicious activity)

### Multi-UID Scanner:
- ✅ Scan multiple agent UIDs
- ✅ See deposits/withdrawals for each
- ✅ Detect duplicate IPs
- ✅ Identify fraud patterns

## 📊 FUNCTION DETAILS

**Function Name:** `analyze_agent_network_fraud(agent_id UUID)`

**Returns:**
```
total_network_accounts: BIGINT
unique_genuine_profiles: BIGINT
today_deposits: NUMERIC
today_withdrawals: NUMERIC
lifetime_deposits: NUMERIC
lifetime_withdrawals: NUMERIC
network_depth: INT (always 7)
active_bettors: BIGINT
total_bet_volume: NUMERIC
fraud_risk_score: NUMERIC (0-100)
flagged_accounts: JSONB (array of suspicious accounts)
```

**Uses Only Existing Tables:**
- users
- deposit_history
- withdrawal_history
- betting_history

**No Schema Changes:**
- No new tables
- No column modifications
- No constraints changed

## 🔍 VERIFY IT WORKS

### Test 1: Function Exists
```sql
SELECT proname, oid::regprocedure
FROM pg_proc
WHERE proname = 'analyze_agent_network_fraud';
```
Should return 1 row.

### Test 2: Call Function
```sql
SELECT * FROM analyze_agent_network_fraud('YOUR_AGENT_UUID');
```
Should return real data (not zeros).

### Test 3: Frontend
1. Go to Admin → Agent Management
2. Search for an agent
3. Click "🛡️ Analyze Agent Fraud Network"
4. Should see real statistics

## ⏱️ TOTAL TIME

- SQL Deploy: 2 minutes
- Testing: 5 minutes
- **Total: 7 minutes**

## ✅ CONFIRMATION

After deployment:
✅ Analyze button works
✅ Shows real network data
✅ Shows real deposits/withdrawals
✅ Shows fraud risk score
✅ Multi-UID scanner works
✅ No more NULL/error responses

---

**That's it! Just run the SQL file and everything works.**
