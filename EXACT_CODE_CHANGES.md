## EXACT CODE CHANGES - PKPAY DEPOSIT FLOW FIX

### CHANGE 1: DepositView.tsx - handlePayNow function

**Location**: `src/components/DepositView.tsx` (around line 200)

**OLD CODE**:
```typescript
const handlePayNow = async () => {
  const amountToPay = selectedAmount || parseInt(amount);

  if (!amountToPay || isNaN(amountToPay)) {
    alert("Please select or enter a valid amount.");
    return;
  }

  const links = selectedPaymentMethod === "easypaisa" ? easypaisaLinks : jazzcashLinks;
  const targetUrl = links[amountToPay];

  if (targetUrl) {
    const urlParts = targetUrl.split('/');
    const orderId = urlParts[urlParts.length - 1];
    
    if (!orderId) {
      window.location.href = targetUrl;
      return;
    }

    try {
      const userId = (userContext as any)?.uid || null;
      if (!userId) {
        window.location.href = targetUrl;
        return;
      }

      try {
        await (supabase as any)
          .from('deposit_history')
          .insert([{
            user_id: userId,
            amount: amountToPay,
            method: selectedPaymentMethod.toUpperCase(),
            order_id: orderId,
            gateway_ref: targetUrl,
            status: 'pending',
            remarks: `PKPay deposit via ${selectedPaymentMethod.toUpperCase()}. Amount Rs ${amountToPay}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        console.log(`Created pending deposit for order_id: ${orderId}`);
      } catch (error) {
        console.error('Failed to create deposit record:', error);
      }
      
      window.location.href = targetUrl;
    } catch (e) {
      window.location.href = targetUrl;
      return;
    }
  } else {
    alert("Automated deposits are only available for fixed packages right now. Please select a supported quick amount for the selected gateway.");
  }
};
```

**NEW CODE**:
```typescript
const handlePayNow = async () => {
  const amountToPay = selectedAmount || parseInt(amount);

  if (!amountToPay || isNaN(amountToPay)) {
    alert("Please select or enter a valid amount.");
    return;
  }

  const links = selectedPaymentMethod === "easypaisa" ? easypaisaLinks : jazzcashLinks;
  const targetUrl = links[amountToPay];

  if (targetUrl) {
    const urlParts = targetUrl.split('/');
    const orderId = urlParts[urlParts.length - 1];
    
    if (!orderId) {
      console.error('[DepositView] Failed to extract order_id from PKPay URL');
      window.location.href = targetUrl;
      return;
    }

    // CRITICAL FIX: Get user_id from auth session (most reliable source)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      console.error('[DepositView] No authenticated user found. Cannot create deposit record.');
      alert('Authentication error. Please log in again.');
      return;
    }

    try {
      console.log(`[DepositView] Creating deposit_history: user_id=${userId}, order_id=${orderId}, amount=${amountToPay}, method=${selectedPaymentMethod}`);
      
      const { data, error } = await (supabase as any)
        .from('deposit_history')
        .insert([{
          user_id: userId,
          amount: amountToPay,
          method: selectedPaymentMethod.toUpperCase(),
          order_id: orderId,
          gateway_ref: targetUrl,
          status: 'pending',
          remarks: `PKPay deposit via ${selectedPaymentMethod.toUpperCase()}. Amount Rs ${amountToPay}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('[DepositView] FAILED to create deposit_history:', error);
        console.error('Details:', { userId, orderId, amount: amountToPay, method: selectedPaymentMethod });
        alert('Failed to create deposit record. Please try again.');
        return;
      }

      console.log(`[DepositView] SUCCESS: Created pending deposit_history: order_id=${orderId}, user_id=${userId}, amount=${amountToPay}`);
      
      // Redirect AFTER successful insert
      window.location.href = targetUrl;
    } catch (error) {
      console.error('[DepositView] Exception creating deposit record:', error);
      alert('An error occurred. Please try again.');
      return;
    }
  } else {
    alert("Automated deposits are only available for fixed packages right now. Please select a supported quick amount for the selected gateway.");
  }
};
```

**Key Changes**:
1. Line 30-32: Get `user_id` from `supabase.auth.getSession()` instead of context
2. Line 34-37: Validate user_id exists and show error if not
3. Line 41-42: Add logging before insert
4. Line 44-56: Capture error from insert and show to user
5. Line 58: Add success logging
6. Line 62-65: Add exception handling with error message

---

### CHANGE 2: deposit-webhook.ts - Complete replacement

**Location**: `backend/api/deposit-webhook.ts`

**Key Changes**:
1. Add request_id for tracing
2. Add comprehensive logging at each step
3. Handle case where deposit_history record doesn't exist
4. Log to webhook_logs table
5. Provide fallback mechanism

**Critical Lines**:

**Line 95-110** (OLD):
```typescript
const { data: existingTx, error: existingTxError } = await supabaseAdmin
  .from("deposit_history")
  .select("id,user_id,status,order_id,amount,method,gateway_ref,remarks,created_at,updated_at")
  .eq("order_id", out_trade_no)
  .maybeSingle();

if (existingTxError) {
  console.error(`[webhook/deposit][${requestId}] ❌ deposit_history lookup failed:`, existingTxError);
  return res.status(500).json({ error: 'Deposit lookup failed' });
}
```

**Line 95-110** (NEW):
```typescript
console.log(`[webhook/deposit][${requestId}] 🔍 Looking up deposit_history by order_id: ${out_trade_no}`);

const { data: existingTx, error: existingTxError } = await supabaseAdmin
  .from("deposit_history")
  .select("id,user_id,status,order_id,amount,method,gateway_ref,remarks,created_at,updated_at")
  .eq("order_id", out_trade_no)
  .maybeSingle();

if (existingTxError) {
  console.error(`[webhook/deposit][${requestId}] ❌ deposit_history lookup failed:`, existingTxError);
  return res.status(500).json({ error: 'Deposit lookup failed' });
}

if (existingTx) {
  console.log(`[webhook/deposit][${requestId}] ✅ Found existing deposit_history:`, {
    id: existingTx.id,
    user_id: existingTx.user_id,
    status: existingTx.status,
    amount: existingTx.amount
  });
} else {
  console.warn(`[webhook/deposit][${requestId}] ⚠️ NO deposit_history record found for order_id: ${out_trade_no}`);
  console.warn(`[webhook/deposit][${requestId}] This means the frontend failed to create the record before redirect`);
}
```

**Line 145-150** (OLD):
```typescript
let targetUserId: string | null = user_id || existingTx?.user_id || null;

if (!targetUserId) {
  console.error(`[webhook/deposit][${requestId}] ❌ No user_id found for ${out_trade_no}`);
  return res.status(200).json({ received: true, note: "No user_id" });
}
```

**Line 145-165** (NEW):
```typescript
let targetUserId: string | null = user_id || existingTx?.user_id || null;

if (!targetUserId) {
  console.error(`[webhook/deposit][${requestId}] ❌ CRITICAL: No user_id found for ${out_trade_no}`);
  console.error(`[webhook/deposit][${requestId}] PKPay user_id: ${user_id}`);
  console.error(`[webhook/deposit][${requestId}] deposit_history user_id: ${existingTx?.user_id}`);
  
  // FALLBACK: If no deposit_history record exists, we cannot proceed
  if (!existingTx?.id) {
    console.error(`[webhook/deposit][${requestId}] ❌ CANNOT PROCEED: No deposit_history record AND no user_id in payload`);
    console.error(`[webhook/deposit][${requestId}] ACTION REQUIRED: Admin must manually create deposit_history record`);
    return res.status(200).json({ 
      received: true, 
      note: "No user_id found. Admin intervention required.",
      order_id: out_trade_no,
      amount: depositAmount
    });
  }
}

console.log(`[webhook/deposit][${requestId}] ✅ Using user_id: ${targetUserId}`);
```

---

### CHANGE 3: Database Migration

**Location**: `backend/supabase/migration_fix_deposit_flow.sql`

**Key Additions**:

1. **webhook_logs table**:
```sql
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  order_id TEXT,
  user_id UUID,
  amount NUMERIC(18,2),
  status TEXT,
  payload JSONB,
  error_message TEXT,
  log_level TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

2. **NOT NULL constraint**:
```sql
ALTER TABLE public.deposit_history 
  ALTER COLUMN user_id SET NOT NULL;
```

3. **Helper functions**:
```sql
-- Find orphaned deposits
CREATE OR REPLACE FUNCTION public.fn_find_orphaned_deposits()
RETURNS TABLE(...)
...

-- Manually assign user to deposit
CREATE OR REPLACE FUNCTION public.fn_assign_user_to_deposit(...)
RETURNS JSONB
...
```

---

## DEPLOYMENT CHECKLIST

- [ ] Replace `src/components/DepositView.tsx` with `DepositView_FIXED.tsx`
- [ ] Replace `backend/api/deposit-webhook.ts` with `deposit-webhook_ENHANCED.ts`
- [ ] Run database migration in Supabase SQL Editor
- [ ] Verify no NULL user_id values in deposit_history
- [ ] Test locally with curl webhook simulation
- [ ] Deploy to Vercel with git push
- [ ] Monitor webhook_logs in production
- [ ] Verify deposits completing successfully

---

## ROLLBACK PLAN

If issues occur:

1. **Revert files**:
```bash
git checkout src/components/DepositView.tsx
git checkout backend/api/deposit-webhook.ts
git push
```

2. **Revert database** (if needed):
```sql
-- Remove NOT NULL constraint
ALTER TABLE public.deposit_history 
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop webhook_logs table
DROP TABLE IF EXISTS public.webhook_logs CASCADE;
```

---

## VERIFICATION QUERIES

**Check deposit_history**:
```sql
SELECT id, order_id, user_id, amount, status, created_at 
FROM public.deposit_history 
ORDER BY created_at DESC LIMIT 10;
```

**Check webhook logs**:
```sql
SELECT * FROM public.webhook_logs 
WHERE webhook_type = 'deposit' 
ORDER BY created_at DESC LIMIT 20;
```

**Check user balance**:
```sql
SELECT id, phone_number, main_balance, total_deposit 
FROM public.users 
WHERE id = 'USER_ID_HERE';
```

**Find orphaned deposits**:
```sql
SELECT * FROM public.fn_find_orphaned_deposits();
```

---

## DONE

All files are ready for deployment. Follow the checklist above.
