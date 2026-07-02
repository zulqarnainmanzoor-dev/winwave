import { Router } from 'express';
import { supabase, supabaseAdmin } from '../database/db';

const router = Router();

// POST /wallet/transfer
// body: { user_id, from_type, to_type, amount }
router.post('/transfer', async (req, res) => {
  try {
    const { user_id, from_type, to_type, amount } = req.body;
    if (!user_id || !from_type || !to_type || amount == null) {
      return res.status(400).json({ ok: false, error: 'Missing parameters' });
    }

    const p_amount = Number(amount);
    if (!Number.isFinite(p_amount) || p_amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }

    if (from_type === to_type) {
      return res.status(400).json({ ok: false, error: 'from_type and to_type cannot be the same' });
    }

    if (!['main_balance', 'game_balance'].includes(from_type) || !['main_balance', 'game_balance'].includes(to_type)) {
      return res.status(400).json({ ok: false, error: 'Invalid balance types' });
    }

    const { data: walletRow, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('main_balance, game_balance')
      .eq('user_id', user_id)
      .maybeSingle();

    if (walletErr) {
      console.error('Failed to fetch wallet info:', walletErr);
      return res.status(500).json({ ok: false, error: 'Failed to fetch wallet info' });
    }

    if (!walletRow) {
      return res.status(404).json({ ok: false, error: 'Wallet not found for user' });
    }

    const mainBalance = Number(walletRow.main_balance || 0);
    const gameBalance = Number(walletRow.game_balance || 0);
    let newMain = mainBalance;
    let newGame = gameBalance;

    if (from_type === 'main_balance' && to_type === 'game_balance') {
      if (mainBalance < p_amount) {
        return res.status(400).json({ ok: false, error: 'Insufficient main balance' });
      }
      newMain = mainBalance - p_amount;
      newGame = gameBalance + p_amount;
    }

    if (from_type === 'game_balance' && to_type === 'main_balance') {
      if (gameBalance < p_amount) {
        return res.status(400).json({ ok: false, error: 'Insufficient game balance' });
      }

      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('total_bets, wagering_required')
        .eq('id', user_id)
        .maybeSingle();

      if (!userErr && userRow) {
        const totalBets = Number(userRow.total_bets || 0);
        const wageringRequired = Number(userRow.wagering_required || 0);
        if (totalBets < wageringRequired) {
          const remaining = wageringRequired - totalBets;
          return res.status(400).json({ ok: false, error: `Please complete wagering requirement (Need to Bet: ${remaining})`, remaining });
        }
      }

      newMain = mainBalance + p_amount;
      newGame = gameBalance - p_amount;
    }

    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .upsert({ user_id, main_balance: newMain, game_balance: newGame }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('Failed to update wallet balances:', updateError);
      return res.status(500).json({ ok: false, error: 'Failed to update wallet balances' });
    }

    return res.json({ ok: true, result: { main_balance: newMain, game_balance: newGame } });
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
