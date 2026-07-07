import { Router } from 'express';
import { supabaseAdmin } from '../database/db';
import { createPKPayCheckout } from '../lib/pkpay-api';

const router = Router();

router.post('/', async (req: any, res) => {
  const { amount, method, userId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }

  if (!amount || !method) {
    return res.status(400).json({ error: 'Missing amount or method' });
  }

  if (!['jazzcash', 'easypaisa'].includes(method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  try {
    console.log(`[create-checkout] Creating checkout: user=${userId}, amount=${amount}, method=${method}`);

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[create-checkout] Generated order_id: ${orderId}`);

    // Create deposit record with explicit values
    // Normalize values to match expected DB enum/constraints
    // (frontend sends method as lowercase: jazzcash/easypaisa)
    const normalizedMethod = String(method).toLowerCase();

    const depositData = {
      user_id: userId,
      amount: Number(amount),
      method: normalizedMethod,
      order_id: orderId,
      pkpay_order_id: null,
      gateway_ref: null,
      status: 'pending',
      remarks: `PKPay deposit via ${normalizedMethod.toUpperCase()}. Amount Rs ${amount}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[create-checkout] Inserting deposit:', JSON.stringify(depositData));

    const { data: deposit, error: depositError } = await supabaseAdmin
      .from('deposit_history')
      .insert([depositData])
      .select()
      .single();

    if (depositError) {
      console.error('[create-checkout] Failed to create deposit record:', depositError);

      // Log the insert payload and the raw error for fast debugging (406/409 are usually constraint/RLS issues)
      console.error('[create-checkout] Deposit insert payload:', JSON.stringify(depositData));

    console.log(`[create-checkout] ✅ Deposit record created: ${deposit.id}`);

    // Create PKPay checkout
        status: (depositError as any)?.status,
    const returnUrl = `${process.env.APP_URL || 'https://winclub-officiall.vercel.app'}/#/deposit-return?order_id=${orderId}`;

    const notifyUrl = `${process.env.API_URL || 'https://winclub-officiall.vercel.app/api'}/webhook/deposit`;
        error: `Failed to create deposit record: ${depositError.message}`,

      });
    }
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

    // Update deposit with PKPay order ID and checkout URL
    if (checkoutResult.pkpayOrderId || checkoutResult.checkoutUrl) {
      const { error: updateError } = await supabaseAdmin
        .from('deposit_history')
        .update({
          pkpay_order_id: checkoutResult.pkpayOrderId || null,
          gateway_ref: checkoutResult.checkoutUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id);

      if (updateError) {
        console.error('[create-checkout] Failed to update deposit:', updateError);
      }
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
