════════════════════════════════════════════════════════════════════════════════
COMPLETE FIX - REAL DEPOSIT DATA + DAILY COMMISSION CLAIMING
════════════════════════════════════════════════════════════════════════════════

WHAT WAS FIXED:
────────────────

✓ InviteesOverviewView - Shows REAL deposit amounts (past 24h) in subordinates list
✓ InviteesOverviewView - Shows REAL lifetime deposits in invitees list
✓ Commission Claiming - Only once per 24 hours (resets after 24h)
✓ Commission Claiming - Shows next claim time when already claimed today

════════════════════════════════════════════════════════════════════════════════

DEPLOYMENT (15 MINUTES):
────────────────────────

STEP 1: Deploy SQL Functions (5 min)
─────────────────────────────────────
1. Open Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy entire content from: backend/supabase/daily_commission_claim.sql
4. Paste and click "Run"
5. Verify 2 functions created:
   ✓ can_claim_commission_today
   ✓ claim_commission_daily

STEP 2: Update Frontend (10 min)
────────────────────────────────
1. Update src/components/InviteesOverviewView.tsx
   - Replace subordinates list display (use code from INVITEES_OVERVIEW_UPDATES.md)
   - Replace invitees card display (use code from INVITEES_OVERVIEW_UPDATES.md)

2. Update src/components/PromotionView.tsx
   - Replace handleClaimCommission function (use code from INVITEES_OVERVIEW_UPDATES.md)
   - Add nextClaimTime state and useEffect (use code from INVITEES_OVERVIEW_UPDATES.md)
   - Update claim button (use code from INVITEES_OVERVIEW_UPDATES.md)

STEP 3: Deploy Frontend (5 min)
───────────────────────────────
1. git add .
2. git commit -m "Fix: Real deposit data and daily commission claiming"
3. git push origin main
4. Wait for Vercel deployment

════════════════════════════════════════════════════════════════════════════════

WHAT EACH FUNCTION DOES:
─────────────────────────

1. can_claim_commission_today(p_agent_id UUID)
   Returns:
   - can_claim: TRUE if can claim, FALSE if already claimed in past 24h
   - last_claim_at: When last claim was made
   - next_claim_at: When next claim will be available
   - total_commission: Total unclaimed commission

2. claim_commission_daily(p_agent_id UUID)
   Returns:
   - success: TRUE if claimed, FALSE if error
   - message: Success or error message
   - new_balance: Updated main balance
   - claimed_amount: Amount claimed

════════════════════════════════════════════════════════════════════════════════

DAILY COMMISSION CLAIMING LOGIC:
─────────────────────────────────

1. Agent clicks "Claim Commission"
2. System checks: Has agent claimed in past 24 hours?
3. If YES:
   - Show: "You can only claim once per 24 hours. Next claim at: [TIME]"
   - Button disabled until 24 hours pass
4. If NO:
   - Claim all commission
   - Add to main_balance
   - Record claim transaction
   - Show: "Commission claimed! Rs [AMOUNT] added to wallet"
   - Button disabled for 24 hours

════════════════════════════════════════════════════════════════════════════════

REAL DEPOSIT DATA DISPLAY:
──────────────────────────

InviteesOverviewView - Subordinates Tab:
┌─────────────────────────────────────────────────────────────┐
│ UID | Level | Today Deposit (24h) | Commission | Registered │
├─────────────────────────────────────────────────────────────┤
│ ABC | 0     | Rs 5,000.00        | Rs 20.00   | Jul 7, 2026 │
│ DEF | 1     | Rs 2,500.00        | Rs 10.00   | Jul 6, 2026 │
│ GHI | 0     | Rs 0.00            | Rs 0.00    | Jul 5, 2026 │
└─────────────────────────────────────────────────────────────┘

InviteesOverviewView - Invitees Tab:
┌──────────────────────────────────────────────────┐
│ UID: ABC                    Phone: 3333256658    │
├──────────────────────────────────────────────────┤
│ Lifetime Deposit: Rs 15,000.00                   │
│ Total Bets: Rs 50,000.00                         │
│ Registered: Jul 7, 2026                          │
└──────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════════════════════

COMMISSION CLAIMING FLOW:
─────────────────────────

1. Agent opens PromotionView
2. System checks: can_claim_commission_today()
3. If can claim:
   - Button shows: "Claim Commission to Main Wallet"
   - Button enabled
4. If already claimed:
   - Button shows: "Next claim at 10:30 AM"
   - Button disabled
5. Agent clicks button
6. System calls: claim_commission_daily()
7. If success:
   - Show: "Commission claimed! Rs 1,000 added to wallet"
   - Update balance
   - Disable button for 24 hours
8. If error:
   - Show error message

════════════════════════════════════════════════════════════════════════════════

VERIFICATION:
──────────────

After deployment, test:

1. Test can_claim_commission_today:
   SELECT * FROM public.can_claim_commission_today('AGENT_UUID');

2. Test claim_commission_daily:
   SELECT * FROM public.claim_commission_daily('AGENT_UUID');

3. Check InviteesOverviewView:
   - Open Invitees Overview
   - Check subordinates show real deposit amounts
   - Check invitees show real lifetime deposits

4. Check Commission Claiming:
   - Open PromotionView
   - Click "Claim Commission"
   - Should claim successfully
   - Try clicking again - should show "Next claim at [TIME]"
   - Wait 24 hours or check database to verify

════════════════════════════════════════════════════════════════════════════════

TROUBLESHOOTING:
────────────────

Problem: "You can only claim once per 24 hours" appears immediately
Solution: Check transactions table for recent commission_claim records

Problem: Subordinates show Rs 0.00 deposit
Solution:
1. Check deposit_history has completed deposits in past 24h
2. Verify users.referred_by = agent_id
3. Check browser console for errors

Problem: Commission not claiming
Solution:
1. Check total commission > 0
2. Verify can_claim_commission_today returns can_claim = TRUE
3. Check user has main_balance field

Problem: Next claim time not showing
Solution:
1. Verify useEffect is running
2. Check can_claim_commission_today function returns next_claim_at
3. Check browser console for errors

════════════════════════════════════════════════════════════════════════════════

FILES INVOLVED:
────────────────

SQL:
  backend/supabase/daily_commission_claim.sql (NEW)

Frontend:
  src/components/InviteesOverviewView.tsx (MODIFIED)
  src/components/PromotionView.tsx (MODIFIED)

Documentation:
  INVITEES_OVERVIEW_UPDATES.md (Code snippets)

════════════════════════════════════════════════════════════════════════════════

NEXT STEPS:
───────────

1. Deploy SQL functions
2. Update InviteesOverviewView.tsx
3. Update PromotionView.tsx
4. Deploy frontend
5. Test all features
6. Verify real data displays correctly
7. Verify commission claiming works with 24h limit

════════════════════════════════════════════════════════════════════════════════
