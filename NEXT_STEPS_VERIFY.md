════════════════════════════════════════════════════════════════════════════════
NEXT STEPS - VERIFY AND FIX
════════════════════════════════════════════════════════════════════════════════

You have 4 deposits totaling Rs 3,600 in past 24 hours!

Now we need to verify:
1. Are these deposits linked to members?
2. Are the members linked to agents?
3. Is the RPC function returning correct data?

════════════════════════════════════════════════════════════════════════════════

STEP 1: Run verification query
───────────────────────────────

Open Supabase SQL Editor and run:

SELECT 
  u.referred_by as agent_id,
  COUNT(DISTINCT u.id) as member_count,
  COUNT(DISTINCT dh.id) as deposit_count,
  SUM(dh.amount) as total_deposit_amount
FROM public.users u
LEFT JOIN public.deposit_history dh ON u.id = dh.user_id AND dh.status = 'completed' AND dh.created_at >= NOW() - INTERVAL '24 hours'
WHERE u.referred_by IS NOT NULL
GROUP BY u.referred_by;

EXPECTED RESULT:
- Should show agent_id with member_count > 0 and deposit_count > 0

════════════════════════════════════════════════════════════════════════════════

STEP 2: Test RPC functions
──────────────────────────

Run these queries:

-- For Agent 1
SELECT * FROM public.get_subordinate_past_24h_stats('01fc7792-9b68-4dfd-9422-a1fb3706ba03'::uuid);

-- For Agent 2
SELECT * FROM public.get_subordinate_past_24h_stats('6e8f78a6-d098-42dc-be11-897781f6b624'::uuid);

EXPECTED RESULT:
- Should show deposit_count > 0 and deposit_amount > 0

════════════════════════════════════════════════════════════════════════════════

STEP 3: If RPC returns 0
────────────────────────

If the RPC function still returns 0, run this to see all members:

SELECT u.id, u.phone_number, u.referred_by
FROM public.users u
WHERE u.referred_by IS NOT NULL
ORDER BY u.created_at DESC;

This will show:
- Member IDs
- Their phone numbers
- Which agent they're referred by

════════════════════════════════════════════════════════════════════════════════

STEP 4: After verification
──────────────────────────

1. Refresh your browser
2. Open Invitees Overview
3. Click "Daily Report" tab
4. Should now show real data

If still showing 0:
1. Check browser console (F12) for errors
2. Make sure you're logged in as the correct agent
3. Try clearing browser cache

════════════════════════════════════════════════════════════════════════════════
