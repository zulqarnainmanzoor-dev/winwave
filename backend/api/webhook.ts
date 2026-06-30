import { createClient } from '@supabase/supabase-js';
import { Request, Response } from 'express';

// Initialize Supabase Client using Service Role Key to bypass RLS safely on backend
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: Request, res: Response) {
  // Sirf POST requests allow karenge
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log("Incoming PKPay Webhook Payload:", payload);

    // 1. Basic Data Validation
    if (!payload || !payload.order_id || !payload.amount || !payload.user_id) {
      return res.status(400).json({ error: 'Missing required payload fields' });
    }

    // Note: Secure Signature verification calculation can be added here if required by PKPay
    
    // 2. Check Success Status from Gateway (Handling both JazzCash & Easypaisa via unified endpoint)
    if (payload.status === 'success' || payload.status === 'completed' || payload.status === '1') {
      const userId = payload.user_id;
      const amount = parseFloat(payload.amount);
      const gatewayRef = payload.sys_order_id || payload.order_id;

      // 3. User ka existing wallet fetch karo
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('main_balance')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        console.error("Wallet not found for user UID:", userId);
        return res.status(404).json({ error: 'Wallet record missing' });
      }

      // 4. Balance update calculate karo with 2% Bonus
      const bonus = amount * 0.02; // Calculate 2% of the deposit
      const totalCredit = amount + bonus; // Combine amount and bonus

      const newBalance = Number(wallet.main_balance) + totalCredit;

      // wallets table update
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ main_balance: newBalance })
        .eq('user_id', userId);

      if (updateError) {
        console.error("Database update failed for wallet:", updateError);
        return res.status(500).json({ error: 'Failed to update user balance' });
      }

      // 5. Transactions table mein successful 'move_in' log karo
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          type: 'move_in',
          amount: amount,
          status: 'completed',
          gateway_ref: gatewayRef,
          created_at: new Date().toISOString()
        }]);

      if (txError) {
        console.error("Warning: Transaction logged in wallets but failed to log in transactions history:", txError);
      }

      // Gateway expects a standard response to stop retrying
      return res.status(200).send('SUCCESS');
    }

    return res.status(200).send('ORDER_NOT_SUCCESSFUL');
  } catch (error: any) {
    console.error("Webhook Internal Server Error:", error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}