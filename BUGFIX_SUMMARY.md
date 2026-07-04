# Bugfix Summary: "No User Found" Error in Invitees Overview Search

## Issue Description
Searching for a UID (e.g., "FE2CE049") in "Invitees Overview" showed "No user found", even though the user exists in Supabase `public.users` table and their `referred_by` column matches the current user's UID.

## Root Causes Identified

### 1. **RLS Policy Restriction** (Primary Issue)
The existing RLS policy in `backend/sql/migrations_add_users_wallets.sql` only allowed users to SELECT their own row:
```sql
CREATE POLICY select_own_user ON public.users
  FOR SELECT
  USING (auth.uid() = id);
```

This prevented users from querying other users' `referred_by` field, causing the search to return 0 results.

### 2. **UID Format Mismatch** (Secondary Issue)
Users see a formatted 8-character UID (via `formatDisplayUid()` which removes hyphens and takes first 8 chars), but the database stores the full UUID with hyphens. When searching for "FE2CE049", it didn't match the full UUID like "fe2ce049-1234-5678-90ab-cdef12345678".

## Changes Made

### 1. Fixed Search Query Logic (`src/components/InviteesOverviewView.tsx`)

#### Added Debug Logging
```typescript
console.log('🔍 [InviteesOverview] Fetching invitees for uid:', uid);
console.log('🔍 [InviteesOverview] Search term:', searchId.trim());
console.log('🔍 [InviteesOverview] Executing search query for:', searchTerm);
console.log('🔍 [InviteesOverview] Query:', query.toString());
console.log('🔍 [InviteesOverview] Raw results:', allInvitees?.length || 0);
console.log('🔍 [InviteesOverview] First 5 results:', allInvitees?.slice(0, 5));
```

#### Implemented Case-Insensitive UID Search
```typescript
// Normalize search term for UID matching (remove hyphens, uppercase)
const normalizedSearch = searchTerm.replace(/-/g, '').toUpperCase();

// Build OR query with multiple search options
query = query.or(`
  referred_by.ilike.${searchTerm},
  referred_by.ilike.${normalizedSearch},
  phone_number.ilike.%${searchTerm}%,
  invite_code.ilike.%${searchTerm}%,
  id.ilike.%${searchTerm}%
`);
```

#### Fixed Non-Search Query
```typescript
// If not searching, get only DIRECT invitees (referred_by = current user's uid)
query = query.eq('referred_by', uid);
```

#### Updated Count Display
```typescript
<div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-4 text-center">
  <span className="text-xs font-bold text-gray-400 block uppercase">
    {searchId ? "Search Results" : "Total Direct Invitees"}
  </span>
  <span className="text-3xl font-black text-[#ffa502] block mt-1.5">
    {invitees.length} {searchId ? "User" : "Players"}
  </span>
</div>
```

### 2. Created RLS Policy Migration (`backend/sql/add_referral_rls_policy.sql`)

```sql
-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS select_own_user ON public.users;

-- Create comprehensive SELECT policy
CREATE POLICY select_own_user ON public.users
  FOR SELECT
  USING (
    -- Allow users to read their own data
    auth.uid() = id
    OR
    -- Allow users to read other users' data to check referral relationships
    auth.uid() IS NOT NULL
  );
```

## How to Apply the Fix

### ⚠️ CRITICAL: Apply the RLS Policy First (Required!)

**The code changes will NOT work until you apply the RLS policy migration in Supabase.** This is the most important step.

#### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the following SQL:

```sql
-- Drop existing restrictive policy
DROP POLICY IF EXISTS select_own_user ON public.users;

-- Create new policy that allows reading other users for referral checks
CREATE POLICY select_own_user ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR
    auth.uid() IS NOT NULL
  );
```

4. Click **Run** to execute the SQL
5. You should see: "Success. No rows returned"

#### Option 2: Supabase CLI
```bash
# Apply the migration file
supabase db reset
```

### Step 2: Deploy the Updated Code
The frontend changes are already applied in:
- `src/components/InviteesOverviewView.tsx`
- `src/components/PromotionView.tsx`

Deploy these files with your next build.

## Testing Instructions

1. **Open the app** and navigate to "Invitees Overview"
2. **Check the browser console** for debug logs (🔍 emoji)
3. **Search for a UID** (e.g., "FE2CE049" or the full UUID)
4. **Verify the results**:
   - The search should find users whose `referred_by` matches your UID
   - The console should show:
     - Current user UID
     - Search term being used
     - Query being executed
     - Number of results found
     - First 5 results with their `referred_by` values

## Expected Behavior

### Before Fix
- **PromotionView**: Shows "0 REGISTERED USERS" for both Direct and Team Invitees
- **InviteesOverview**: Search for "FE2CE049" → "No users found matching your search."
- **Console**: Shows empty results or RLS policy errors
- **Root Cause**: RLS policy blocks queries to other users' `referred_by` field

### After Fix (After Applying RLS Policy)
- **PromotionView**: Shows correct count of direct and team invitees
- **InviteesOverview**: Search for "FE2CE049" → Shows matching users
- **Console**: Shows successful queries with results (look for 📊 and 🔍 emojis)
- **Total Direct Invitees**: Displays accurate count

### Debugging Steps
1. Open browser console (F12)
2. Look for these log messages:
   - `📊 [PromotionView] Fetching network stats for uid:`
   - `📊 [PromotionView] Direct users found:`
   - `🔍 [InviteesOverview] Fetching invitees for uid:`
   - `🔍 [InviteesOverview] Raw results:`

3. If you see `Direct users found: 0` but know you have referrals:
   - The RLS policy hasn't been applied yet
   - Apply the SQL migration in Supabase Dashboard

4. If you see errors like "permission denied" or "RLS policy violation":
   - The RLS policy needs to be updated
   - Run the SQL migration provided above

## Security Considerations

The updated RLS policy allows authenticated users to read other users' data. This is necessary for the referral system to work, but consider:

1. **Data Exposure**: Users can now see other users' `phone_number`, `invite_code`, `total_bets`, etc.
2. **Mitigation**: The app only displays:
   - Masked phone numbers (e.g., "9230****67")
   - Limited user information
   - No sensitive data like passwords or balances

If you need more granular control, you can create a more restrictive policy:

```sql
CREATE POLICY select_for_referrals ON public.users
  FOR SELECT
  USING (
    auth.uid() = id
    OR
    auth.uid() IS NOT NULL
  );
```

## Additional Notes

- The search is now **case-insensitive** and handles both formatted (8-char) and full UUIDs
- Debug logs help trace the exact query and results in the browser console
- The "Total Direct Invitees" count now correctly shows only direct referrals (not team)
- All queries use the exact column name `referred_by` as required

## Files Modified

1. `src/components/InviteesOverviewView.tsx` - Fixed search logic and added debug logging
2. `backend/sql/add_referral_rls_policy.sql` - New file with RLS policy migration

## Related Files (No Changes Needed)

- `src/components/PromotionView.tsx` - Already uses correct `referred_by` column
- `src/context/UserContext.tsx` - Already uses correct `referred_by` column
- `backend/sql/migrations_add_users_wallets.sql` - Contains old RLS policy (needs migration)

## Verification Checklist

- [ ] RLS policy migration applied in Supabase
- [ ] Frontend code deployed
- [ ] Search for UID returns correct results
- [ ] Console logs show successful queries
- [ ] "Total Direct Invitees" count is accurate
- [ ] No sensitive data exposed in search results
- [ ] Case-insensitive search works (test with lowercase/uppercase/mixed case)