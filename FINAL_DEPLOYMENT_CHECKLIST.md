# ✅ Final Deployment Checklist

## Pre-Deployment (Do This First)

- [ ] Read QUICK_REFERENCE.md (5 minutes)
- [ ] Read ACTION_ITEMS_DATABASE_PROMOTION_FIX.md (10 minutes)
- [ ] Backup production database
- [ ] Test in staging environment first
- [ ] Notify team of deployment
- [ ] Schedule deployment window
- [ ] Have rollback plan ready

---

## Phase 1: Database Migrations (CRITICAL - Do First)

### Migration 1: Deposit/Withdrawal Fields
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Copy `backend/supabase/migration_deposit_withdrawal_fields.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify no errors
- [ ] Check new columns exist:
  - [ ] `deposit_history.merchant_order_id`
  - [ ] `deposit_history.pkpay_transaction_id`
  - [ ] `deposit_history.callback_status`
  - [ ] `deposit_history.callback_time`
  - [ ] `deposit_history.gateway_response`
  - [ ] `deposit_history.payment_gateway`
  - [ ] `withdrawal_history.merchant_order_id`
  - [ ] `withdrawal_history.pkpay_transaction_id`
  - [ ] `withdrawal_history.callback_status`
  - [ ] `withdrawal_history.callback_time`
  - [ ] `withdrawal_history.gateway_response`
  - [ ] `withdrawal_history.payment_gateway`

### Migration 2: RPC Functions
- [ ] Copy `backend/supabase/migration_rpc_functions.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify no errors
- [ ] **WAIT 1-2 MINUTES** for schema cache update
- [ ] Check functions exist:
  - [ ] `get_commission_history()`
  - [ ] `get_invitees_with_uids()`
  - [ ] `search_invitees()`
  - [ ] `get_partner_rewards_stats()`
  - [ ] `claim_commission()`

### Verification
- [ ] Refresh Supabase Dashboard
- [ ] Go to Functions section
- [ ] Verify all 5 new functions appear
- [ ] Click each function to verify parameters
- [ ] Check GRANT EXECUTE is set to authenticated

---

## Phase 2: Deploy Admin Components

### DepositRequestDetails Component
- [ ] Copy `src/admin/pages/DepositRequestDetails.tsx`
- [ ] Deploy to production
- [ ] Verify file exists in correct location
- [ ] Check no build errors

### WithdrawalRequestDetails Component
- [ ] Copy `src/admin/pages/WithdrawalRequestDetails.tsx`
- [ ] Deploy to production
- [ ] Verify file exists in correct location
- [ ] Check no build errors

### Verification
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Components load without errors

---

## Phase 3: Update Promotion Module Components

### InviteesOverviewView
- [ ] Update search to query both `referral_code` AND `phone_number`
- [ ] Update search placeholder to "Search by UID or Phone Number"
- [ ] Display real UIDs from `referral_code`
- [ ] Remove generated short ID display
- [ ] Deploy to production
- [ ] Verify no build errors

### CommissionDetailsView
- [ ] Load real commission data from `transactions` table
- [ ] Display member UID from `referral_code`
- [ ] Show deposit amount from `deposit_history`
- [ ] Show commission percentage and amount
- [ ] Show claim status
- [ ] Show created_at timestamp
- [ ] Deploy to production
- [ ] Verify no build errors

### PartnerRewards
- [ ] Calculate `invitation_count` = COUNT(referred_by = current_user)
- [ ] Calculate `effective_invitation_count` = COUNT(members with deposits > 0)
- [ ] Calculate `invitation_total_bonus` = SUM(commission_history.amount)
- [ ] Remove static values
- [ ] Use real production data
- [ ] Deploy to production
- [ ] Verify no build errors

### PromotionView
- [ ] Update search placeholder to "Search by UID or Phone Number"
- [ ] Fix search to query both `referral_code` and `phone_number`
- [ ] Display real UIDs from `referral_code`
- [ ] Calculate real statistics from database
- [ ] Remove hardcoded/generated values
- [ ] Deploy to production
- [ ] Verify no build errors

### Verification
- [ ] All 4 components deploy successfully
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No console errors

---

## Phase 4: Testing

### Test Deposit Details
- [ ] Go to Admin → Deposits
- [ ] Click on a deposit
- [ ] Verify Order ID displays correctly
- [ ] Verify Account Number displays correctly
- [ ] Verify no mixing of fields
- [ ] Test copy buttons work
- [ ] Expand PKPay metadata
- [ ] Verify JSON displays correctly

### Test Withdrawal Details
- [ ] Go to Admin → Withdrawals
- [ ] Click on a withdrawal
- [ ] Verify Account Name displays correctly
- [ ] Verify Account Number displays correctly
- [ ] Verify Order ID displays correctly
- [ ] Verify no mixing of fields
- [ ] Test copy buttons work
- [ ] Expand gateway response
- [ ] Verify JSON displays correctly

### Test Invitees Search
- [ ] Go to Promotion → Invitees Overview
- [ ] Search by UID (e.g., 162334511)
- [ ] Verify results show matching invitees
- [ ] Search by phone (e.g., 03001234567)
- [ ] Verify results show matching invitees
- [ ] Verify UIDs display as 9-digit numbers
- [ ] Verify no generated IDs display

### Test Commission Details
- [ ] Go to Promotion → Commission Details
- [ ] Verify real commission records load
- [ ] Check member UIDs display correctly
- [ ] Verify deposit amounts show
- [ ] Check commission percentages
- [ ] Verify claim status
- [ ] Verify timestamps display

### Test Partner Rewards
- [ ] Go to Promotion → Partner Rewards
- [ ] Verify invitation count shows real number
- [ ] Verify effective count shows real number
- [ ] Verify total bonus shows real amount
- [ ] Check all values are from database
- [ ] Verify no static values

### Test Commission Claim
- [ ] Go to Promotion → Claim Commission
- [ ] Click claim button
- [ ] Verify commission credited
- [ ] Try to claim again immediately
- [ ] Verify duplicate claim prevented
- [ ] Wait until next day
- [ ] Verify can claim again

### Verification
- [ ] All tests pass
- [ ] No errors in console
- [ ] All data displays correctly
- [ ] Search works properly
- [ ] Duplicate prevention works
- [ ] No "function does not exist" errors

---

## Phase 5: Post-Deployment

### Monitoring
- [ ] Monitor error logs for 1 hour
- [ ] Check user feedback
- [ ] Monitor database performance
- [ ] Check API response times
- [ ] Verify no data corruption

### Documentation
- [ ] Update deployment log
- [ ] Document any issues encountered
- [ ] Document resolution steps
- [ ] Update team wiki/docs
- [ ] Notify stakeholders of completion

### Rollback Plan (If Needed)
- [ ] Restore database backup
- [ ] Revert component deployments
- [ ] Clear browser cache
- [ ] Restart application
- [ ] Verify rollback successful

---

## Troubleshooting During Deployment

### If Migration Fails
- [ ] Check SQL syntax
- [ ] Verify table names are correct
- [ ] Check column names are correct
- [ ] Verify no duplicate columns
- [ ] Check database permissions
- [ ] Try running migration again

### If Functions Don't Appear
- [ ] Verify migration ran successfully
- [ ] Wait 1-2 minutes for schema cache
- [ ] Refresh Supabase Dashboard
- [ ] Check function names in SQL
- [ ] Verify GRANT EXECUTE is set
- [ ] Try running migration again

### If Components Don't Deploy
- [ ] Check for TypeScript errors
- [ ] Verify file paths are correct
- [ ] Check for import errors
- [ ] Verify no syntax errors
- [ ] Check build logs
- [ ] Try deploying again

### If Tests Fail
- [ ] Check browser console for errors
- [ ] Verify database has test data
- [ ] Check RPC functions exist
- [ ] Verify component code is correct
- [ ] Check network requests in DevTools
- [ ] Review error messages carefully

---

## Success Criteria

After deployment, verify ALL of these:

- [ ] No "function does not exist" errors
- [ ] Deposit details display all fields correctly
- [ ] Withdrawal details display all fields correctly
- [ ] Order IDs not mixed with Account Numbers
- [ ] Account Numbers show actual accounts
- [ ] Search works for UID
- [ ] Search works for phone number
- [ ] Commission data loads from database
- [ ] Invitees show real UIDs (9-digit numbers)
- [ ] Partner rewards show real statistics
- [ ] No duplicate commission claims
- [ ] All data is from production database
- [ ] No hardcoded or generated values
- [ ] No console errors
- [ ] No build errors
- [ ] All tests pass

---

## Sign-Off

### Deployment Team
- [ ] Deployed by: _________________ Date: _______
- [ ] Tested by: _________________ Date: _______
- [ ] Approved by: _________________ Date: _______

### Verification
- [ ] All phases completed
- [ ] All tests passed
- [ ] All success criteria met
- [ ] No issues encountered
- [ ] Ready for production

---

## Notes

```
Deployment Date: _________________
Deployment Time: _________________
Duration: _________________
Issues Encountered: _________________
Resolution: _________________
Additional Notes: _________________
```

---

## Quick Reference During Deployment

### Database Migrations
```
File 1: backend/supabase/migration_deposit_withdrawal_fields.sql
File 2: backend/supabase/migration_rpc_functions.sql
Wait: 1-2 minutes after deploying File 2
```

### Admin Components
```
File 1: src/admin/pages/DepositRequestDetails.tsx
File 2: src/admin/pages/WithdrawalRequestDetails.tsx
```

### Promotion Module
```
File 1: src/components/InviteesOverviewView.tsx
File 2: src/components/CommissionDetailsView.tsx
File 3: src/components/PartnerRewards.tsx
File 4: src/components/PromotionView.tsx
```

### Testing
```
Test 1: Deposit Details
Test 2: Withdrawal Details
Test 3: Invitees Search
Test 4: Commission Details
Test 5: Partner Rewards
Test 6: Commission Claim
```

---

## Emergency Contacts

- **Database Admin**: _________________ Phone: _______
- **DevOps**: _________________ Phone: _______
- **Project Manager**: _________________ Phone: _______
- **Support**: _________________ Phone: _______

---

## Rollback Procedure

If deployment fails:

1. Stop deployment immediately
2. Contact database admin
3. Restore database backup
4. Revert component deployments
5. Clear browser cache
6. Restart application
7. Verify rollback successful
8. Document issue
9. Plan remediation

---

**Deployment Checklist Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for Use

---

## ✅ Ready to Deploy?

Before starting deployment, verify:

- [ ] All team members notified
- [ ] Backup created
- [ ] Staging tested
- [ ] Rollback plan ready
- [ ] This checklist printed/available
- [ ] All documentation reviewed
- [ ] Emergency contacts available

**If all checked, you're ready to deploy!** 🚀
