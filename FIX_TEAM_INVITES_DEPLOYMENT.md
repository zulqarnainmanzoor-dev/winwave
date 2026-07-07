════════════════════════════════════════════════════════════════════════════════
FIX - TEAM INVITES SHOWING WRONG DEPOSIT AMOUNT
════════════════════════════════════════════════════════════════════════════════

PROBLEM:
─────────
Team Invites showing Rs 2,000 (wrong)
Should show Rs 3,600 (correct - past 24 hours total)

ROOT CAUSE:
────────────
The get_team_invites_past_24h() function was including direct members
Should ONLY include 2+ level members (team members, not direct)

SOLUTION:
──────────
Deploy corrected functions that properly separate:
- Direct Invites: Only level 1 members
- Team Invites: Only level 2+ members (not direct)

════════════════════════════════════════════════════════════════════════════════

DEPLOYMENT STEPS:
──────────────────

STEP 1: Open Supabase SQL Editor
─────────────────────────────────
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Click "New Query"

STEP 2: Deploy Fixed Functions
───────────────────────────────
1. Copy entire content from: FIX_PAST_24H_FUNCTIONS.sql
2. Paste into SQL editor
3. Click "Run"
4. Wait for "Query successful"

This will:
- Drop old functions
- Create corrected get_direct_invites_past_24h()
- Create corrected get_team_invites_past_24h()
- Test both functions

STEP 3: Verify Functions Work
──────────────────────────────

The SQL file includes test queries at the end.
You should see results like:

Direct Invites: deposit_amount = [some amount]
Team Invites: deposit_amount = [some amount]

STEP 4: Refresh Browser
────────────────────────
1. Refresh your browser
2. Open PromotionView
3. Check carousel:
   - Direct Invites should show correct amount
   - Team Invites should show correct amount

════════════════════════════════════════════════════════════════════════════════

WHAT CHANGED:
──────────────

OLD LOGIC (WRONG):
- Direct Invites: Level 1 members
- Team Invites: Level 1 + Level 2+ members (WRONG - includes direct)

NEW LOGIC (CORRECT):
- Direct Invites: Level 1 members ONLY
- Team Invites: Level 2+ members ONLY (excludes direct)

════════════════════════════════════════════════════════════════════════════════

EXPECTED RESULTS:
──────────────────

After deployment:

PromotionView Carousel:
- Direct Invites: Rs 3,600 (or correct amount for direct members)
- Team Invites: Rs 0 (if no 2+ level members) or correct amount

════════════════════════════════════════════════════════════════════════════════

IF STILL WRONG:
────────────────

1. Check browser console (F12) for errors
2. Make sure you're logged in as correct agent
3. Try clearing browser cache and refresh
4. Run test queries manually:

SELECT * FROM public.get_direct_invites_past_24h('YOUR_AGENT_ID'::uuid);
SELECT * FROM public.get_team_invites_past_24h('YOUR_AGENT_ID'::uuid);

════════════════════════════════════════════════════════════════════════════════
