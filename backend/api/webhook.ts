import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { supabase } from '../database/db';

// Webhook secret for signature verification (set in environment)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.PKPAY_WEBHOOK_SECRET || '';

function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured, skipping signature verification');
    return true; // Skip verification if not configured
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const receivedSignature = (signature || '').toLowerCase();
    const expected = expectedSignature.toLowerCase();

    if (receivedSignature.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expected));
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

export default async function handler(req: Request, res: Response) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    const rawBody = JSON.stringify(payload);
    const signature = req.headers['x-pkpay-signature'] as string || req.headers['x-signature'] as string || '';

    console.log('Incoming PKPay Webhook Payload:', payload);

    // 0. Signature Verification
    if (!verifySignature(rawBody, signature)) {
      console.error('Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 1. Basic Data Validation
    if (!payload || !payload.order_id || !payload.amount || !payload.user_id) {
      return res.status(400).json({ error: 'Missing required payload fields' });
    }

    // 2. Check Success Status from Gateway
    const successStatuses = ['success', 'completed', '1', 'paid', 'approved'];
    if (successStatuses.includes((payload.status || '').toLowerCase())) {
      const userId = payload.user_id;
      const amount = parseFloat(payload.amount);
      const gatewayRef = payload.sys_order_id || payload.order_id;

      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // 3. Compute wagering multiplier (default 1x)
      const wageringMultiplier = parseFloat(process.env.WAGERING_MULTIPLIER || '1');
      const wageringAmount = amount * wageringMultiplier;

      // 4. Calculate bonus (2% if enabled)
      const bonusEnabled = (process.env.DEPOSIT_BONUS_ENABLED || 'true') === 'true';
      const bonus = bonusEnabled ? amount * 0.02 : 0;
      const totalCredit = amount + bonus;

      // 5. Use RPC to atomically increment user's main_balance and wagering_required in public.users
      try {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('increment_user_deposit', {
          p_user_id: userId,
          p_amount: amount,
          p_bonus: bonus,
          p_wagering: wageringAmount
        });

        if (rpcErr) {
          console.error('RPC increment_user_deposit failed:', rpcErr);
          return res.status(500).json({ error: 'Failed to update balances' });
        }
      } catch (e) {
        console.error('RPC call error:', e);
        return res.status(500).json({ error: 'Failed to update balances (rpc error)' });
      }

      // 6. Log successful transaction into transactions table
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          type: 'deposit',
          amount: amount,
          bonus: bonus,
          status: 'completed',
          gateway_ref: gatewayRef,
          created_at: new Date().toISOString()
        }]);

      if (txError) {
        console.error('Warning: Transaction logged but failed to insert transactions row:', txError);
      }

      return res.status(200).send('SUCCESS');
    }

    return res.status(200).send('ORDER_NOT_SUCCESSFUL');
  } catch (error: any) {
    console.error('Webhook Internal Server Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}