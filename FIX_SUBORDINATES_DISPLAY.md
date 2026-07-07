// FIX FOR InviteesOverviewView.tsx - Replace fetchSubordinates function

const fetchSubordinates = useCallback(async () => {
  if (!uid) return;
  setSubordinatesLoading(true);
  try {
    console.log('[InviteesOverview] Fetching subordinates for uid:', uid);
    
    // Fetch all members (direct invites)
    const { data: allMembers, error: membersError } = await (adminSupabase as any)
      .from("users")
      .select("id, uid_short, vip_level, created_at, total_deposit")
      .eq("referred_by", uid)
      .order("created_at", { ascending: false });

    if (membersError) {
      console.error('[InviteesOverview] Members fetch error:', membersError);
      throw membersError;
    }

    console.log('[InviteesOverview] Found members:', allMembers?.length || 0);

    // Calculate yesterday's date range
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    const yesterdayEnd = new Date(today.getTime());

    const results = await Promise.all(
      (allMembers || []).map(async (member: any) => {
        // Get YESTERDAY's deposits only
        const { data: deposits } = await (adminSupabase as any)
          .from("deposit_history")
          .select("amount")
          .eq("user_id", member.id)
          .eq("status", "completed")
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", yesterdayEnd.toISOString());

        const yesterdayDeposit = (deposits || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

        console.log(`[InviteesOverview] Member ${member.uid_short}: yesterday deposit = ${yesterdayDeposit}`);

        return {
          id: member.id,
          uid_short: member.uid_short || '',
          level: Number(member.vip_level || 0),
          today_deposit: yesterdayDeposit,
          today_commission: 0,
          registration_date: member.created_at,
        };
      })
    );

    let filtered = results;
    if (searchId.trim()) {
      const searchTerm = searchId.trim().toLowerCase();
      filtered = results.filter((sub) => {
        const uidMatch = (sub.uid_short || '').toLowerCase().includes(searchTerm);
        return uidMatch;
      });
    }

    console.log('[InviteesOverview] Subordinates after filter:', filtered.length);
    setSubordinates(filtered);
  } catch (err) {
    console.error('[InviteesOverview] fetchSubordinates failed:', err);
    setSubordinates([]);
  } finally {
    setSubordinatesLoading(false);
  }
}, [uid, searchId]);

// ════════════════════════════════════════════════════════════════════════════════

// Also update the table header to show "Yesterday Deposit" instead of "Today Deposit"

// Find this line in the table header:
// <span className="text-center">Today Deposit</span>

// Replace with:
// <span className="text-center">Yesterday Deposit</span>

// And update the display to show yesterday's data:
// <span className="text-green-400 font-bold text-[11px]">
//   {fmt(sub.today_deposit)}
// </span>

// This will now show yesterday's deposit amount
