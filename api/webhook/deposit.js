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
    const successStatuses = ['success', 'completed', '1', 'paid', 'approved'];

    if (!payload.user_id || !payload.amount) {
      return res.status(400).json({ ok: false, error: 'Missing user_id or amount' });
    }

    if (!successStatuses.includes((payload.status || '').toLowerCase())) {
      return res.status(200).send('ORDER_NOT_SUCCESSFUL');
    }

    const userId = payload.user_id;
    const amount = parseFloat(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }

    const bonus = parseFloat((amount * 0.02).toFixed(2));
    const totalCredited = amount + bonus;
    // Wagering = deposit + 2% bonus (user must bet this much before withdrawing)
    const newWageringRequired = totalCredited;

    // 1. Fetch current user balances
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('main_balance, wagering_required')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !user) {
      console.error('User fetch failed:', fetchErr);
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const currentBalance = parseFloat(user.main_balance ?? 0);
    const currentWagering = parseFloat(user.wagering_required ?? 0);

    // 2. Update main_balance and wagering_required
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        main_balance: parseFloat((currentBalance + totalCredited).toFixed(2)),
        wagering_required: parseFloat((currentWagering + newWageringRequired).toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('Balance update failed:', updateErr);
      return res.status(500).json({ ok: false, error: 'Failed to update balance' });
    }

    // 3. Log transaction as completed
    const { error: txErr } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'deposit',
      amount,
      bonus,
      status: 'completed',
      gateway_ref: payload.order_id || null,
      created_at: new Date().toISOString(),
    });

    if (txErr) console.warn('Transaction log failed (non-fatal):', txErr.message);

    console.log(`✅ Deposit credited: user=${userId} amount=${amount} bonus=${bonus} wagering_added=${newWageringRequired}`);
    return res.status(200).send('SUCCESS');

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
};
