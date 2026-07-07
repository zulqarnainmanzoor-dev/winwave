import { Router } from 'express';
import { supabaseAdmin } from '../database/db';
import { createPKPayCheckout } from '../lib/pkpay-api';

const router = Router();

router.post('/', async (req: any, res) => {
  const { amount, method } = req.body;
  const userId = req.user?.id || req.body.userId; // From auth middleware or body

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!amount || !method) {
    return res.status(400).json({ error: 'Missing amount or method' });
  }

  if (!['jazzcash', 'easypaisa'].includes(method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  try {
    console.log(`[create-checkout] Creating checkout: user=${userId}, amount=${amount}, method=${method}`);

    // Generate order ID
    const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create deposit record
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from('deposit_history')
      .insert([
        {
          user_id: userId,
          amount,
          method: method.toUpperCase(),
          order_id: orderId,
          pkpay_order_id: null, // Will be filled by PKPay API
          status: 'pending',
          remarks: `PKPay deposit via ${method.toUpperCase()}. Amount Rs ${amount}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (depositError) {
      console.error('[create-checkout] Failed to create deposit record:', depositError);
      return res.status(500).json({ error: 'Failed to create deposit record' });
    }

    console.log(`[create-checkout] Deposit record created: ${deposit.id}`);

    // Create PKPay checkout
    const returnUrl = `${process.env.APP_URL || 'https://winclub-officiall.vercel.app'}/#/deposit-return?order_id=${orderId}`;
    const notifyUrl = `${process.env.API_URL || 'https://winclub-officiall.vercel.app/api'}/webhook/deposit`;

    const checkoutResult = await createPKPayCheckout({
      amount,
      orderId,
      userId,
      method: method as 'jazzcash' | 'easypaisa',
      returnUrl,
      notifyUrl,
    });

    if (!checkoutResult.success) {
      console.error('[create-checkout] Failed to create PKPay checkout:', checkoutResult.error);
      
      // Mark deposit as failed
      await supabaseAdmin
        .from('deposit_history')
        .update({ status: 'failed', remarks: `Failed to create checkout: ${checkoutResult.error}` })
        .eq('id', deposit.id);

      return res.status(500).json({ error: checkoutResult.error });
    }

    // Update deposit with PKPay order ID
    const { error: updateError } = await supabaseAdmin
      .from('deposit_history')
      .update({
        pkpay_order_id: checkoutResult.pkpayOrderId,
        gateway_ref: checkoutResult.checkoutUrl,
      })
      .eq('id', deposit.id);

    if (updateError) {
      console.error('[create-checkout] Failed to update deposit:', updateError);
    }

    console.log(`[create-checkout] ✅ Checkout created: ${checkoutResult.checkoutUrl}`);

    return res.json({
      success: true,
      checkoutUrl: checkoutResult.checkoutUrl,
      orderId,
      pkpayOrderId: checkoutResult.pkpayOrderId,
    });
  } catch (error: any) {
    console.error('[create-checkout] Exception:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
});

export default router;
