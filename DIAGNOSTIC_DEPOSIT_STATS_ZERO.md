# DIAGNOSTIC GUIDE - Deposit Stats Showing 0

## PROBLEM
Deposit Users, Deposit Amount, and First Deposit Users are showing 0 even though deposits exist.

## ROOT CAUSE ANALYSIS

The issue is likely one of these:

### 1. **deposit_history table is empty**
   - Deposits are stored in `users.total_deposit` instead
   - OR deposits are in a different table
   - OR deposits haven't been recorded yet

### 2. **RLS (Row Level Security) blocking access**
   - The RPC function can't see the data due to RLS policies
   - Need to use `SECURITY DEFINER` (already done)

### 3. **Wrong table being queried**
   - The RPC is looking in `deposit_history` but data is in `deposits` table
   - OR data is in `transactions` table with type='deposit'

---

## STEP 1: Run Diagnostic Queries

Execute these in Supabase SQL Editor (service_role):

```sql
-- Check if deposit_history has data
SELECT COUNT(*) as total_deposits FROM public.deposit_history;
SELECT COUNT(*) as completed_deposits FROM public.deposit_history WHERE status = 'completed';
SELECT * FROM public.deposit_history LIMIT 5;

-- Check if users.total_deposit has data
SELECT COUNT(*) as users_with_deposits FROM public.users WHERE total_deposit > 0;
SELECT SUM(total_deposit) as total_deposit_sum FROM public.users;
SELECT * FROM public.users WHERE total_deposit > 0 LIMIT 5;

-- Check if deposits table has data
SELECT COUNT(*) FROM public.deposits;
SELECT * FROM public.deposits LIMIT 5;

-- Check if transactions has deposit records
SELECT COUNT(*) FROM public.transactions WHERE type = 'deposit';
SELECT * FROM public.transactions WHERE type = 'deposit' LIMIT 5;

-- Check referral relationships
SELECT COUNT(*) as users_with_referrer FROM public.users WHERE referred_by IS NOT NULL;
SELECT * FROM public.users WHERE referred_by IS NOT NULL LIMIT 5;
```

---

## STEP 2: Run Diagnostic RPC

Execute in Supabase SQL Editor:

```sql
-- Get diagnostic data for an agent
SELECT * FROM public.diagnose_deposit_data('YOUR_AGENT_UUID_HERE');
```

This will show:
- Direct Members count
- Deposit History Records count
- Users with total_deposit > 0
- Sum of total_deposit

---

## STEP 3: Identify the Data Source

Based on diagnostic results:

### If `Deposit History Records = 0` but `Users with total_deposit > 0 > 0`:
**Solution:** Use the FALLBACK functions
- `get_daily_subordinate_stats_fallback()`
- `get_daily_subordinates_list_fallback()`

### If `Users with total_deposit > 0 = 0` but `Direct Members > 0`:
**Solution:** Deposits haven't been recorded yet
- Check if deposits are being created
- Check if deposit triggers are working

### If `Direct Members = 0`:
**Solution:** No referral relationships exist
- Check if `referred_by` is being set correctly
- Check if users are being registered with referral codes

---

## STEP 4: Update Frontend to Use Correct Function

### Option A: If deposit_history has data
Keep using:
```typescript
const { data, error } = await adminSupabase
  .rpc('get_daily_subordinate_stats', { p_agent_id: uid });
```

### Option B: If users.total_deposit has data
Switch to:
```typescript
const { data, error } = await adminSupabase
  .rpc('get_daily_subordinate_stats_fallback', { p_agent_id: uid });
```

---

## STEP 5: Update InviteesOverviewView.tsx

Replace the RPC call in `fetchStats`:

```typescript
// CURRENT (may not work):
const { data, error } = await (adminSupabase as any)
  .rpc('get_daily_subordinate_stats', { p_agent_id: uid });

// CHANGE TO (if needed):
const { data, error } = await (adminSupabase as any)
  .rpc('get_daily_subordinate_stats_fallback', { p_agent_id: uid });
```

And in `fetchSubordinates`:

```typescript
// CURRENT (may not work):
const { data, error } = await (adminSupabase as any)
  .rpc('get_daily_subordinates_list', { p_agent_id: uid, p_limit: 1000, p_offset: 0 });

// CHANGE TO (if needed):
const { data, error } = await (adminSupabase as any)
  .rpc('get_daily_subordinates_list_fallback', { p_agent_id: uid, p_limit: 1000, p_offset: 0 });
```

---

## STEP 6: Verify the Fix

After making changes:

1. Open InviteesOverview
2. Check if Deposit Users shows a number > 0
3. Check if Deposit Amount shows Rs > 0
4. Check if First Deposit Users shows a number > 0

---

## COMMON ISSUES & SOLUTIONS

### Issue: Still showing 0 after switching to fallback
**Solution:** 
- Run diagnostic again
- Check if `referred_by` is NULL for all members
- Check if `total_deposit` is 0 for all members

### Issue: RPC function not found error
**Solution:**
- Execute the SQL migration: `fix_deposit_stats_zero.sql`
- Verify function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'get_daily%'`

### Issue: Permission denied error
**Solution:**
- Make sure you're using `adminSupabase` (service_role)
- Check RLS policies on deposit_history table
- Verify GRANT EXECUTE is set correctly

---

## QUICK REFERENCE

| Symptom | Cause | Solution |
|---------|-------|----------|
| Deposit Users = 0 | No deposit_history data | Use fallback function |
| Deposit Amount = 0 | No deposit_history data | Use fallback function |
| First Deposit Users = 0 | No deposit_history data | Use fallback function |
| RPC not found | SQL not executed | Run fix_deposit_stats_zero.sql |
| Permission denied | RLS blocking | Use SECURITY DEFINER (already done) |
| Still 0 after fix | No referral data | Check referred_by column |

---

## NEXT STEPS

1. Run diagnostic queries
2. Identify data source (deposit_history vs users.total_deposit)
3. Update frontend to use correct RPC function
4. Test and verify
5. Monitor for any issues

---

## SUPPORT

If still having issues:
1. Share diagnostic output
2. Share which RPC function you're using
3. Share error messages from browser console
4. Share Supabase logs
