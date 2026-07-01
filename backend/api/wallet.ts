import { Router } from 'express';
import { supabase } from '../database/db';

const router = Router();

// POST /wallet/transfer
// body: { user_id, from_type, to_type, amount }
router.post('/transfer', async (req, res) => {
  try {
    const { user_id, from_type, to_type, amount } = req.body;
    if (!user_id || !from_type || !to_type || !amount) return res.status(400).json({ ok: false, error: 'Missing parameters' });
    const p_amount = Number(amount);
    if (!Number.isFinite(p_amount) || p_amount <= 0) return res.status(400).json({ ok: false, error: 'Invalid amount' });

    // If transferring from game -> main, check wagering requirement
    if (from_type === 'game_balance' && to_type === 'main_balance') {
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('total_bets, wagering_required')
        .eq('id', user_id)
        .maybeSingle();

      if (userErr) {
        console.error('Failed to fetch user wagering info:', userErr);
        return res.status(500).json({ ok: false, error: 'Failed to validate wagering requirement' });
      }

      const totalBets = Number(userRow?.total_bets || 0);
      const wageringRequired = Number(userRow?.wagering_required || 0);

      if (totalBets < wageringRequired) {
        const remaining = wageringRequired - totalBets;
        return res.status(400).json({ ok: false, error: `Please complete wagering requirement (Need to Bet: ${remaining})`, remaining });
      }
    }

    // Call RPC for atomic transfer
    const { data, error } = await supabase.rpc('transfer_balance', {
      p_from_type: from_type,
      p_to_type: to_type,
      p_amount: p_amount,
      p_user_id: user_id,
    });

    if (error) {
      console.error('transfer_balance rpc error:', error);
      return res.status(400).json({ ok: false, error: error.message || 'Transfer failed' });
    }

    return res.json({ ok: true, result: data });
  } catch (err: any) {
    console.error('wallet transfer failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// POST /wallet/bind
// body: { user_id, method: 'easypaisa'|'jazzcash'|'usdt', name, account, remarks }
router.post('/bind', async (req, res) => {
  try {
    const { user_id, method, name, account, remarks } = req.body;
    if (!user_id || !method || !name || !account) return res.status(400).json({ ok: false, error: 'Missing parameters' });

    // Check for duplicate account in other users
    const orClause = `wallet_details->>easypaisa.eq.${account},wallet_details->>jazzcash.eq.${account},wallet_details->>usdt.eq.${account}`;
    const { data: conflict, error: conflictErr } = await supabase
      .from('users')
      .select('id')
      .or(orClause)
      .limit(1);

    if (conflictErr) {
      console.error('Error checking wallet uniqueness:', conflictErr);
      return res.status(500).json({ ok: false, error: 'Failed to validate wallet uniqueness' });
    }

    if (conflict && conflict.length > 0 && conflict[0].id !== user_id) {
      return res.status(400).json({ ok: false, error: 'Wallet already bound to another account' });
    }

    // Fetch existing wallet_details
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('wallet_details')
      .eq('id', user_id)
      .maybeSingle();

    if (userErr) {
      console.error('Failed to fetch user wallet_details:', userErr);
      return res.status(500).json({ ok: false, error: 'Failed to fetch user data' });
    }

    const current = userRow?.wallet_details || {};
    if (current && current[method]) {
      return res.status(400).json({ ok: false, error: 'Wallet already bound' });
    }

    const newDetails = {
      ...current,
      [method]: { name, account, remarks: remarks || null },
    };

    const { error: updateErr } = await supabase
      .from('users')
      .update({ wallet_details: newDetails })
      .eq('id', user_id);

    if (updateErr) {
      console.error('Failed to persist wallet_details:', updateErr);
      return res.status(500).json({ ok: false, error: 'Failed to save wallet details' });
    }

    return res.json({ ok: true, wallet_details: newDetails });
  } catch (err: any) {
    console.error('wallet bind failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
