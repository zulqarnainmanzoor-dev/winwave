# UID System Implementation Guide

## Changes Applied

### ✅ 1. Member Management (DONE)
- Updated to fetch `referral_code` instead of `invite_code`
- Changed `uid` display to use `referral_code` (real UID)
- Changed `username` to display real UID instead of `MEMBER_xxxx`
- Updated search filter to search `referral_code` field

**File**: `src/admin/pages/MemberManagement.tsx`

### ✅ 2. Agent Management (DONE)
- Updated to fetch `referral_code` instead of `invite_code`
- Changed `uid` display to use `referral_code` (real UID)
- Changed `username` to display real UID instead of `AGENT_xxxx`
- Updated search to query `referral_code` field

**File**: `src/admin/pages/AgentManagement.tsx`

### ✅ 3. Members API (DONE)
- Already fetches `referral_code` from database
- Ready for frontend consumption

**File**: `backend/api/members.ts`

---

## Remaining Tasks

### Task 1: Update Deposit History View
**File**: `src/components/DepositHistoryView.tsx`

Update to display real UID:
```typescript
// Current (wrong)
uid: deposit.user_id.slice(0, 6).toUpperCase()

// Should be (correct)
uid: user.referral_code || deposit.user_id.slice(0, 6).toUpperCase()
```

### Task 2: Update Withdrawal History View
**File**: `src/components/WithdrawHistoryView.tsx`

Same as Deposit History - display real UID from `referral_code`

### Task 3: Update Betting History View
**File**: `src/components/BetHistoryView.tsx`

Display real UID from `referral_code`

### Task 4: Create Enhanced Member Profile
**File**: `src/admin/pages/MemberProfile.tsx` (NEW)

Display complete account summary:
- Basic Information (UID, Phone, Username, Registration Date, Last Login, Status, Agent, Invited By)
- Wallet (Main Balance, Commission Balance, Total Bonus, Locked Amount)
- Deposit (Today's, Total, Pending, Failed, Last, Largest)
- Withdrawal (Today's, Total, Pending, Rejected, Last)
- Betting (Today's, Total, Win Amount, Loss Amount, Wager Requirement)
- Team (Direct Invites, Team Size, Active Members, Inactive Members)
- Commission (Today's, Total, Last Claimed, Pending)
- Security (Withdrawal PIN Status, Bank Status, Device Count, Last IP)

### Task 5: Create Agent Analytics Dashboard
**File**: `src/admin/pages/AgentAnalytics.tsx` (NEW)

Convert Agent Management to analytics dashboard:
- For each Agent show: UID, Phone, Name, Direct Members, Team Members
- Today's: Deposits, Recharge, Betting, Withdrawals
- Total: Deposits, Recharge, Betting, Withdrawals, Commission Earned
- Pending Commission, Active Members, Inactive Members
- Drill-down support: Agent → Team → Member → History

### Task 6: Update New Registration Flow
**File**: `backend/api/register.ts`

Ensure new users get `referral_code` set to their numeric UID:
```typescript
// Generate numeric UID (9 digits)
const uid = Math.floor(100000000 + Math.random() * 900000000).toString();

// Store in referral_code
INSERT INTO users (id, referral_code, ...) VALUES (user_id, uid, ...)
```

### Task 7: Update Invitees View
**File**: `src/components/NewInviteesView.tsx` or `src/components/InviteesOverviewView.tsx`

Display real UID from `referral_code` for each invitee

### Task 8: Update Admin Dashboard
**File**: `src/admin/AdminDashboard.tsx`

Display real UIDs in all member lists and statistics

---

## Database Verification

### Check if referral_code is populated
```sql
SELECT id, phone_number, referral_code, invite_code 
FROM public.users 
WHERE referral_code IS NOT NULL 
LIMIT 10;
```

### Check for NULL referral_codes
```sql
SELECT COUNT(*) as null_count 
FROM public.users 
WHERE referral_code IS NULL;
```

### If many are NULL, generate them
```sql
UPDATE public.users 
SET referral_code = LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0')
WHERE referral_code IS NULL;
```

---

## Testing Checklist

- [ ] Search for real UID (e.g., `162334511`) in Member Management
- [ ] Verify it returns the correct user
- [ ] Verify UID displays as `162334511` (not `A1B2C3`)
- [ ] Search for real UID in Agent Management
- [ ] Verify it returns the correct agent
- [ ] Verify UID displays as `162334511` (not `AGENT_A1B2C3`)
- [ ] Check Deposit History displays real UID
- [ ] Check Withdrawal History displays real UID
- [ ] Check Betting History displays real UID
- [ ] Create new user and verify they get numeric UID
- [ ] Verify Member Profile shows complete account summary
- [ ] Verify Agent Analytics shows all required metrics
- [ ] Test drill-down: Agent → Team → Member → History

---

## Rollback Plan

If issues occur:
1. Revert to using `invite_code` instead of `referral_code`
2. Revert to generating display IDs like `MEMBER_xxxx`
3. Revert search to use `invite_code` field

All changes are non-destructive and can be reverted by changing field names back.

---

## Notes

- `referral_code` is the real numeric UID (e.g., `162334511`)
- `invite_code` is the 6-char alphanumeric code (e.g., `A1B2C3`)
- `id` is the UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Always display `referral_code` as the primary UID to users and admins
- Use `invite_code` only for internal referral link generation
- Use `id` only for database operations
