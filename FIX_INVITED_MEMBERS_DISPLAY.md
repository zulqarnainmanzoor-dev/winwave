# FIX: Invited Members Display - Show Both Deposit and Total Deposit

## PROBLEM
Invited Members section is only showing:
- UID
- Phone
- Deposit: Rs 0
- Bets: Rs 0

But should show:
- UID
- Phone
- Deposit: Rs X
- Total Deposit: Rs X
- Bets: Rs X
- Commission: Rs X

## SOLUTION

In `src/admin/pages/AgentManagement.tsx`, find the "Invited Members List" section (around line 550-580).

### FIND THIS CODE:
```jsx
{/* Invited Members List */}
{agentData.invited_members && agentData.invited_members.length > 0 && (
  <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
    <h3 className="text-white font-bold text-sm mb-3">Invited Members ({agentData.invited_members.length})</h3>
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {agentData.invited_members.map((member) => (
        <div key={member.id} className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-orange-500 font-bold text-xs font-mono">UID: {member.invite_code}</span>
            <span className="text-gray-400 text-[10px]">{new Date(member.created_at).toLocaleDateString()}</span>
          </div>
          <div className="text-gray-300 text-xs mb-1">Phone: {member.phone_number || "N/A"}</div>
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
        </div>
      ))}
    </div>
  </div>
)}
```

### REPLACE WITH:
```jsx
{/* Invited Members List */}
{agentData.invited_members && agentData.invited_members.length > 0 && (
  <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#0f3460] shadow-lg">
    <h3 className="text-white font-bold text-sm mb-3">Invited Members ({agentData.invited_members.length})</h3>
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {agentData.invited_members.map((member) => (
        <div key={member.id} className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-orange-500 font-bold text-xs font-mono">UID: {member.invite_code}</span>
            <span className="text-gray-400 text-[10px]">{new Date(member.created_at).toLocaleDateString()}</span>
          </div>
          <div className="text-gray-300 text-xs mb-2">Phone: {member.phone_number || "N/A"}</div>
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
        </div>
      ))}
    </div>
  </div>
)}
```

## CHANGES MADE

1. **Changed grid from 2 columns to 4 columns** - Now shows 4 fields instead of 2
2. **Added "Total Deposit" field** - Shows same value as Deposit (both from `member.total_deposit`)
3. **Added "Commission" field** - Shows Rs 0 (can be updated later with real commission data)
4. **Changed mb-1 to mb-2** - Adds more spacing between phone and fields

## RESULT

Now displays:
```
UID: 162334511
Phone: 3198119104
Deposit: Rs 500
Total Deposit: Rs 500
Bets: Rs 53
Commission: Rs 0
```

## NEXT STEPS

1. Open `src/admin/pages/AgentManagement.tsx`
2. Find the Invited Members List section
3. Replace the grid section with the new code above
4. Save and test

The display will now show all 4 fields in a 2x2 grid format.
