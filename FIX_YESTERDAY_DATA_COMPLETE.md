════════════════════════════════════════════════════════════════════════════════
FIX - SHOW YESTERDAY'S DATA AND SUBORDINATE LIST
════════════════════════════════════════════════════════════════════════════════

PROBLEMS:
──────────
1. Showing TODAY's data (Tuesday) instead of YESTERDAY's (Monday)
2. Subordinate list not showing members at localhost

SOLUTION:
──────────
1. Update SQL function to show yesterday's data
2. Update fetchSubordinates to fetch yesterday's deposits
3. Update table header label

════════════════════════════════════════════════════════════════════════════════

STEP 1: Deploy SQL Function (Show Yesterday's Data)
─────────────────────────────────────────────────────

1. Open Supabase SQL Editor
2. Copy entire content from: FIX_SHOW_YESTERDAY_DATA.sql
3. Paste and click "Run"
4. Wait for "Query successful"

This will:
- Update get_subordinate_past_24h_stats() to show YESTERDAY's data
- Calculate yesterday's date range (00:00 to 23:59 UTC)
- Return deposits from yesterday only

════════════════════════════════════════════════════════════════════════════════

STEP 2: Update Frontend - InviteesOverviewView.tsx
────────────────────────────────────────────────────

1. Open: src/components/InviteesOverviewView.tsx

2. Find the fetchSubordinates function (around line 80-130)

3. Replace the ENTIRE fetchSubordinates function with code from:
   FIX_SUBORDINATES_DISPLAY.md

4. Also update the table header:
   Find: <span className="text-center">Today Deposit</span>
   Replace with: <span className="text-center">Yesterday Deposit</span>

5. Save file

════════════════════════════════════════════════════════════════════════════════

STEP 3: Refresh Browser
────────────────────────

1. Refresh your browser
2. Open Invitees Overview
3. Click "Daily Report" tab
4. Should now show:
   - Yesterday's deposit amount (Monday's data)
   - All subordinate members in the list
   - Correct deposit amounts for each member

════════════════════════════════════════════════════════════════════════════════

WHAT CHANGED:
──────────────

OLD:
- Showed TODAY's data (Tuesday)
- Subordinates not displaying

NEW:
- Shows YESTERDAY's data (Monday)
- Subordinates display correctly
- Table header says "Yesterday Deposit"
- Fetches deposits from yesterday's date range only

════════════════════════════════════════════════════════════════════════════════

DATE LOGIC:
────────────

Yesterday's date range:
- Start: 00:00 UTC yesterday
- End: 00:00 UTC today

Example (if today is Tuesday):
- Shows: Monday 00:00 to Monday 23:59
- Does NOT show: Tuesday's data

════════════════════════════════════════════════════════════════════════════════

VERIFICATION:
──────────────

After deployment, verify:

1. Invitees Overview shows yesterday's data
2. Subordinate list shows all members
3. Each member shows their yesterday's deposit amount
4. Table header says "Yesterday Deposit"

If still showing 0:
1. Check browser console (F12) for errors
2. Make sure you're logged in as correct agent
3. Try clearing browser cache and refresh

════════════════════════════════════════════════════════════════════════════════
