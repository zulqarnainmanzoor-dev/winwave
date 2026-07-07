// This file contains the FIXED handleClaimCommission function
// Replace the existing handleClaimCommission in PromotionView.tsx with this:

const handleClaimCommission = async () => {
  if (!uid || !Number(totalCommissions)) {
    setClaimMessage('No commission available to claim.');
    return;
  }
  setClaimingCommission(true);
  setClaimMessage(null);
  try {
    const commissionAmount = Number(totalCommissions);
    const response = await fetch('/api/claim-commission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, amount: commissionAmount })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to claim commission');
    }
    const result = await response.json();
    setBalance(balance + commissionAmount);
    setTotalCommissions(0);
    setClaimMessage(`Claimed Rs ${commissionAmount.toLocaleString()} to your main wallet.`);
  } catch (err: any) {
    setClaimMessage(err?.message || 'Unable to claim commission right now.');
  } finally {
    setClaimingCommission(false);
    setTimeout(() => setClaimMessage(null), 4000);
  }
};
