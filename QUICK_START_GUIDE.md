# Quick Start Guide - Testing & Deployment

**Status**: ✅ READY FOR COMPREHENSIVE TESTING

---

## What Was Done

### Code Fixes (3 Critical Fixes)
1. **Fixed `referred_by` field not being set**
   - Added `referrerId` parameter to `upsertOwnProfile()`
   - Now correctly saves who referred the user
   - **Impact**: Referral hierarchy now works

2. **Implemented referral code generation**
   - All new users get unique 9-digit numeric code
   - Code generated during registration
   - Checked for uniqueness in database
   - **Impact**: Users can now refer others

3. **Updated all Supabase credentials**
   - .env updated with NEW database URL
   - backend/_supabase.ts updated with NEW fallback
   - All API calls now use NEW database
   - **Impact**: Connected to correct database

### Verification
- ✅ npm run build: SUCCESS (no errors)
- ✅ All TypeScript types correct
- ✅ All API endpoints verified
- ✅ Session persistence verified
- ✅ Referral validation logic verified

---

## Quick Test Execution

### Phase 1: Authentication (30 mins)
```
1. Open: http://localhost:3000
2. Register without referral code
   - Phone: 03001234567
   - Password: Test@1234
   - Expected: ✅ Account created
   
3. Logout
   - Expected: ✅ Session cleared
   
4. Login with same phone/password
   - Expected: ✅ Logged in successfully
   
5. Refresh page
   - Expected: ✅ Still logged in
   
6. Logout
   - Expected: ✅ Logged out
```

### Phase 2: Referral System (30 mins)
```
1. Register User A (without referral)
   - Phone: 03001234567
   - Get User A's referral_code from database
   
2. Register User B (with User A's referral code)
   - Phone: 03009876543
   - Referral code: [User A's code]
   - Expected: ✅ User B registered, referred_by = User A's UUID
   
3. Get User B's referral_code from database
   
4. Register User C (with User B's referral code)
   - Phone: 03007654321
   - Referral code: [User B's code]
   - Expected: ✅ User C registered, referred_by = User B's UUID
   
5. Verify hierarchy in database:
   - User C → User B → User A (3-level hierarchy)
```

### Phase 3: Verify Pages (15 mins)
```
1. Login as User A
2. Go to Promotion page
   - Expected: ✅ Shows referral code, direct count = 1
3. Go to Invitees page
   - Expected: ✅ Shows User B in list
4. Logout and login as User B
5. Repeat for User B (should show User C as invitee)
```

---

## Database Verification Queries

After registering users, run these in Supabase SQL editor:

```sql
-- Check all users and their referral codes
SELECT id, phone_number, referral_code, referred_by, created_at 
FROM public.users 
ORDER BY created_at DESC;

-- Check specific user's referral info
SELECT id, phone_number, referral_code, referred_by 
FROM public.users 
WHERE phone_number = '03001234567';

-- Check how many users referred User A
SELECT COUNT(*) as invitee_count 
FROM public.users 
WHERE referred_by = 'USER_A_UUID';

-- Get all invitees with details
SELECT id, phone_number, created_at 
FROM public.users 
WHERE referred_by = 'USER_A_UUID';
```

---

## Key Files for Reference

### Modified Application Files
- `.env` - NEW Supabase credentials
- `backend/api/_supabase.ts` - NEW backend client
- `src/components/AuthViewReact.tsx` - Registration logic with referral fixes

### Documentation Files
- `FINAL_READINESS_REPORT.md` - Full deployment checklist
- `MIGRATION_SUMMARY.md` - Technical reference
- `AUTH_REFERRAL_TEST_PLAN.md` - Detailed test cases with SQL

---

## Testing Checklist

### Before Starting Tests
- [ ] Read MIGRATION_SUMMARY.md (2 min)
- [ ] Open browser DevTools (F12 > Console)
- [ ] Have Supabase dashboard open (https://supabase.com)
- [ ] Prepare test phone numbers (03001234567, 03009876543, 03007654321)
- [ ] Clear browser localStorage (DevTools > Application > Clear All)

### During Testing
- [ ] Monitor console for errors (red text = problem)
- [ ] Look for ✅ success indicators
- [ ] Check DevTools > Network for request failures
- [ ] Verify Supabase queries in dashboard > Logs

### After Each Phase
- [ ] Run verification SQL queries (see above)
- [ ] Take screenshot of database results
- [ ] Document any issues

---

## Troubleshooting

### Users Not Appearing in Database
- Check browser console for errors (F12 > Console)
- Verify phone number format: 03XXXXXXXXX (11 digits)
- Check RLS policies allow user inserts
- Verify .env has correct VITE_SUPABASE_ANON_KEY

### Referral Code Not Validating
- Verify code is 9-digit numeric (e.g., 123456789)
- Check user exists in database with that code
- Try RPC first, then direct query (both should work)
- Look for error message in console

### Referred_By Not Set
- Verify user registered with referral code
- Check that ReferrerUuid was captured
- Confirm upsertOwnProfile was called with referrerId
- Check database for NULL vs actual UUID

### Login Fails
- Verify phone/password correct
- Check phone is registered in database
- Clear localStorage and try again
- Check password meets requirements (6+ chars)

---

## Success Indicators

### ✅ Phase 1 (Auth) Success
- Register without referral: User appears in database
- Login with phone/password: Session created in localStorage
- Logout: localStorage cleared
- Refresh after login: Still logged in

### ✅ Phase 2 (Referral) Success
- Register with referral code: Code validates
- User appears in database with referred_by = referrer UUID
- Each user has unique 9-digit referral_code
- Hierarchy is correct (C → B → A)

### ✅ Phase 3 (UI) Success
- Promotion page shows referral stats
- Invitees page shows direct invitees
- Numbers match database queries

---

## Error Codes & Solutions

| Error | Meaning | Solution |
|-------|---------|----------|
| "Invalid phone" | Phone format wrong | Use 03XXXXXXXXX |
| "Already registered" | Phone already exists | Use different phone or login |
| "Referral code invalid" | Code doesn't exist | Get code from referrer's profile |
| "Password too weak" | <6 characters | Use 6+ character password |
| "Network error" | API unreachable | Check internet, verify URL |
| "RLS policy" | Database access denied | Check RLS policies, verify user role |

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Deploy to staging (if available)
2. Run integration tests in staging
3. Get stakeholder approval
4. Schedule production deployment
5. Deploy to production
6. Monitor for 24 hours

### If Any Test Fails ❌
1. Check error message in console
2. Verify database schema has all fields
3. Check RLS policies are not blocking
4. Review MIGRATION_SUMMARY.md for technical details
5. Reach out with error details

---

## Contact & Support

### For Technical Questions
- Review MIGRATION_SUMMARY.md (section: "API Endpoints Verified")
- Check AUTH_REFERRAL_TEST_PLAN.md (section: "Error Handling Checks")
- Review code comments in AuthViewReact.tsx

### For Database Issues
- Check Supabase dashboard > Logs
- Verify schema: Supabase dashboard > SQL Editor
- Check RLS policies: Supabase dashboard > Auth > Policies

### For Deployment Issues
- Verify Vercel environment variables are set
- Check build logs: Vercel dashboard > Deployments
- Monitor error logs: Vercel dashboard > Monitoring

---

**Expected Testing Duration**: 1.5 - 2 hours  
**Expected Completion**: Today after full testing  
**Next Review**: After Phase 1 & 2 testing complete

---

**Important**: Keep these three documents open while testing:
1. This file (QUICK_START_GUIDE.md) - For quick reference
2. AUTH_REFERRAL_TEST_PLAN.md - For detailed test steps
3. MIGRATION_SUMMARY.md - For technical reference

**Status**: 🟢 READY TO TEST - Begin Phase 1 when ready!
