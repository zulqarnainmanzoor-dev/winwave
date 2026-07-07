// UPDATE FOR AgentManagement.tsx - Replace the invited members fetching section

// In the handleFetchAgent function, replace the invited members fetch with:

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
