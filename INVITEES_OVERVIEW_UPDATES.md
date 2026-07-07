// UPDATE FOR InviteesOverviewView.tsx
// Replace the subordinates list display section

// In the subordinates table, replace the display with:

{subordinates.map((sub) => (
  <div key={sub.id} className="grid grid-cols-5 p-3 text-xs text-center items-center hover:bg-white/[0.02] transition-colors">
    <span className="font-mono text-white font-bold text-[11px]">{sub.uid_short}</span>
    <span className="text-center">
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
        sub.level === 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'
      }`}>
        {sub.level}
      </span>
    </span>
    {/* REAL DEPOSIT AMOUNT - PAST 24 HOURS */}
    <span className="text-green-400 font-bold text-[11px]">
      Rs {(sub.today_deposit || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
    <span className="text-[#ffa502] font-bold text-[11px]">
      Rs {(sub.today_commission || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
    <span className="text-gray-400 text-[10px]">{new Date(sub.registration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
  </div>
))}

// Update the table header to show "Today Deposit" instead of "Today Deposit":

<div className="grid grid-cols-5 bg-[#252528] p-2.5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
  <span className="text-center">UID</span>
  <span className="text-center">Level</span>
  <span className="text-center">Today Deposit (24h)</span>
  <span className="text-center">Commission</span>
  <span className="text-center">Registered</span>
</div>

════════════════════════════════════════════════════════════════════════════════

// UPDATE FOR InviteesOverviewView.tsx - Invitees Tab
// Replace the invitees card display with:

{invitees.map((invitee) => (
  <div key={invitee.id} className="rounded-3xl border border-white/5 bg-[#1C1C1E] p-4 shadow-[0_8px_16px_rgba(0,0,0,0.35)]">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">UID</div>
        <div className="text-sm font-black text-white">{invitee.uid_short || "—"}</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Phone</div>
        <div className="text-sm font-black text-white">{invitee.phone_number || "—"}</div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="rounded-2xl bg-black/20 p-2">
        <div className="uppercase text-gray-500">Lifetime Deposit</div>
        <div className="mt-1 font-semibold text-green-400">
          Rs {(invitee.total_deposit || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="rounded-2xl bg-black/20 p-2">
        <div className="uppercase text-gray-500">Total Bets</div>
        <div className="mt-1 font-semibold text-white">
          Rs {(invitee.total_bets || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
    <div className="mt-2 text-[10px] text-gray-400">
      Registered: {new Date(invitee.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </div>
  </div>
))}

════════════════════════════════════════════════════════════════════════════════

// UPDATE FOR PromotionView.tsx - Commission Claiming
// Replace handleClaimCommission with:

const handleClaimCommission = async () => {
  if (!uid) {
    setClaimMessage('Please log in first.');
    return;
  }

  setClaimingCommission(true);
  setClaimMessage(null);

  try {
    // Check if can claim today
    const { data: claimCheck, error: checkError } = await (adminSupabase as any)
      .rpc('can_claim_commission_today', { p_agent_id: uid });

    if (checkError) throw checkError;

    const check = claimCheck?.[0];

    if (!check?.can_claim) {
      setClaimMessage(
        `You can only claim commission once per 24 hours. Next claim available at: ${new Date(check?.next_claim_at).toLocaleString()}`
      );
      setClaimingCommission(false);
      return;
    }

    if (!check?.total_commission || check.total_commission <= 0) {
      setClaimMessage('No commission available to claim.');
      setClaimingCommission(false);
      return;
    }

    // Claim commission
    const { data: claimResult, error: claimError } = await (adminSupabase as any)
      .rpc('claim_commission_daily', { p_agent_id: uid });

    if (claimError) throw claimError;

    const result = claimResult?.[0];

    if (result?.success) {
      setBalance(balance + Number(result.claimed_amount || 0));
      setTotalCommissions(0);
      setClaimMessage(result?.message || 'Commission claimed successfully!');
    } else {
      setClaimMessage(result?.message || 'Failed to claim commission.');
    }
  } catch (err: any) {
    console.error('Commission claim error:', err);
    setClaimMessage(err?.message || 'Unable to claim commission right now.');
  } finally {
    setClaimingCommission(false);
    setTimeout(() => setClaimMessage(null), 5000);
  }
};

════════════════════════════════════════════════════════════════════════════════

// UPDATE FOR PromotionView.tsx - Claim Button
// Update the claim button to show next claim time:

const [nextClaimTime, setNextClaimTime] = useState<string | null>(null);

// Add this to fetchStats or create a new effect:

useEffect(() => {
  if (!uid) return;

  const checkClaimStatus = async () => {
    try {
      const { data, error } = await (adminSupabase as any)
        .rpc('can_claim_commission_today', { p_agent_id: uid });

      if (error) throw error;

      const check = data?.[0];
      if (!check?.can_claim && check?.next_claim_at) {
        setNextClaimTime(new Date(check.next_claim_at).toLocaleTimeString());
      } else {
        setNextClaimTime(null);
      }
    } catch (err) {
      console.error('Error checking claim status:', err);
    }
  };

  checkClaimStatus();
  const interval = setInterval(checkClaimStatus, 60000); // Check every minute
  return () => clearInterval(interval);
}, [uid]);

// Update button:

<button
  onClick={handleClaimCommission}
  disabled={claimingCommission || !uid || !Number(totalCommissions) || nextClaimTime !== null}
  className="w-full py-3.5 bg-[#1f2937] border border-orange-500/30 hover:border-orange-400 transition-all rounded-full font-black text-sm tracking-widest text-orange-400 flex items-center justify-center gap-2 uppercase disabled:opacity-60"
>
  {claimingCommission 
    ? "Claiming..." 
    : nextClaimTime 
    ? `Next claim at ${nextClaimTime}`
    : "Claim Commission to Main Wallet"}
</button>
