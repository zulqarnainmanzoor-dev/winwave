════════════════════════════════════════════════════════════════════════════════
START HERE - QUICK START GUIDE
════════════════════════════════════════════════════════════════════════════════

WHAT WAS FIXED:
───────────────

✓ Commission now auto-credited to agent when member deposits
✓ Invitees Overview shows REAL deposit amounts (not zeros)
✓ Agent dashboard shows real member deposits and commission
✓ Commission calculated based on agent's VIP level

════════════════════════════════════════════════════════════════════════════════

WHAT YOU NEED TO DO:
────────────────────

STEP 1: Deploy SQL (5 minutes) - CRITICAL
──────────────────────────────────────────
1. Open: https://supabase.com/dashboard
2. Select your project
3. Click: SQL Editor
4. Click: New Query
5. Copy entire content from:
   backend/supabase/fix_deposit_commission_system.sql
6. Paste into SQL Editor
7. Click: Run
8. Wait for: "Query successful"

STEP 2: Deploy Frontend (5 minutes)
───────────────────────────────────
1. Open terminal
2. Run:
   git add .
   git commit -m "Fix: Commission and deposit system"
   git push origin main
3. Wait for Vercel deployment (check dashboard)

STEP 3: Test (10 minutes)
─────────────────────────
1. Create test deposit as member
2. Complete payment
3. Check agent's balance increased
4. Open Invitees Overview → should show real deposits
5. Open Agent Management → Analyze Fraud Network → should show commission

════════════════════════════════════════════════════════════════════════════════

FILES TO DEPLOY:
────────────────

SQL Script (MUST RUN FIRST):
  backend/supabase/fix_deposit_commission_system.sql

Frontend Files (AUTO-DEPLOY):
  src/components/InviteesOverviewView.tsx
  src/admin/pages/AgentManagement.tsx

════════════════════════════════════════════════════════════════════════════════

COMMISSION RATES:
─────────────────

VIP 0: 0.3%   | VIP 3: 0.4%   | VIP 6: 0.5%
VIP 1: 0.35%  | VIP 4: 0.425%
VIP 2: 0.375% | VIP 5: 0.45%

Example: Member deposits Rs 1000, Agent VIP 3
Commission = 1000 × 0.004 = Rs 4

════════════════════════════════════════════════════════════════════════════════

VERIFICATION:
──────────────

After deployment, run these in Supabase SQL Editor:

1. Check functions exist:
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name LIKE 'get_agent%';
   
   Expected: 2 rows

2. Check trigger exists:
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_name = 'trg_deposit_approved';
   
   Expected: 1 row

3. Check commission transactions:
   SELECT * FROM public.transactions 
   WHERE type = 'commission' 
   ORDER BY created_at DESC LIMIT 5;

════════════════════════════════════════════════════════════════════════════════

TROUBLESHOOTING:
────────────────

Problem: SQL functions not created
Solution: Check for errors in SQL output, try running again

Problem: Commission not showing
Solution: Check deposit_history.status = 'completed'

Problem: Deposits showing as zero
Solution: Check deposit_history has completed deposits

Problem: Frontend not updating
Solution: Clear browser cache, refresh page

════════════════════════════════════════════════════════════════════════════════

SUPPORT DOCUMENTS:
──────────────────

Read in this order:

1. VISUAL_SUMMARY.md - Visual overview
2. DEPLOYMENT_GUIDE.md - Step-by-step deployment
3. QUICK_ACTION_CHECKLIST.md - Deployment checklist
4. COMMISSION_DEPOSIT_FIX_COMPLETE.md - Technical details

════════════════════════════════════════════════════════════════════════════════

NEXT STEPS:
───────────

1. ✓ Read this file
2. ✓ Read DEPLOYMENT_GUIDE.md
3. ✓ Deploy SQL script
4. ✓ Deploy frontend
5. ✓ Test with real deposit
6. ✓ Verify everything works

════════════════════════════════════════════════════════════════════════════════

QUESTIONS?
──────────

Check:
- DEPLOYMENT_GUIDE.md for deployment steps
- COMMISSION_DEPOSIT_FIX_COMPLETE.md for technical details
- QUICK_ACTION_CHECKLIST.md for quick reference

════════════════════════════════════════════════════════════════════════════════
