════════════════════════════════════════════════════════════════════════════════
QUICK ACTION CHECKLIST - COMMISSION & DEPOSIT FIX
════════════════════════════════════════════════════════════════════════════════

STEP 1: DEPLOY SQL FUNCTIONS (5 minutes)
─────────────────────────────────────────
□ Open Supabase Dashboard
□ Go to SQL Editor
□ Copy all content from: backend/supabase/fix_deposit_commission_system.sql
□ Paste into SQL Editor
□ Click "Run" button
□ Verify no errors (should see "Query successful")
□ Check functions created:
  - fn_on_deposit_approved (trigger function)
  - get_agent_member_deposits (RPC)
  - get_agent_total_commission (RPC)

STEP 2: VERIFY FRONTEND FILES UPDATED (2 minutes)
──────────────────────────────────────────────────
□ Check src/components/InviteesOverviewView.tsx is updated
□ Check src/admin/pages/AgentManagement.tsx is updated
□ Verify no syntax errors in IDE

STEP 3: DEPLOY TO PRODUCTION (5 minutes)
─────────────────────────────────────────
□ Commit changes:
  git add .
  git commit -m "Fix: Commission and deposit system - auto-credit agent on member deposit"
□ Push to main branch:
  git push origin main
□ Wait for Vercel deployment to complete
□ Check deployment status in Vercel dashboard

STEP 4: TEST THE FIX (10 minutes)
─────────────────────────────────
□ Create test account as member
□ Initiate deposit (Rs 100 or more)
□ Complete payment via PKPay
□ Check member's main_balance increased
□ Check agent's main_balance increased by commission
□ Open Invitees Overview → should show real deposit data
□ Open Agent Management → Analyze Fraud Network → should show member deposits

STEP 5: VERIFY DATA (5 minutes)
───────────────────────────────
□ Check database:
  SELECT * FROM public.transactions 
  WHERE type = 'commission' 
  ORDER BY created_at DESC LIMIT 5;
  
□ Should see commission records with:
  - user_id = agent's UUID
  - type = 'commission'
  - amount = deposit × commission_rate
  - gateway_ref = 'Deposit commission from member...'

STEP 6: COMMUNICATE TO AGENTS (2 minutes)
──────────────────────────────────────────
□ Send message: "Commission system fixed! Deposits now auto-credit your account"
□ Explain: "When your members deposit, you get commission instantly"
□ Direct to: Invitees Overview to see member deposits

════════════════════════════════════════════════════════════════════════════════

WHAT WAS FIXED:
───────────────

✓ Commission Auto-Credit:
  When member deposits → Agent's balance automatically increases by commission
  
✓ Member Deposit Display:
  Invitees Overview now shows REAL deposit amounts (not zeros)
  
✓ Agent Dashboard:
  Analyze Fraud Network shows real member deposits and commission earned
  
✓ Commission Calculation:
  Based on agent's VIP level (0.3% to 0.5%)

════════════════════════════════════════════════════════════════════════════════

ROLLBACK PLAN (if needed):
──────────────────────────

If something goes wrong:

1. Revert SQL:
   - Open Supabase SQL Editor
   - Run: DROP TRIGGER IF EXISTS trg_deposit_approved ON public.deposit_history;
   - Run: DROP FUNCTION IF EXISTS public.fn_on_deposit_approved();
   - Run: DROP FUNCTION IF EXISTS public.get_agent_member_deposits(UUID);
   - Run: DROP FUNCTION IF EXISTS public.get_agent_total_commission(UUID);

2. Revert Frontend:
   - git revert HEAD
   - git push origin main
   - Wait for Vercel redeploy

════════════════════════════════════════════════════════════════════════════════

EXPECTED RESULTS AFTER FIX:
───────────────────────────

1. Member deposits Rs 1000
   ↓
   Agent's balance increases by Rs 4 (0.4% commission for VIP L3)
   
2. Agent opens Invitees Overview
   ↓
   Shows all members with real deposit amounts
   
3. Agent opens Agent Management → Analyze Fraud Network
   ↓
   Shows total commission earned and member deposits
   
4. Agent checks transactions table
   ↓
   Sees commission records for each member deposit

════════════════════════════════════════════════════════════════════════════════
