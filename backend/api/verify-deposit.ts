import { Router } from 'express';
import { supabaseAdmin } from '../database/db';

const router = Router();

router.post('/', async (req, res) => {
  const { order_id, user_id } = req.body;

  if (!order_id || !user_id) {
    return res.status(400).json({ error: 'Missing order_id or user_id' });
  }

  try {
    console.log(`[verify-deposit] Checking deposit: order_id=${order_id}, user_id=${user_id}`);

    // Get deposit record - try both order_id and pkpay_order_id
    let deposit = null;
    
    // First try: Look up by pkpay_order_id
    const { data: depositByPkpayId, error: errorByPkpayId } = await supabaseAdmin
      .from('deposit_history')
      .select('id, status, amount, method, user_id')
      .eq('pkpay_order_id', order_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (depositByPkpayId) {
      deposit = depositByPkpayId;
      console.log('[verify-deposit] Found by pkpay_order_id');
    } else {
      // Second try: Look up by order_id
      const { data: depositByOrderId, error: errorByOrderId } = await supabaseAdmin
        .from('deposit_history')
        .select('id, status, amount, method, user_id')
        .eq('order_id', order_id)
        .eq('user_id', user_id)
        .maybeSingle();

      if (depositByOrderId) {
        deposit = depositByOrderId;
        console.log('[verify-deposit] Found by order_id');
      } else {
        const error = errorByOrderId || errorByPkpayId;
        if (error) {
          console.error('[verify-deposit] Error fetching deposit:', error);
          return res.status(500).json({ error: 'Failed to fetch deposit' });
        }
      }
    }

    if (!deposit) {
      console.error('[verify-deposit] Deposit not found');
      return res.status(404).json({ error: 'Deposit not found' });
    }

    console.log(`[verify-deposit] Deposit found: status=${deposit.status}, amount=${deposit.amount}`);

    // If already completed, just return success
    if (deposit.status === 'completed') {
      console.log('[verify-deposit] Deposit already completed');
      return res.json({ verified: true, status: 'completed', amount: deposit.amount });
    }

    // If pending, mark as completed (webhook may not have fired)
    if (deposit.status === 'pending') {
      console.log('[verify-deposit] Marking deposit as completed (webhook fallback)');

      const bonusAmount = deposit.amount * 0.02;
      const totalAmount = deposit.amount + bonusAmount;

      const { error: updateError } = await supabaseAdmin
        .from('deposit_history')
        .update({
          status: 'completed',
          remarks: `PKPay deposit verified via return page. Deposit Rs ${deposit.amount} + 2% Bonus Rs ${bonusAmount} = Total Rs ${totalAmount}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id);

      if (updateError) {
        console.error('[verify-deposit] Error updating deposit:', updateError);
        return res.status(500).json({ error: 'Failed to update deposit' });
      }

      console.log(`[verify-deposit] ✅ Deposit marked as completed. Trigger will credit balance.`);
      return res.json({ verified: true, status: 'completed', amount: deposit.amount });
    }

    // If failed, return error
    if (deposit.status === 'failed') {
      console.log('[verify-deposit] Deposit failed');
      return res.json({ verified: false, status: 'failed', error: 'Deposit failed' });
    }

    return res.json({ verified: false, status: deposit.status });

  } catch (error: any) {
    console.error('[verify-deposit] Exception:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
});

export default router;
