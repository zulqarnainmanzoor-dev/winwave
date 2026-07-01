import { Router } from 'express';
import { supabase } from '../database/db';

const router = Router();

// POST /withdraw
// body: { user_id, amount, account_number, pin }
router.post('/', async (req, res) => {
  try {
    const { user_id, amount, account_number, pin } = req.body;
    if (!user_id || !amount || !account_number || !pin) return res.status(400).json({ ok: false, error: 'Missing parameters' });
    const p_amount = Number(amount);
    if (!Number.isFinite(p_amount) || p_amount <= 0) return res.status(400).json({ ok: false, error: 'Invalid amount' });

    // Verify PIN
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('withdrawal_pin, main_balance, wallet_details')
      .eq('id', user_id)
      .maybeSingle();

    if (userErr) {
      console.error('Failed to fetch user:', userErr);
      return res.status(500).json({ ok: false, error: 'Failed to verify user' });
    }

    if (!userRow) return res.status(404).json({ ok: false, error: 'User not found' });

    const storedPin = userRow.withdrawal_pin || '';
    if (!storedPin) return res.status(400).json({ ok: false, error: 'Withdrawal PIN not set' });
    if (String(pin) !== String(storedPin)) return res.status(401).json({ ok: false, error: 'Invalid PIN' });

    // Verify sufficient balance
    const mainBal = Number(userRow.main_balance || 0);
    if (mainBal < p_amount) return res.status(400).json({ ok: false, error: 'Insufficient main balance' });

    // Deduct balance and insert withdraw request atomically
    // Use RPC or transaction-like sequence
    try {
      // Deduct balance
      const { error: updErr } = await supabase
        .from('users')
        .update({ main_balance: mainBal - p_amount })
        .eq('id', user_id);

      if (updErr) {
        console.error('Failed to deduct main_balance:', updErr);
        return res.status(500).json({ ok: false, error: 'Failed to deduct balance' });
      }

      // Insert withdraw_request
      const { error: insertErr } = await supabase
        .from('withdraw_requests')
        .insert([{ user_id, amount: p_amount, account_number, status: 'pending', created_at: new Date().toISOString() }]);

      if (insertErr) {
        console.error('Failed to insert withdraw request:', insertErr);
        // Attempt to rollback balance deduction (best-effort)
        await supabase.from('users').update({ main_balance: mainBal }).eq('id', user_id);
        return res.status(500).json({ ok: false, error: 'Failed to create withdraw request' });
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error('Withdraw processing failed:', e);
      return res.status(500).json({ ok: false, error: 'Processing error' });
    }
  } catch (err: any) {
    console.error('withdraw endpoint failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
