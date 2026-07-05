# CRITICAL DATABASE FIX - MISSING TABLES

**Status:** 🔴 BLOCKING - Must add before migration  
**Generated:** July 5, 2026

---

## EXECUTIVE SUMMARY

The consolidated `MASTER_PRODUCTION_SCHEMA.sql` is missing **3 critical tables** that are actively used in the codebase:

| Table | Files Using It | Status |
|-------|-----------------|--------|
| **wallets** | api.ts, wallet.ts, database.ts (4 refs) | ❌ MISSING |
| **referral_commissions** | PromotionView.tsx, UserContext.tsx (3 refs) | ❌ MISSING |
| **user_banks** | database.ts (2 refs) | ❌ MISSING |

---

## THE FIX: SQL TO ADD NOW

**Copy this SQL block and add it to `MASTER_PRODUCTION_SCHEMA.sql` after the transaction_history table definition:**

```sql
-- ════════════════════════════════════════════════════════════════════════════════
-- MISSING TABLES - MUST ADD BEFORE MIGRATION
-- ════════════════════════════════════════════════════════════════════════════════

-- WALLET BALANCES
-- Used by: backend/api/wallet.ts, backend/api/api.ts, src/lib/database.ts
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id           UUID          PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  main_balance      NUMERIC(18,2) NOT NULL DEFAULT 0,
  game_balance      NUMERIC(18,2) NOT NULL DEFAULT 0,
  wagering_required NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- Trigger to auto-update wallets.updated_at
DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- REFERRAL COMMISSIONS
-- Used by: src/components/PromotionView.tsx, src/context/UserContext.tsx
-- Tracks earned commissions from referral payouts
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id       UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  deposit_id       UUID          REFERENCES public.deposit_history(id) ON DELETE SET NULL,
  level            INT           NOT NULL DEFAULT 1,
  status           TEXT          NOT NULL DEFAULT 'completed',
  amount           NUMERIC(18,2) NOT NULL,
  commission_rate  NUMERIC(5,2),
  remarks          TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rc_inviter_id ON public.referral_commissions(inviter_id);
CREATE INDEX IF NOT EXISTS idx_rc_created_at ON public.referral_commissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rc_status ON public.referral_commissions(status);

-- USER BANK ACCOUNTS
-- Used by: src/lib/database.ts
-- Stores multiple bank accounts per user for withdrawal
CREATE TABLE IF NOT EXISTS public.user_banks (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_name      TEXT,
  account_name   TEXT          NOT NULL,
  account_number TEXT          NOT NULL,
  account_type   TEXT,
  is_verified    BOOLEAN       DEFAULT FALSE,
  is_default     BOOLEAN       DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_ub_user_id ON public.user_banks(user_id);
CREATE INDEX IF NOT EXISTS idx_ub_is_default ON public.user_banks(is_default);

-- Trigger to auto-update user_banks.updated_at
DROP TRIGGER IF EXISTS trg_ub_updated_at ON public.user_banks;
CREATE TRIGGER trg_ub_updated_at
  BEFORE UPDATE ON public.user_banks
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

---

## WHERE TO ADD THIS SQL

**File:** `backend/supabase/MASTER_PRODUCTION_SCHEMA.sql`

**Location:** After line ~207 (after `transaction_history` table definition)

**Before:** The game engine tables section (game_rounds, betting_history)

---

## ADDITIONAL FIX: Column Name Inconsistency

**Find this line in `withdrawal_history` table definition:**
```sql
account_no      TEXT,
```

**Replace with:**
```sql
account_number  TEXT,
```

**Reason:** Code in `backend/api/payout.ts` expects `withdrawal.account_number` but schema has `account_no`

---

## VALIDATION AFTER ADDING

After adding these tables to MASTER_PRODUCTION_SCHEMA.sql:

✅ Run schema in new Supabase  
✅ Verify tables exist: `wallets`, `referral_commissions`, `user_banks`  
✅ Verify all indexes created  
✅ Test withdrawal flow with user_banks  
✅ Test referral commission queries  
✅ Test wallet balance transfer  

---

## IMPACT IF NOT FIXED

❌ **Deposit flow will fail** - cannot fetch/store wallets  
❌ **Withdrawal flow will fail** - cannot access user bank accounts  
❌ **Commission system will fail** - cannot fetch referral commissions  
❌ **Admin dashboard will error** - commission display requires referral_commissions  

---

## FILES AFFECTED BY THESE TABLES

### wallets table:
- `backend/api/api.ts` - Login wallet fetch
- `backend/api/wallet.ts` - Balance transfer
- `src/lib/database.ts` - DB abstraction functions
- `src/context/UserContext.tsx` - User session data

### referral_commissions table:
- `src/components/PromotionView.tsx` - Display total/weekly commissions
- `src/context/UserContext.tsx` - Fetch total commissions

### user_banks table:
- `src/lib/database.ts` - Fetch/upsert bank accounts
- Used implicitly by withdrawal flow

---

## RECOMMENDATION

1. ✅ Copy the SQL block above
2. ✅ Open `backend/supabase/MASTER_PRODUCTION_SCHEMA.sql`
3. ✅ Find line 207 (transaction_history table end)
4. ✅ Paste SQL block
5. ✅ Fix `account_no` → `account_number` in withdrawal_history
6. ✅ Save file
7. ✅ Run in new Supabase SQL editor
8. ✅ Test all critical flows

**Estimated time to fix:** 10 minutes

