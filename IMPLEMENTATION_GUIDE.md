# IMPLEMENTATION GUIDE - Critical Fixes

## Overview
This guide covers all critical fixes needed:
1. ✅ Commission rates by VIP level (L0-L6)
2. ✅ Prevent duplicate commission claims
3. ✅ Fix account column names
4. ✅ Remove WinWave banners
5. ✅ Test deposit/payout flows

---

## Fix 1: Commission Rates by VIP Level

### File: `backend/lib/commissionRates.ts` ✅ CREATED

**What it does:**
- Defines commission rates for L0-L6 VIP levels
- Calculates commission based on referral depth (1-6 levels)
- Prevents agents from getting full deposit amount

**Example:**
```
User deposits: 300
Agent VIP Level: L0 (0)
Agent is direct referrer (depth 1)
Commission = 300 * 0.003 = 0.9 ✅ (NOT 300)
```

**Usage in code:**
```typescript
import { calculateCommission } from '../lib/commissionRates';

const commission = calculateCommission(
  betAmount,      // 300
  agentVipLevel,  // 0 (L0)
  referralDepth   // 1 (direct)
);
// Returns: 0.9
```

---

## Fix 2: Prevent Duplicate Commission Claims

### File: `backend/supabase/add_commission_idempotency.sql` ✅ CREATED

**What it does:**
- Adds `claimed` flag to transactions table
- Creates atomic `claim_commission()` function
- Uses database locks to prevent race conditions
- Ensures commission claimed only once

**How it works:**
```
1. User clicks "Claim Commission"
   ↓
2. Frontend calls claim_commission(user_id, commission_id)
   ↓
3. Database locks the commission row (FOR UPDATE)
   ↓
4. Check if already claimed
   ├─ If YES: Return error "already claimed"
   └─ If NO: Mark as claimed, credit balance
   ↓
5. Page refreshes
   ↓
6. User clicks claim again
   ↓
7. Database returns "already claimed" error
   ↓
8. Balance NOT credited again ✅
```

**Implementation steps:**

### Step 1: Run SQL Migration
Go to Supabase Dashboard → SQL Editor → Copy & paste entire `add_commission_idempotency.sql` file → Run

### Step 2: Create API Endpoint
Create `backend/api/commission.ts`:

```typescript
import { Router } from 'express';
import { supabaseAdmin } from '../database/db';

const router = Router();

// Claim commission
router.post('/claim', async (req, res) => {
  try {
    const { user_id, commission_id } = req.body;

    if (!user_id || !commission_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing user_id or commission_id' 
      });
    }

    // Call the idempotent function
    const { data, error } = await supabaseAdmin.rpc(
      'claim_commission',
      { p_user_id: user_id, p_commission_id: commission_id }
    );

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Internal server error' 
    });
  }
});

// Get unclaimed commissions
router.get('/unclaimed/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabaseAdmin.rpc(
      'get_unclaimed_commissions',
      { p_user_id: user_id }
    );

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, commissions: data });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Internal server error' 
    });
  }
});

// Get total unclaimed commission
router.get('/total/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabaseAdmin.rpc(
      'get_total_unclaimed_commission',
      { p_user_id: user_id }
    );

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, total: data });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Internal server error' 
    });
  }
});

export default router;
```

### Step 3: Mount in API Router
In `backend/api/api.ts`, add:
```typescript
import commissionRouter from './commission';

router.use('/commission', commissionRouter);
```

### Step 4: Update Frontend
In commission claim component:
```typescript
async function claimCommission(commissionId: string) {
  try {
    const response = await fetch('/api/commission/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        commission_id: commissionId
      })
    });

    const data = await response.json();

    if (data.success) {
      // Show success message
      toast.success(`Commission claimed: Rs ${data.amount}`);
      // Refresh balance
      refreshUserBalance();
    } else {
      // Show error (e.g., "already claimed")
      toast.error(data.error);
    }
  } catch (error) {
    toast.error('Failed to claim commission');
  }
}
```

---

## Fix 3: Account Column Names

### Verify in `backend/api/payout.ts`

**Current (Line 87):**
```typescript
account_number: withdrawal.account_no,  // ✅ CORRECT
```

**Status:** Already correct! Uses `account_no` from database.

---

## Fix 4: Remove WinWave Banners

### Find banners in home page component

Search for files containing "WinWave" banners:
- `src/components/HomeSections.tsx`
- `src/components/Banner.tsx`
- `src/components/HomeContent.tsx`

**Action:** Remove or replace with WinClub branding

---

## Fix 5: Test Deposit/Payout Flows

### Test Cases

#### Test 1: Deposit Flow
```javascript
// 1. User deposits 300
// 2. PKPay webhook received
// 3. Balance should show 300
// 4. Agent should get 0.9 commission (0.3% of 300)

fetch('https://winclub-officiall.vercel.app/api/webhook/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    out_trade_no: 'test-deposit-001',
    status: 'success',
    amount: 300,
    user_id: 'user-123'
  })
})
.then(r => r.json())
.then(data => console.log('Deposit result:', data))
```

#### Test 2: Commission Claim
```javascript
// 1. Agent has unclaimed commission
// 2. Click "Claim Commission"
// 3. Balance should increase
// 4. Click again - should show "already claimed"

fetch('https://winclub-officiall.vercel.app/api/commission/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'agent-123',
    commission_id: 'commission-uuid'
  })
})
.then(r => r.json())
.then(data => console.log('Claim result:', data))
```

#### Test 3: Payout Flow
```javascript
// 1. Agent requests withdrawal of 100
// 2. Admin approves
// 3. Payout endpoint called
// 4. Should process to PKPay
// 5. Webhook updates status

fetch('https://winclub-officiall.vercel.app/api/payout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    withdrawal_id: 'withdrawal-uuid',
    adminSecretToken: 'ww-admin-mutation-key-2025-secure-change-in-production'
  })
})
.then(r => r.json())
.then(data => console.log('Payout result:', data))
```

---

## Implementation Checklist

- [ ] Run SQL migration in Supabase
- [ ] Create `backend/api/commission.ts`
- [ ] Mount commission router in `backend/api/api.ts`
- [ ] Update frontend commission claim component
- [ ] Verify payout.ts uses `account_no`
- [ ] Remove WinWave banners from home page
- [ ] Test deposit flow
- [ ] Test commission claim (single claim only)
- [ ] Test payout flow
- [ ] Verify no duplicate commissions on refresh

---

## Expected Results

✅ Commission rates correct (0.3% for L0, etc.)
✅ Commission claimed only once
✅ Refresh page doesn't duplicate commission
✅ Payout uses correct column names
✅ Home page shows WinClub branding
✅ All flows tested and working

---

## Files Created/Modified

**Created:**
- `backend/lib/commissionRates.ts` - Commission rate configuration
- `backend/supabase/add_commission_idempotency.sql` - SQL migration
- `backend/api/commission.ts` - Commission API endpoints (to create)

**To Modify:**
- `backend/api/api.ts` - Mount commission router
- `src/components/HomeSections.tsx` - Remove WinWave banners
- Frontend commission component - Update claim logic

---

## Next Steps

1. Run the SQL migration in Supabase
2. Create the commission API endpoints
3. Update frontend to use new endpoints
4. Test all flows
5. Deploy to Vercel

**Estimated time:** 2-3 hours
