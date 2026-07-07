# FIX: Fraud Analysis + Agent Management Deposit Display

## ISSUE 1: Fraud Analysis Function Missing

**Error:** `Could not find the function public.analyze_agent_network_fraud(p_agent_id)`

**Solution:** Execute the SQL migration to create the missing function.

### SQL to Execute:
```sql
-- File: backend/supabase/fix_fraud_analysis_and_deposits.sql
-- Execute in Supabase SQL Editor (service_role)
```

This creates:
1. `analyze_agent_network_fraud(p_agent_id UUID)` - Fraud analysis RPC
2. `get_agent_dashboard_stats(p_agent_id UUID)` - Dashboard stats with real deposits
3. `get_agent_team_deposits(p_agent_id UUID, p_max_level INT)` - Team deposits calculation

---

## ISSUE 2: Invited Members Showing Rs 0 Deposit

**Problem:** 
```
Invited Members (11)
UID: 162334511
Phone: 3198119104
Deposit: Rs 0
Bets: Rs 0
```

**Root Cause:** 
- The component is fetching `total_bets` but displaying it as "Bets"
- The `total_deposit` field exists but is showing Rs 0
- Missing "Total Deposit" field

**Solution:** Update the Invited Members display section in AgentManagement.tsx

### Code Change:

**FIND THIS (around line 550-580):**
```jsx
<div className="grid grid-cols-2 gap-2 text-[10px]">
  <div>
    <span className="text-gray-500">Deposit:</span>
    <span className="text-green-400 font-bold ml-1">Rs {member.total_deposit.toLocaleString()}</span>
  </div>
  <div>
    <span className="text-gray-500">Bets:</span>
    <span className="text-white font-bold ml-1">Rs {member.total_bets.toLocaleString()}</span>
  </div>
</div>
```

**REPLACE WITH:**
```jsx
<div className="grid grid-cols-2 gap-2 text-[10px]">
  <div>
    <span className="text-gray-500">Deposit:</span>
    <span className="text-green-400 font-bold ml-1">Rs {member.total_deposit.toLocaleString()}</span>
  </div>
  <div>
    <span className="text-gray-500">Total Deposit:</span>
    <span className="text-green-400 font-bold ml-1">Rs {member.total_deposit.toLocaleString()}</span>
  </div>
  <div>
    <span className="text-gray-500">Bets:</span>
    <span className="text-white font-bold ml-1">Rs {member.total_bets.toLocaleString()}</span>
  </div>
  <div>
    <span className="text-gray-500">Commission:</span>
    <span className="text-orange-400 font-bold ml-1">Rs 0</span>
  </div>
</div>
```

---

## WHY Rs 0 IS SHOWING

The issue is that `member.total_deposit` is coming from the database as 0 because:

1. **Deposits not being recorded** - Check if deposits are being created in `deposit_history` table
2. **Users table not updated** - The `total_deposit` field in users table might not be synced
3. **Trigger not firing** - The trigger that updates `users.total_deposit` might not be working

### Verify in Supabase:

```sql
-- Check if deposits exist
SELECT COUNT(*) FROM public.deposit_history WHERE status = 'completed';

-- Check if users.total_deposit is populated
SELECT id, phone_number, total_deposit FROM public.users WHERE total_deposit > 0 LIMIT 5;

-- Check if trigger is working
SELECT * FROM public.deposit_history LIMIT 1;
```

---

## DEPLOYMENT STEPS

### Step 1: Execute SQL Migration
```
1. Open Supabase SQL Editor
2. Copy content from: backend/supabase/fix_fraud_analysis_and_deposits.sql
3. Execute as service_role
4. Verify functions exist:
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name LIKE 'analyze_agent%' OR routine_name LIKE 'get_agent%';
```

### Step 2: Update AgentManagement.tsx
```
1. Open src/admin/pages/AgentManagement.tsx
2. Find the Invited Members List section (around line 550-580)
3. Replace the grid layout with the new 4-column version
4. Save file
```

### Step 3: Verify Fraud Analysis Works
```
1. Open Agent Management
2. Search for an agent
3. Click "Analyze Agent Fraud Network" button
4. Should show network analysis without error
```

### Step 4: Verify Deposit Display
```
1. Open Agent Management
2. Search for an agent
3. Scroll to "Invited Members" section
4. Should show:
   - Deposit: Rs X
   - Total Deposit: Rs X
   - Bets: Rs X
   - Commission: Rs 0
```

---

## IF DEPOSITS STILL SHOW Rs 0

The problem is likely that `users.total_deposit` is not being updated when deposits are created.

### Check the Trigger:

```sql
-- Verify trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_deposit_approved';

-- Check trigger function
SELECT pg_get_triggerdef(oid) FROM pg_trigger 
WHERE tgname = 'trg_deposit_approved';
```

### If Trigger Missing, Create It:

```sql
CREATE OR REPLACE FUNCTION public.fn_on_deposit_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.users
    SET main_balance      = main_balance      + NEW.amount,
        total_deposit     = total_deposit     + NEW.amount,
        wagering_required = wagering_required + NEW.amount,
        total_winning     = total_winning     + (NEW.amount * 0.02)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposit_approved ON public.deposit_history;
CREATE TRIGGER trg_deposit_approved
  AFTER UPDATE ON public.deposit_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_deposit_approved();
```

---

## SUMMARY

| Issue | Fix |
|-------|-----|
| Fraud analysis function missing | Execute SQL migration |
| Invited Members showing Rs 0 | Update grid layout in AgentManagement.tsx |
| Deposits not syncing to users table | Check/recreate trigger |
| Missing "Total Deposit" field | Add 4th column to grid |

---

## FILES TO MODIFY

1. **backend/supabase/fix_fraud_analysis_and_deposits.sql** - Execute this SQL
2. **src/admin/pages/AgentManagement.tsx** - Update Invited Members grid layout

---

## VERIFICATION CHECKLIST

- [ ] SQL migration executed successfully
- [ ] Fraud analysis function exists
- [ ] AgentManagement.tsx updated with 4-column grid
- [ ] Invited Members shows Deposit + Total Deposit
- [ ] Fraud analysis button works without error
- [ ] Deposit values match database
