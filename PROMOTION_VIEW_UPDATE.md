// UPDATE FOR PromotionView.tsx - Replace the fetchStats function

// Add this to the useEffect that fetches stats:

const fetchStats = async () => {
  if (!uid) return;

  setLoadingStats(true);
  setStatsError(null);

  try {
    // Fetch Direct Invites past 24h stats
    const { data: directStats, error: directError } = await (adminSupabase as any)
      .rpc('get_direct_invites_past_24h', { p_agent_id: uid });

    if (directError) throw directError;

    const directData = directStats?.[0] || {};

    // Fetch Team Invites past 24h stats
    const { data: teamStats, error: teamError } = await (adminSupabase as any)
      .rpc('get_team_invites_past_24h', { p_agent_id: uid });

    if (teamError) throw teamError;

    const teamData = teamStats?.[0] || {};

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
