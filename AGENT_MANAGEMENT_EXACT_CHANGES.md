# AgentManagement.tsx - Exact Code Changes

## CHANGE 1: Update handleFetchAgent function

### FIND THIS SECTION (around line 110-130):
```typescript
      // Fetch dashboard stats using RPC
      const { data: dashStats, error: dashError } = await (adminSupabase as any)
        .rpc("get_agent_dashboard_stats", { p_agent_id: user.id });
      
      if (dashError) throw dashError;
      const stats = dashStats?.[0] || {};

      // Fetch team deposits using RPC
      const { data: teamDepositData, error: teamError } = await (adminSupabase as any)
        .rpc("get_agent_team_deposits", { p_agent_id: user.id });
      
      if (teamError) throw teamError;
      const teamDeposits = teamDepositData?.[0] || {};
```

### REPLACE WITH:
```typescript
      // Fetch agent management stats using RPC
      const { data: mgmtStats, error: mgmtError } = await (adminSupabase as any)
        .rpc("get_agent_management_stats", { p_agent_id: user.id });
      
      if (mgmtError) throw mgmtError;
      const stats = mgmtStats?.[0] || {};
```

---

## CHANGE 2: Update setAgentData call

### FIND THIS SECTION (around line 145-165):
```typescript
      setAgentData({
        id:                   user.id,
        phone:                user.phone_number || "",
        main_balance:         Number(user.main_balance ?? 0),
        game_balance:         Number(user.game_balance ?? 0),
        vip_level:            user.vip_level || 0,
        invite_code:          user.referral_code || "",
        total_bets:           Number(stats.total_bets ?? 0),
        created_at:           user.created_at || "",
        direct_members:       Number(stats.total_members ?? 0),
        team_members:         Number(stats.total_members ?? 0),
        yesterday_commission: Number(stats.today_commission ?? 0),
        status:               "active",
        is_agent:             Boolean(user.is_agent),
        invited_members:      (invitedMembers || []).map((m: any) => ({
          id:           m.id,
          invite_code:  m.referral_code || "",
          phone_number: m.phone_number || "",
          created_at:   m.created_at || "",
          total_deposit: Number(m.total_deposit || 0),
          total_bets:   Number(m.total_bets || 0),
        })),
      });
```

### REPLACE WITH:
```typescript
      setAgentData({
        id:                   user.id,
        phone:                user.phone_number || "",
        main_balance:         Number(user.main_balance ?? 0),
        game_balance:         Number(user.game_balance ?? 0),
        vip_level:            user.vip_level || 0,
        invite_code:          user.referral_code || "",
        total_bets:           Number(stats.lifetime_deposits ?? 0),
        created_at:           user.created_at || "",
        direct_members:       Number(stats.total_team_members ?? 0),
        team_members:         Number(stats.active_members ?? 0),
        yesterday_commission: Number(stats.total_commission ?? 0),
        status:               "active",
        is_agent:             Boolean(user.is_agent),
        invited_members:      (invitedMembers || []).map((m: any) => ({
          id:           m.id,
          invite_code:  m.referral_code || "",
          phone_number: m.phone_number || "",
          created_at:   m.created_at || "",
          total_deposit: Number(m.total_deposit || 0),
          total_bets:   Number(m.total_bets || 0),
        })),
      });
```

### FIELD MAPPINGS:
- `stats.total_bets` → `stats.lifetime_deposits`
- `stats.total_members` → `stats.total_team_members`
- `stats.total_members` → `stats.active_members`
- `stats.today_commission` → `stats.total_commission`

---

## CHANGE 3: Update Stats Display Labels (Optional)

### FIND THIS SECTION (around line 380-390):
```typescript
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Direct Members", value: agentData.direct_members, color: "text-white" },
          { label: "Active Members",   value: agentData.team_members,   color: "text-green-400" },
          { label: "Today Commission",     value: `Rs ${agentData.yesterday_commission.toLocaleString()}`, color: "text-orange-500" },
        ].map(s => (
```

### REPLACE WITH (for clarity):
```typescript
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Members", value: agentData.direct_members, color: "text-white" },
          { label: "Active Members",   value: agentData.team_members,   color: "text-green-400" },
          { label: "Total Commission",     value: `Rs ${agentData.yesterday_commission.toLocaleString()}`, color: "text-orange-500" },
        ].map(s => (
```

---

## SUMMARY OF CHANGES

| Line | Old Value | New Value |
|------|-----------|-----------|
| ~115 | `get_agent_dashboard_stats` | `get_agent_management_stats` |
| ~116 | `dashStats` | `mgmtStats` |
| ~117 | `dashError` | `mgmtError` |
| ~118 | `dashError` | `mgmtError` |
| ~119 | `teamDepositData` | (removed) |
| ~120 | `teamError` | (removed) |
| ~121 | `teamDeposits` | (removed) |
| ~152 | `stats.total_bets` | `stats.lifetime_deposits` |
| ~156 | `stats.total_members` | `stats.total_team_members` |
| ~157 | `stats.total_members` | `stats.active_members` |
| ~158 | `stats.today_commission` | `stats.total_commission` |

---

## VERIFICATION

After making changes, verify:

1. **Compile Check**
   ```bash
   npm run build
   ```

2. **Runtime Check**
   - Search for an agent
   - Verify stats display real values (not 0)
   - Check that numeric UID displays correctly

3. **Database Check**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'get_agent_management_stats';
   ```

---

## ROLLBACK

If needed, revert to:
- `get_agent_dashboard_stats()` RPC
- Old field mappings

But this is NOT recommended as the new function provides more accurate data.
