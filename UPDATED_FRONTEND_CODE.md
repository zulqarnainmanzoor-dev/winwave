════════════════════════════════════════════════════════════════════════════════
UPDATED FRONTEND CODE - PAST 24 HOURS DEPOSIT DATA
════════════════════════════════════════════════════════════════════════════════

FILE 1: src/components/PromotionView.tsx
═════════════════════════════════════════

Replace the fetchStats function with this:

```typescript
const fetchStats = async () => {
  if (!uid) return;

  setLoadingStats(true);
  setStatsError(null);

  try {
    // Fetch Direct Invites past 24h stats
    const { data: directStats, error: directError } = await (adminSupabase as any)
      .rpc('get_direct_invites_past_24h', { p_agent_id: uid });

    if (directError) throw directError;

    const directData = directStats?.[0] || {
      deposit_users: 0,
      deposit_amount: 0,
      first_deposit_users: 0,
      first_deposit_amount: 0,
    };

    // Fetch Team Invites past 24h stats
    const { data: teamStats, error: teamError } = await (adminSupabase as any)
      .rpc('get_team_invites_past_24h', { p_agent_id: uid });

    if (teamError) throw teamError;

    const teamData = teamStats?.[0] || {
      deposit_users: 0,
      deposit_amount: 0,
      first_deposit_users: 0,
      first_deposit_amount: 0,
    };

    // Fetch direct members count (lifetime)
    const { data: directMembers, error: directMembersError } = await (adminSupabase as any)
      .from('users')
      .select('id')
      .eq('referred_by', uid);

    if (directMembersError) throw directMembersError;

    // Fetch team members count (lifetime)
    let teamCount = 0;
    let currentLevelIds = (directMembers || []).map((u: any) => u.id);

    while (currentLevelIds.length > 0) {
      const { data: nextLevel } = await (adminSupabase as any)
        .from('users')
        .select('id')
        .in('referred_by', currentLevelIds);
      if (!nextLevel || nextLevel.length === 0) break;
      teamCount += nextLevel.length;
      currentLevelIds = nextLevel.map((u: any) => u.id);
    }

    setNetworkStats({
      direct_count: (directMembers || []).length,
      team_count: teamCount,
      direct_deposit_users: Number(directData.deposit_users || 0),
      team_deposit_users: Number(teamData.deposit_users || 0),
      direct_deposit_amount: Number(directData.deposit_amount || 0),
      team_deposit_amount: Number(teamData.deposit_amount || 0),
    });

    setLoadingStats(false);
  } catch (err: any) {
    console.error('❌ [PromotionView] fetchStats failed:', err);
    setStatsError(err?.message || 'Unable to load referral stats.');
    setLoadingStats(false);
  }
};
```

════════════════════════════════════════════════════════════════════════════════

FILE 2: src/components/InviteesOverviewView.tsx
════════════════════════════════════════════════

Replace the fetchStats function with this:

```typescript
const fetchStats = useCallback(async () => {
  if (!uid) return;
  setLoading(true);
  try {
    const { data, error } = await (adminSupabase as any)
      .rpc('get_subordinate_past_24h_stats', { p_agent_id: uid });

    if (error) throw error;

    const result = data?.[0] || {};
    setStats({
      deposit_count: Number(result.deposit_count || 0),
      deposit_amount: Number(result.deposit_amount || 0),
      total_bet: Number(result.total_bet || 0),
      bettor_count: Number(result.deposit_users || 0),
      first_deposit_count: Number(result.first_deposit_users || 0),
      first_deposit_amount: Number(result.first_deposit_amount || 0),
    });
  } catch (err) {
    console.error('[InviteesOverview] fetchStats failed:', err);
    setStats({ 
      deposit_count: 0, 
      deposit_amount: 0, 
      total_bet: 0, 
      bettor_count: 0, 
      first_deposit_count: 0, 
      first_deposit_amount: 0 
    });
  } finally {
    setLoading(false);
  }
}, [uid]);
```

════════════════════════════════════════════════════════════════════════════════

FILE 3: src/admin/pages/AgentManagement.tsx
═════════════════════════════════════════════

In handleFetchAgent function, replace the invited members fetch with:

```typescript
// Fetch invited members with REAL deposit data
const { data: invitedMembersData, error: invitedError } = await (adminSupabase as any)
  .rpc('get_agent_invited_members', { p_agent_id: user.id });

if (invitedError) throw invitedError;

const invitedMembers = (invitedMembersData || []).map((m: any) => ({
  id: m.member_id,
  invite_code: m.member_uid || '',
  phone_number: m.member_phone || '',
  created_at: m.joined_at || '',
  total_deposit: Number(m.lifetime_deposit || 0),
  total_bets: Number(m.total_bets || 0),
  today_deposit: Number(m.today_deposit || 0),
}));

// Then in setAgentData, update invited_members:
setAgentData({
  id: user.id,
  phone: user.phone_number || '',
  main_balance: Number(user.main_balance ?? 0),
  game_balance: Number(user.game_balance ?? 0),
  vip_level: user.vip_level || 0,
  invite_code: user.referral_code || '',
  total_bets: Number(stats.total_bets ?? 0),
  created_at: user.created_at || '',
  direct_members: Number(stats.total_members ?? 0),
  team_members: Number(stats.total_members ?? 0),
  yesterday_commission: Number(stats.today_commission ?? 0),
  status: 'active',
  is_agent: Boolean(user.is_agent),
  invited_members: invitedMembers,  // NOW WITH REAL DATA
});
```

════════════════════════════════════════════════════════════════════════════════

SUMMARY OF CHANGES:
────────────────────

PromotionView:
✓ Calls get_direct_invites_past_24h() for Direct Invites
✓ Calls get_team_invites_past_24h() for Team Invites
✓ Shows past 24h deposit data in carousel

InviteesOverviewView:
✓ Calls get_subordinate_past_24h_stats() for subordinate stats
✓ Shows past 24h deposit data in stats card

AgentManagement:
✓ Calls get_agent_invited_members() for member list
✓ Shows real lifetime and today's deposits

════════════════════════════════════════════════════════════════════════════════
