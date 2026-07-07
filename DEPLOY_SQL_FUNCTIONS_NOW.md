════════════════════════════════════════════════════════════════════════════════
DEPLOY MISSING SQL FUNCTIONS - STEP BY STEP
════════════════════════════════════════════════════════════════════════════════

ERROR YOU'RE SEEING:
────────────────────
"function public.get_subordinate_past_24h_stats(unknown) does not exist"

REASON:
────────
The SQL functions haven't been deployed to Supabase yet!

SOLUTION:
──────────
Deploy the SQL file to create the functions.

════════════════════════════════════════════════════════════════════════════════

STEP-BY-STEP DEPLOYMENT:
─────────────────────────

STEP 1: Open Supabase Dashboard
─────────────────────────────────
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar

STEP 2: Create New Query
─────────────────────────
1. Click "New Query" button
2. You'll see a blank SQL editor

STEP 3: Copy SQL Code
──────────────────────
Copy the ENTIRE content from this file:
  backend/supabase/daily_commission_claim.sql

STEP 4: Paste into SQL Editor
───────────────────────────────
1. Paste the SQL code into the editor
2. You should see the SQL code in the editor

STEP 5: Run the Query
──────────────────────
1. Click the "Run" button (or press Ctrl+Enter)
2. Wait for the query to complete
3. You should see: "Query successful"

STEP 6: Verify Functions Created
──────────────────────────────────
Run this query to verify:

SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'get_subordinate_past_24h_stats',
  'can_claim_commission_today',
  'claim_commission_daily'
);

You should see 3 rows:
- get_subordinate_past_24h_stats
- can_claim_commission_today
- claim_commission_daily

════════════════════════════════════════════════════════════════════════════════

WHAT'S IN THE SQL FILE:
────────────────────────

backend/supabase/daily_commission_claim.sql contains:

1. get_subordinate_past_24h_stats(p_agent_id UUID)
   - Returns past 24 hours deposit stats
   - Used by InviteesOverviewView

2. can_claim_commission_today(p_agent_id UUID)
   - Checks if agent can claim commission today
   - Returns: can_claim, last_claim_at, next_claim_at, total_commission

3. claim_commission_daily(p_agent_id UUID)
   - Claims commission (only once per 24h)
   - Returns: success, message, new_balance, claimed_amount

════════════════════════════════════════════════════════════════════════════════

AFTER DEPLOYMENT:
──────────────────

1. Refresh your browser
2. Open Invitees Overview
3. Should now show members in Daily Report tab
4. Stats card should load with real data

════════════════════════════════════════════════════════════════════════════════

TESTING THE FUNCTIONS:
───────────────────────

After deployment, test each function:

1. Test get_subordinate_past_24h_stats:
   SELECT * FROM public.get_subordinate_past_24h_stats('YOUR_AGENT_UUID'::uuid);
   
   (Replace YOUR_AGENT_UUID with actual UUID)

2. Test can_claim_commission_today:
   SELECT * FROM public.can_claim_commission_today('YOUR_AGENT_UUID'::uuid);

3. Test claim_commission_daily:
   SELECT * FROM public.claim_commission_daily('YOUR_AGENT_UUID'::uuid);

════════════════════════════════════════════════════════════════════════════════

HOW TO GET YOUR AGENT UUID:
────────────────────────────

1. Open Supabase Dashboard
2. Go to "SQL Editor"
3. Run this query:
   SELECT id, phone_number FROM public.users LIMIT 1;
4. Copy the UUID from the "id" column
5. Use it in the test queries above

════════════════════════════════════════════════════════════════════════════════

TROUBLESHOOTING:
─────────────────

Problem: "Query successful" but functions still don't exist
Solution: 
1. Refresh the page
2. Try running the verification query again
3. Check for any error messages in the SQL output

Problem: Syntax error in SQL
Solution:
1. Make sure you copied the ENTIRE file
2. Check for any missing lines
3. Try running the file again

Problem: Permission denied
Solution:
1. Make sure you're logged in as admin/owner
2. Check your Supabase project permissions

════════════════════════════════════════════════════════════════════════════════

NEXT STEPS:
────────────

1. Deploy the SQL file (follow steps above)
2. Verify functions created
3. Refresh browser
4. Test Invitees Overview - should now show members
5. Test commission claiming - should work with 24h limit

════════════════════════════════════════════════════════════════════════════════
