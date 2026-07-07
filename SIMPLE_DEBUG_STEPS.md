════════════════════════════════════════════════════════════════════════════════
SIMPLE DEBUG GUIDE - STEP BY STEP
════════════════════════════════════════════════════════════════════════════════

STEP 1: Get Your Agent ID
──────────────────────────

1. Open Supabase SQL Editor
2. Run this query:

SELECT id, phone_number, referred_by
FROM public.users
WHERE referred_by IS NULL
LIMIT 5;

RESULT:
- You should see your account (referred_by = NULL)
- Copy the "id" value - this is YOUR_AGENT_ID

════════════════════════════════════════════════════════════════════════════════

STEP 2: Check if you have members
──────────────────────────────────

1. Run this query (replace YOUR_AGENT_ID):

SELECT COUNT(*) as your_member_count
FROM public.users
WHERE referred_by = 'YOUR_AGENT_ID'::uuid;

RESULT:
- If shows 0 → You have NO members yet
- If shows > 0 → You have members

════════════════════════════════════════════════════════════════════════════════

STEP 3: Check if members have deposits
───────────────────────────────────────

1. Run this query (replace YOUR_AGENT_ID):

SELECT dh.user_id, dh.amount, dh.status, dh.created_at
FROM public.deposit_history dh
JOIN public.users u ON dh.user_id = u.id
WHERE u.referred_by = 'YOUR_AGENT_ID'::uuid
AND dh.status = 'completed'
AND dh.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY dh.created_at DESC;

RESULT:
- If shows 0 rows → No deposits in past 24 hours
- If shows rows → Members have deposits

════════════════════════════════════════════════════════════════════════════════

STEP 4: Test the RPC function
──────────────────────────────

1. Run this query (replace YOUR_AGENT_ID):

SELECT * FROM public.get_subordinate_past_24h_stats('YOUR_AGENT_ID'::uuid);

RESULT:
- Should show: deposit_count, deposit_amount, deposit_users, etc.
- If all 0 → Check Step 2 and 3 results

════════════════════════════════════════════════════════════════════════════════

WHAT THE RESULTS MEAN:
───────────────────────

Scenario 1: All showing 0
→ You have NO members or NO deposits
→ This is NORMAL if you just started
→ Need to invite members and they need to deposit

Scenario 2: Members > 0 but deposits = 0
→ You have members but they haven't deposited yet
→ Ask them to make a deposit

Scenario 3: Members > 0 and deposits > 0
→ Everything is working!
→ Refresh browser and check Invitees Overview

════════════════════════════════════════════════════════════════════════════════

IF EVERYTHING SHOWS 0:
──────────────────────

This is NORMAL if:
1. You just created your account
2. You haven't invited any members yet
3. Your members haven't made deposits yet

TO TEST:
1. Create a test member account
2. Register with your referral code
3. Make a deposit
4. Run the queries again
5. Should now show real data

════════════════════════════════════════════════════════════════════════════════

AFTER CONFIRMING DATA EXISTS:
──────────────────────────────

1. Refresh your browser
2. Open Invitees Overview
3. Click "Daily Report" tab
4. Should now show real data

If still showing 0:
1. Check browser console for errors (F12)
2. Make sure you're logged in as the correct user
3. Try clearing browser cache and refresh

════════════════════════════════════════════════════════════════════════════════
