# Debug Guide: "0 Invitees" Issue

## Problem
The "Promotion" dashboard shows **0** for "Total Direct Invites", "Registered Users", etc., even though data EXISTS in the Supabase `public.users` table.

## Root Cause Analysis
The issue is likely one of the following:
1. **User Context Issue**: `currentUser.uid` is null/undefined when queries run
2. **Timing Issue**: Queries run before UserContext has finished loading
3. **Case Sensitivity**: UIDs in database don't match the format being queried
4. **Column Name Mismatch**: Using wrong column name (e.g., `referrer_id` instead of `referred_by`)

## Debug Implementation

### Changes Made to `InviteesOverviewView.tsx`

#### 1. Added Debug UID Variables
```typescript
// DEBUG: Hardcoded UID for testing - REPLACE WITH YOUR ACTUAL UID
const DEBUG_UID = 'de384bee-cbc4-4d65-8396-5bd7da13a6d2'; // Example format
const useDebugUid = false; // Set to true to test with hardcoded UID
const effectiveUid = useDebugUid ? DEBUG_UID : uid;
```

#### 2. Added Comprehensive Logging
```typescript
console.log('🔍 [InviteesOverview] Component render - uid:', uid, 'type:', typeof uid, 'length:', uid?.length);
console.log('📊 [InviteesOverview] Fetching stats for effectiveUid:', effectiveUid);
console.log('🔍 [InviteesOverview] Direct invitees found:', directInvitees?.length || 0);
```

#### 3. Updated All Queries to Use `effectiveUid`
- `fetchStats()` - Uses `effectiveUid` for stats queries
- `fetchInvitees()` - Uses `effectiveUid` for invitee queries
- `fetchSubordinates()` - Uses `effectiveUid` for subordinate queries

#### 4. Added useEffect Dependencies
```typescript
useEffect(() => { void fetchStats(); }, [fetchStats, effectiveUid]);
useEffect(() => { void fetchInvitees(); }, [fetchInvitees, effectiveUid]);
useEffect(() => { void fetchSubordinates(); }, [fetchSubordinates, effectiveUid]);
```

## How to Use Debug Mode

### Step 1: Enable Debug Mode
Open `src/components/InviteesOverviewView.tsx` and find:
```typescript
const useDebugUid = false; // Set to true to test with hardcoded UID
```

Change to:
```typescript
const useDebugUid = true; // Set to true to test with hardcoded UID
```

### Step 2: Replace with Your Actual UID
```typescript
const DEBUG_UID = 'YOUR_ACTUAL_UID_HERE'; // Replace with your UUID
```

**How to find your UID:**
1. Open browser DevTools (F12)
2. Go to Application tab → Local Storage
3. Look for `winwave_user_session`
4. Copy the `uid` value

Or check the console logs - your UID should be logged when the app loads.

### Step 3: Test and Observe Console Logs
Open the browser console and look for these logs:

```
🔍 [InviteesOverview] Component render - uid: <your-uid> type: string length: 36
📊 [InviteesOverview] Fetching stats for effectiveUid: <your-uid>
🔍 [InviteesOverview] Direct invitees found: X
```

## Expected Results

### If Data EXISTS in Database:
```
✅ Direct invitees found: 5
✅ Team members found: 3
✅ Total subordinates set: 8
```

### If Issue is User Context:
```
⚠️ [InviteesOverview] No effectiveUid available, skipping fetchStats
🔍 [InviteesOverview] Component render - uid:  type: undefined length: undefined
```

### If Issue is Database:
```
✅ Direct invitees found: 0
✅ Query executed successfully but returned 0 rows
```

## Fixes Based on Debug Results

### Scenario 1: uid is undefined/null
**Problem**: UserContext hasn't loaded yet when component renders

**Solution**: Add loading state check
```typescript
const { uid, isLoading } = useUser();

if (isLoading) {
  return <div>Loading...</div>;
}
```

### Scenario 2: uid exists but returns 0 results
**Problem**: Data doesn't exist OR query is wrong

**Solution**: 
1. Verify in Supabase dashboard that `referred_by` column has your UID
2. Check for case sensitivity: `SELECT * FROM users WHERE LOWER(referred_by) = LOWER('your-uid')`
3. Check for extra spaces: `SELECT * FROM users WHERE TRIM(referred_by) = 'your-uid'`

### Scenario 3: Query works with hardcoded UID but not with context
**Problem**: Timing issue - queries run before uid is available

**Solution**: Add uid to useEffect dependencies (already done)
```typescript
useEffect(() => { 
  if (!uid) return; // Wait for uid
  void fetchStats(); 
}, [uid, fetchStats]);
```

## Testing Checklist

- [ ] Set `useDebugUid = true`
- [ ] Replace `DEBUG_UID` with your actual UID
- [ ] Open browser console
- [ ] Navigate to Invitees Overview
- [ ] Check console logs for "Direct invitees found: X"
- [ ] If X > 0: Issue is with UserContext/uid provisioning
- [ ] If X = 0: Issue is with database data or query logic

## Column Name Verification

Ensure your `users` table has these EXACT column names:
- ✅ `id` (UUID primary key)
- ✅ `referred_by` (UUID - stores who referred this user)
- ✅ `invite_code` (text - user's invite code)
- ✅ `phone_number` (text)
- ✅ `total_deposit` (numeric)
- ✅ `total_bets` (numeric)
- ✅ `created_at` (timestamp)

**Common Mistakes:**
- ❌ `referrer_id` (wrong)
- ❌ `parent_uid` (wrong)
- ❌ `referral_code` (this is the user's own code, not who referred them)

## Quick Database Test

Run this query in Supabase SQL Editor to verify data:
```sql
-- Check if your UID has any referrals
SELECT 
  id, 
  invite_code, 
  phone_number, 
  referred_by,
  created_at
FROM users 
WHERE referred_by = 'YOUR_UID_HERE'
ORDER BY created_at DESC;
```

If this returns 0 rows, the issue is **database data** (no one has your UID as referrer).

If this returns rows, the issue is **query logic** (queries not using the right UID).

## Next Steps After Debugging

1. **If hardcoded UID works**: The issue is with UserContext. Fix the context loading.
2. **If hardcoded UID also returns 0**: The issue is with database. Verify data exists.
3. **Once fixed**: Set `useDebugUid = false` and remove debug logs.

## Console Log Reference

### Successful Fetch:
```
🔍 [InviteesOverview] Component render - uid: abc-123 type: string length: 36
📊 [InviteesOverview] Fetching stats for effectiveUid: abc-123
🔍 [InviteesOverview] Direct members found: 5
🔍 [InviteesOverview] Team members found: 3
🔍 [InviteesOverview] Total subordinates set: 8
```

### Failed Fetch (No Data):
```
🔍 [InviteesOverview] Component render - uid: abc-123 type: string length: 36
📊 [InviteesOverview] Fetching stats for effectiveUid: abc-123
🔍 [InviteesOverview] Direct members found: 0
⚠️ No subordinates found
```

### Failed Fetch (No UID):
```
🔍 [InviteesOverview] Component render - uid:  type: undefined length: undefined
⚠️ [InviteesOverview] No effectiveUid available, skipping fetchStats
```

## Important Notes

- **Keep debug mode ON** until you identify the issue
- **Check console logs first** - they tell you exactly what's happening
- **Test with hardcoded UID** to rule out context issues
- **Verify database directly** using SQL queries
- **Remove debug code** only after the issue is fixed

## Support

If logs show:
- `uid: undefined` → UserContext issue, check login flow
- `uid: ""` (empty string) → Session not persisted, check localStorage
- `Direct invitees found: 0` with valid uid → Database issue, verify data
- `Error fetching direct invitees` → Query syntax error, check error message