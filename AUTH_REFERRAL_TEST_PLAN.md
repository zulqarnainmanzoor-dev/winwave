# Authentication & Referral System - Complete Test Plan
**New Database**: https://stsemiuoqwfowgbbnjhu.supabase.co  
**Status**: Ready for Testing  
**Date**: July 5, 2026

---

## PHASE 1: AUTHENTICATION TESTING

### Test 1.1: Register Without Referral Code
**Steps:**
1. Open the application
2. Click "Register" 
3. Enter phone: 03001234567
4. Enter password: Test@123
5. Enter confirm password: Test@123
6. Leave invitation code empty
7. Click "Create account"

**Expected Results:**
- ✅ User account created in auth.users
- ✅ User record created in public.users with:
  - phone_number = 03001234567 (normalized to 3001234567)
  - referral_code = 9-digit numeric code (auto-generated)
  - referred_by = NULL (no referrer)
  - inviter_code = NULL
- ✅ Success message displayed
- ✅ User redirected to home page
- ✅ Session saved to localStorage

**Verification Queries:**
```sql
-- In Supabase SQL Editor:
SELECT id, phone_number, referral_code, referred_by, inviter_code, created_at 
FROM public.users 
WHERE phone_number LIKE '3001234567%' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check browser localStorage:
// Console: JSON.parse(localStorage.getItem('winwave_user_session'))
```

---

### Test 1.2: Login with Registered Phone
**Steps:**
1. Refresh page or logout
2. Click "Login"
3. Enter phone: 03001234567
4. Enter password: Test@123
5. Check "Remember me"
6. Click "Login"

**Expected Results:**
- ✅ User logged in successfully
- ✅ UserContext populated with:
  - uid = auth user id
  - phoneNumber = 03001234567
  - referralCode = (9-digit code from DB)
  - isLoggedIn = true
- ✅ User redirected to home page
- ✅ Session persisted to localStorage

**Browser Console Check:**
```javascript
// Check UserContext state:
// Open DevTools > Application > Local Storage > winwave_user_session
```

---

### Test 1.3: Session Persistence After Page Refresh
**Steps:**
1. User logged in from Test 1.2
2. Note the referralCode displayed (e.g., "123456789")
3. Refresh the page (F5)
4. Wait for page to load

**Expected Results:**
- ✅ User remains logged in
- ✅ Referral code is the same as before refresh
- ✅ No auth error messages
- ✅ All user data loaded from DB

**Verification:**
```javascript
// In console after refresh:
const session = JSON.parse(localStorage.getItem('winwave_user_session'));
console.log('uid:', session.uid);
console.log('referralCode:', session.referralCode);
console.log('isLoggedIn:', session.isLoggedIn);
```

---

### Test 1.4: Logout
**Steps:**
1. User logged in (from Test 1.3)
2. Go to Account view
3. Click Logout button

**Expected Results:**
- ✅ Session cleared from localStorage
- ✅ User redirected to login page
- ✅ isLoggedIn = false
- ✅ Auth session cleared

---

## PHASE 2: REFERRAL SYSTEM TESTING

### Scenario A: Team A Registers (No Referral) → Receives Code
**Steps:**
1. Register new account (from Test 1.1)
2. Note the referralCode displayed (save as TEAM_A_CODE)
3. Copy the code (UI has copy button)

**Expected Results:**
- ✅ Team A account created
- ✅ referral_code generated (e.g., 987654321)
- ✅ Can copy referral code to clipboard
- ✅ referred_by = NULL
- ✅ Direct invite count = 0

**Database Check:**
```sql
SELECT 
  id, 
  phone_number, 
  referral_code,
  referred_by,
  inviter_code,
  created_at
FROM public.users 
WHERE phone_number LIKE '%3001234567%' 
LIMIT 1;
```

---

### Scenario B: Team B Registers Using Team A's Code
**Steps:**
1. New browser or private window
2. Click "Register"
3. Enter phone: 03009876543
4. Enter password: Test@456
5. Confirm password: Test@456
6. **Enter invitation code: [TEAM_A_CODE]** (from Scenario A)
7. Click "Create account"

**Expected Results:**
- ✅ Referral code validated successfully
- ✅ Team B account created with:
  - phone_number = 03009876543
  - referral_code = NEW 9-digit code (auto-generated)
  - referred_by = Team A's UUID
  - inviter_code = [TEAM_A_CODE]
- ✅ Success message: "Registration complete! You are now logged in."
- ✅ No error about invalid referral code

**Database Check:**
```sql
-- Team B's record:
SELECT 
  id, 
  phone_number, 
  referral_code,
  referred_by,
  inviter_code,
  created_at
FROM public.users 
WHERE phone_number LIKE '%3009876543%';

-- Verify Team B's referred_by points to Team A:
SELECT a.phone_number AS team_a_phone, b.phone_number AS team_b_phone, b.referred_by
FROM public.users a, public.users b
WHERE b.referred_by = a.id 
  AND a.phone_number LIKE '%3001234567%'
  AND b.phone_number LIKE '%3009876543%';
```

---

### Scenario C: Team A Views Referral Stats
**Steps:**
1. Log in as Team A (from Scenario A)
2. Go to Promotion View
3. Check "Direct Invitees" count
4. Check "Team Invitees" count

**Expected Results:**
- ✅ Direct Invitees count = 1 (Team B)
- ✅ Team Invitees count = 0
- ✅ Team B's phone visible in invitees list (masked: 030xxxxxxx3)
- ✅ Team B's join date visible

**API Call Check:**
```javascript
// In console during page load:
// Look for: GET /api/referral/stats/[team_a_uuid]?level=2
// Response should show: total_users: 1
```

---

### Scenario D: Team B Registers Team C Using Their Code
**Steps:**
1. New browser or private window (Team C)
2. Click "Register"
3. Enter phone: 03007654321
4. Enter password: Test@789
5. Confirm password: Test@789
6. **Enter invitation code: [TEAM_B_CODE]** (from Scenario B)
7. Click "Create account"

**Expected Results:**
- ✅ Team C account created with:
  - referred_by = Team B's UUID
  - inviter_code = [TEAM_B_CODE]
- ✅ No registration errors

**Database Verification:**
```sql
-- Check referral hierarchy:
SELECT 
  c.phone_number AS team_c,
  c.referred_by AS team_c_referrer,
  b.phone_number AS team_b,
  b.referred_by AS team_b_referrer,
  a.phone_number AS team_a
FROM public.users c
JOIN public.users b ON c.referred_by = b.id
JOIN public.users a ON b.referred_by = a.id
WHERE c.phone_number LIKE '%3007654321%';
```

---

### Scenario E: Check Referral Hierarchy
**Steps:**
1. Log in as Team A
2. Go to Promotion View → "Invitees Overview"
3. Check tabs: "Team" and "Direct"

**Expected Results:**

**Direct Invitees Tab:**
- ✅ Team B visible (count = 1)
- ✅ Team B's phone masked
- ✅ Team B's join date

**Team Invitees Tab (if available):**
- ✅ Team C visible (count = 1, level 2)
- ✅ Team C's phone masked

**Steps (Team B):**
1. Log in as Team B
2. Go to Promotion View → "Invitees Overview"

**Expected Results:**
- ✅ Direct: Team C (count = 1)
- ✅ Team: None (count = 0)

---

### Scenario F: Referral Commission Distribution
**Steps:**
1. Log in as Team C
2. Make a bet in WinGo (any amount)
3. Log out

**Expected Results:**
- ✅ Bet recorded with user_id = Team C UUID
- ✅ If applicable: Commission created in referral_commissions table
- ✅ Commission record shows:
  - subordinate_id = Team C id
  - inviter_id = Team B id
  - OR level_2_inviter_id = Team A id (if 2-level commission)

---

## PHASE 3: REFERRAL PAGES VERIFICATION

### Test 3.1: Promotion View
**Steps:**
1. Log in as any user with referrals
2. Go to "Promotion" tab
3. View all sections

**Expected Results:**
- ✅ Referral code displayed
- ✅ Copy button works
- ✅ Direct invitees count accurate
- ✅ Team invitees count accurate
- ✅ Weekly commission displayed
- ✅ Total commission displayed
- ✅ No dummy/placeholder data
- ✅ All data is LIVE from Supabase

---

### Test 3.2: Invitees Overview
**Steps:**
1. From Promotion View, click "Invitees Overview"
2. Check "Team" tab
3. Check "Direct" tab
4. Try search/filter

**Expected Results:**
- ✅ Correct users displayed
- ✅ Phone numbers masked
- ✅ Join dates visible
- ✅ Search works correctly
- ✅ No errors in console

---

### Test 3.3: New Invitees
**Steps:**
1. From Promotion View, click "New Invitees"
2. Check "Today" tab
3. Check "Yesterday" tab
4. Check "This month" tab

**Expected Results:**
- ✅ New invitees from correct time period shown
- ✅ Pagination works
- ✅ No placeholder data

---

## ERROR HANDLING CHECKS

### Check 1: Invalid Referral Code
**Steps:**
1. Try to register with invalid code (e.g., "999999999")
2. Submit form

**Expected Results:**
- ✅ Error message: "Referral code 'XXX' is invalid"
- ✅ Registration blocked
- ✅ No account created

---

### Check 2: Duplicate Phone
**Steps:**
1. Register first user: 03001234567
2. Try to register again with same phone
3. Submit form

**Expected Results:**
- ✅ Error message: "This phone number is already registered. Please log in."
- ✅ Account not created

---

### Check 3: Weak Password
**Steps:**
1. Try to register with password: "123"
2. Submit form

**Expected Results:**
- ✅ Error message: "Password must be at least 6 characters"
- ✅ Registration blocked

---

## CONSOLE CHECKS

During testing, monitor browser console for:
- ❌ No red error messages
- ❌ No 404 errors
- ✅ Green info messages like "✅ Generated referral code"
- ✅ Info about successful queries
- ✅ No RLS policy violations

---

## DATABASE CHECKS

Run these in Supabase SQL Editor to verify data integrity:

```sql
-- 1. Check all users have referral_code
SELECT COUNT(*) as total_users, 
       SUM(CASE WHEN referral_code IS NULL THEN 1 ELSE 0 END) as missing_codes
FROM public.users;

-- 2. Check no duplicate referral_codes
SELECT referral_code, COUNT(*) as count
FROM public.users
WHERE referral_code IS NOT NULL
GROUP BY referral_code
HAVING COUNT(*) > 1;

-- 3. Verify referred_by relationships
SELECT COUNT(*) as users_with_referrals,
       COUNT(DISTINCT referred_by) as unique_referrers
FROM public.users
WHERE referred_by IS NOT NULL;

-- 4. Check referral_commissions exist (if applicable)
SELECT COUNT(*) as total_commissions,
       COUNT(DISTINCT inviter_id) as unique_inviters,
       SUM(amount) as total_commission_amount
FROM public.referral_commissions;
```

---

## FINAL SIGN-OFF

**Testing Completed**: [ ]  
**All Tests Passed**: [ ]  
**Issues Found**: [ ] (If any, list below)  

### Issues (if any):
```
1. 
2. 
3. 
```

**Notes:**
```

```

---

**Tested By**: _______________  
**Date**: _______________  
**Time Spent**: _______________
