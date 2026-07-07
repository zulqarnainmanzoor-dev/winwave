# UID System - Quick Reference

## The Three IDs

| ID Type | Column | Example | Use Case | Display |
|---------|--------|---------|----------|---------|
| **Real UID** | `referral_code` | `162334511` | User identification, search, display | ✅ Show to users & admins |
| **Invite Code** | `invite_code` | `A1B2C3` | Referral links | ❌ Don't display as UID |
| **System ID** | `id` | `550e8400-...` | Database operations | ❌ Don't display |

---

## What Changed

### Member Management
```typescript
// Before (WRONG)
uid: row.invite_code  // Shows A1B2C3

// After (CORRECT)
uid: row.referral_code  // Shows 162334511
```

### Agent Management
```typescript
// Before (WRONG)
uid: row.invite_code  // Shows A1B2C3

// After (CORRECT)
uid: row.referral_code  // Shows 162334511
```

### History Page
```typescript
// Before (WRONG)
.select("id, invite_code, phone_number")

// After (CORRECT)
.select("id, referral_code, phone_number")
```

---

## Search

### Member Management
```typescript
// Search by real UID
if (searchType === "uid") 
  return member.referral_code.includes(searchQuery)
```

### Agent Management
```typescript
// Search by real UID
.eq("referral_code", trimmed)
```

---

## Database Queries

### Check referral_code population
```sql
SELECT COUNT(*) FROM public.users WHERE referral_code IS NULL;
-- Should return 0
```

### Generate missing referral_codes
```sql
UPDATE public.users 
SET referral_code = LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0')
WHERE referral_code IS NULL;
```

### Search by real UID
```sql
SELECT * FROM public.users WHERE referral_code = '162334511';
```

---

## Testing

### Test 1: Search Works
1. Go to Member Management
2. Search for `162334511`
3. Should return the user ✅

### Test 2: Display Correct
1. Go to Member Management
2. Verify UID shows as `162334511` (not `A1B2C3`) ✅

### Test 3: Agent Search Works
1. Go to Agent Management
2. Search for `162334511`
3. Should return the agent ✅

### Test 4: History Shows Real UID
1. Go to History Page
2. Verify UID column shows `162334511` ✅

---

## Files Modified

| File | Change |
|------|--------|
| `src/admin/pages/MemberManagement.tsx` | Use `referral_code` instead of `invite_code` |
| `src/admin/pages/AgentManagement.tsx` | Use `referral_code` instead of `invite_code` |
| `src/admin/pages/HistoryPage.tsx` | Use `referral_code` instead of `invite_code` |

---

## Rollback

If needed, revert all changes:
```typescript
// Change from
uid: row.referral_code

// Back to
uid: row.invite_code
```

---

## Common Issues

### Issue: Search returns 0 results
**Cause:** Searching `invite_code` instead of `referral_code`
**Fix:** Verify code uses `referral_code` field

### Issue: UID displays as A1B2C3
**Cause:** Using `invite_code` instead of `referral_code`
**Fix:** Change to `referral_code` field

### Issue: Some users don't have referral_code
**Cause:** Not populated in database
**Fix:** Run the SQL migration to generate them

---

## Key Takeaways

✅ Always use `referral_code` for display and search
✅ `invite_code` is only for referral links
✅ `id` is only for database operations
✅ All changes are non-destructive
✅ Can be reverted in minutes if needed

---

## Support

For detailed information, see:
- `UID_SYSTEM_ROOT_CAUSE_AUDIT.md` - Why it was broken
- `UID_SYSTEM_FIXES_APPLIED.md` - What was changed
- `UID_SYSTEM_NEXT_STEPS.md` - What to do next
- `UID_SYSTEM_COMPLETE_SUMMARY.md` - Full overview
