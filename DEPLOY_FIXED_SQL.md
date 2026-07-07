════════════════════════════════════════════════════════════════════════════════
DEPLOY FIXED SQL - PAST 24 HOURS DEPOSIT DATA
════════════════════════════════════════════════════════════════════════════════

WHAT WAS FIXED:
────────────────

✓ Fixed syntax error in get_team_invites_past_24h function
✓ Added get_subordinate_past_24h_stats function for agent dashboard
✓ All 4 functions now work correctly

════════════════════════════════════════════════════════════════════════════════

DEPLOYMENT (5 MINUTES):
───────────────────────

1. Open Supabase Dashboard
   https://supabase.com/dashboard

2. Select your project

3. Go to SQL Editor

4. Click "New Query"

5. Copy ENTIRE content from:
   backend/supabase/past_24h_deposit_stats_FIXED.sql

6. Paste into SQL Editor

7. Click "Run" button

8. Wait for "Query successful" message

9. Verify 4 functions created:
   ✓ get_direct_invites_past_24h
   ✓ get_team_invites_past_24h
   ✓ get_subordinate_past_24h_stats
   ✓ get_agent_invited_members

════════════════════════════════════════════════════════════════════════════════

FUNCTIONS CREATED:
──────────────────

1. get_direct_invites_past_24h(p_agent_id UUID)
   Returns: deposit_users, deposit_amount, first_deposit_users, first_deposit_amount
   Purpose: Direct invites past 24h stats

2. get_team_invites_past_24h(p_agent_id UUID)
   Returns: Same as above
   Purpose: Team invites (2+ levels) past 24h stats

3. get_subordinate_past_24h_stats(p_agent_id UUID)
   Returns: deposit_count, deposit_amount, deposit_users, first_deposit_users, first_deposit_amount, total_bet
   Purpose: Agent dashboard subordinate stats for past 24h

4. get_agent_invited_members(p_agent_id UUID)
   Returns: member_id, member_phone, member_uid, lifetime_deposit, today_deposit, total_bets, joined_at
   Purpose: Show real member deposits in AgentManagement

════════════════════════════════════════════════════════════════════════════════

VERIFICATION:
──────────────

After running SQL, test each function:

1. Test Direct Invites:
   SELECT * FROM public.get_direct_invites_past_24h('YOUR_AGENT_UUID');

2. Test Team Invites:
   SELECT * FROM public.get_team_invites_past_24h('YOUR_AGENT_UUID');

3. Test Subordinate Stats:
   SELECT * FROM public.get_subordinate_past_24h_stats('YOUR_AGENT_UUID');

4. Test Invited Members:
   SELECT * FROM public.get_agent_invited_members('YOUR_AGENT_UUID');

All should return data without errors.

════════════════════════════════════════════════════════════════════════════════

NEXT STEPS:
───────────

After SQL is deployed:

1. Update PromotionView.tsx
   - Use get_direct_invites_past_24h()
   - Use get_team_invites_past_24h()

2. Update InviteesOverviewView.tsx
   - Use get_subordinate_past_24h_stats()

3. Update AgentManagement.tsx
   - Use get_agent_invited_members()

4. Deploy frontend

════════════════════════════════════════════════════════════════════════════════

TROUBLESHOOTING:
────────────────

Error: "syntax error at or near RETURN"
Solution: Use the FIXED version (past_24h_deposit_stats_FIXED.sql)

Error: "function does not exist"
Solution: Make sure SQL ran successfully, check for errors

Error: "permission denied"
Solution: Make sure you're using service_role or admin account

════════════════════════════════════════════════════════════════════════════════
