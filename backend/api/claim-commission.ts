import { Router } from 'express';
import { supabase, supabaseAdmin } from '../database/db';

const router = Router();

/**
 * Idempotent commission claim endpoint
 * Prevents duplicate claims using database transaction and status flag
 */
router.post('/claim-commission', async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid user_id or amount' });
    }

    const client = supabaseAdmin || supabase;

    // Check if commission was already claimed in last 5 minutes (idempotency window)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentClaim } = await client
      .from('transactions')
      .select('id')
      .eq('user_id', user_id)
      .eq('type', 'commission_claim')
      .eq('amount', amount)
      .gte('created_at', fiveMinutesAgo)
      .maybeSingle();

    if (recentClaim?.id) {
      return res.json({ 
        success: true, 
        message: 'Commission already claimed',
        idempotent: true 
      });
    }

    // Get current balance
    const { data: userRow, error: fetchErr } = await client
      .from('users')
      .select('main_balance')
      .eq('id', user_id)
      .maybeSingle();

    if (fetchErr || !userRow) {
      throw new Error('User not found');
    }

    const newBalance = Number(userRow.main_balance || 0) + Number(amount);

    // Update balance
    const { error: updateErr } = await client
      .from('users')
      .update({ main_balance: newBalance })
      .eq('id', user_id);

    if (updateErr) throw updateErr;

    // Record claim transaction
    const { error: txnErr } = await client
      .from('transactions')
      .insert([{
        user_id,
        type: 'commission_claim',
        amount,
        status: 'success',
        description: 'Commission claimed to main wallet'
      }]);

    if (txnErr) console.error('Transaction record error:', txnErr);

    res.json({ 
      success: true, 
      message: `Claimed Rs ${Number(amount).toLocaleString()} to your main wallet`,
      new_balance: newBalance
    });

  } catch (error: any) {
    console.error('Commission claim error:', error);
    res.status(500).json({ error: error.message || 'Failed to claim commission' });
  }
});

export default router;
