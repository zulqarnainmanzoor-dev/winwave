# QUICK REFERENCE - DEPLOYMENT STEPS

## 🚀 DEPLOY IN 3 STEPS:

### STEP 1: Run SQL in Supabase (2 minutes)
```
1. Open Supabase SQL Editor
2. Copy entire content of: FIX_DEPOSIT_FLOW.sql
3. Run it
4. Verify: No errors
```

### STEP 2: Deploy Frontend (1 minute)
```
1. Build: npm run build
2. Deploy to Vercel/hosting
3. Clear browser cache
```

### STEP 3: Test (5 minutes)
```
1. Test deposit: Select amount → Pay Now → Should work
2. Test agent dashboard: Search UID → Should show data
3. Test commission: Should be 0.3% of deposit
4. Test VIP: Bet 62,500 → Should reach VIP 1
```

## 📋 FILES TO DEPLOY:

### SQL (Run in Supabase):
- `FIX_DEPOSIT_FLOW.sql` ← **RUN THIS FIRST**

### Frontend (Deploy):
- `src/components/DepositView.tsx`
- `src/components/InviteesOverviewView.tsx`
- `src/components/NewInviteesView.tsx`
- `src/admin/pages/AgentManagement.tsx`
- `src/context/UserContext.tsx`

## ✅ VERIFICATION:

After deployment, verify:
- [ ] Deposits work (no errors)
- [ ] Commission shows 0.3%
- [ ] Agent data displays correctly
- [ ] UIDs show numeric format
- [ ] VIP levels update

## 🔧 IF ISSUES:

**Deposit still failing?**
- Check Supabase logs
- Verify SQL was run
- Clear browser cache

**Agent data not showing?**
- Refresh page
- Check browser console
- Verify agent exists

**Commission wrong?**
- Check calculation: deposit × 0.003
- Verify RPC function exists

## 📞 SUPPORT:

All fixes are in:
- `DEPOSIT_FLOW_FIX_GUIDE.md` - Detailed deposit fix
- `FINAL_DEPLOYMENT_GUIDE.md` - Detailed agent fix
- `COMPLETE_FIX_SUMMARY.md` - Full summary

---

**Total Deployment Time: ~10 minutes**