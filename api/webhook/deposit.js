const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) return true;
  try {
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    if (!signature) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    const raw = JSON.stringify(req.body || {});
    const signature = req.headers['x-pkpay-signature'] || req.headers['x-signature'] || req.headers['signature'];
    if (!verifySignature(raw, String(signature || ''))) {
      console.error('Webhook signature invalid');
      return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }

    const payload = req.body || {};
    const successStatuses = ['success','completed','1','paid','approved'];
    if (!payload || !payload.user_id || !payload.amount) return res.status(400).json({ ok: false, error: 'Missing fields' });
    if (!successStatuses.includes((payload.status || '').toLowerCase())) {
      return res.status(200).send('ORDER_NOT_SUCCESSFUL');
    }

    const userId = payload.user_id;
    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ ok: false, error: 'Invalid amount' });

    const bonus = amount * 0.02;
    const totalCredited = amount + bonus;
    // wagering requirement based on total credited amount (multiplier 1)
    const wagering = totalCredited * 1;

    // Use RPC to increment balances (function created in migrations)
    const { data, error } = await supabase.rpc('increment_user_deposit', {
      p_user_id: userId,
      p_amount: amount,
      p_bonus: bonus,
      p_wagering: wagering,
    });

    if (error) {
      console.error('RPC increment_user_deposit failed:', error);
      return res.status(500).json({ ok: false, error: 'Failed to update user balance' });
    }

    // Log transaction
    try {
      await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount, bonus, status: 'completed', gateway_ref: payload.order_id || null, created_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Failed to log transaction:', e.message || e);
    }

    // Respond with success so gateway can redirect user
    res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
};
