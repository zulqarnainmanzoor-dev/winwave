import { Router } from 'express';
import { supabase } from '../database/db';
import registerRouter from './register';
import membersRouter from './members';
import depositWebhookHandler from './deposit-webhook';
import walletRouter from './wallet';
import withdrawRouter from './withdraw';
import wingoRouter from './wingo';
import payoutRouter from './payout';
import referralStatsRouter from './referral-stats';
import { getDeviceContext, logSecurityEvent } from './security';
import webhookTestRouter from './webhook-test';

// Startup log: canonical public webhook endpoint for PKPay deposit
console.log("PKPay Deposit Webhook:", "/api/webhook/deposit");
console.log("PKPay Payout Webhook:", "/api/webhook/payout");
console.log("Webhook Test Endpoint:", "/api/webhook/test");

const router = Router();

router.use('/', registerRouter);
router.use('/members', membersRouter);
// Webhook routes (canonical)
router.post('/webhook/deposit', depositWebhookHandler);
router.use('/payout', payoutRouter);
router.use('/webhook/test', webhookTestRouter);

// Legacy compatibility alias (forward internally; do not maintain separate implementation)
router.post('/webhooks/pkpay', (req, res, next) => {
  req.url = '/webhook/deposit';
  return depositWebhookHandler(req, res, next);
});

router.use('/wallet', walletRouter);
router.use('/withdraw', withdrawRouter);
router.use('/wingo', wingoRouter);

// Optimized referral stats endpoints
router.use('/referral', referralStatsRouter);

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  const context = getDeviceContext(req, req.body);
  if (!phone || !password) {
    return res.status(400).json({ ok: false, error: 'Phone and password are required' });
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');

  // Demo account shortcut for local testing and easy access
  if (normalizedPhone === '1234567890' && password === 'demo.user') {
    await logSecurityEvent('login_success', normalizedPhone, context, { demoAccount: true });
    return res.json({ ok: true, user: { id: 'demo-user', email: 'user_1234567890@winwave.com', phone_number: normalizedPhone }, wallet: { main_balance: 150, wagering_required: 0 } });
  }

  try {
    const email = `user_${normalizedPhone}@winwave.com`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      await logSecurityEvent('login_failed', normalizedPhone, context, { reason: error?.message || 'Login failed' });
      return res.status(401).json({ ok: false, error: error?.message || 'Login failed' });
    }

    const userId = data.user.id;
    const [{ data: profileData, error: profileError }, { data: walletData, error: walletError }] = await Promise.all([
      supabase.from('users').select('phone_number, referral_code').eq('id', userId).maybeSingle(),
      supabase.from('wallets').select('main_balance, wagering_required').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileError) {
      console.warn('Failed to load profile on login', profileError);
    }
    if (walletError) {
      console.warn('Failed to load wallet on login', walletError);
    }

    await logSecurityEvent('login_success', normalizedPhone, context, { userId });
    return res.json({
      ok: true,
      user: {
        id: userId,
        email: data.user.email ?? '',
        phone_number: profileData?.phone_number || normalizedPhone,
        referral_code: profileData?.referral_code || '',
      },
      wallet: {
        main_balance: walletData?.main_balance ?? 0,
        wagering_required: walletData?.wagering_required ?? 0,
      },
    });
  } catch (err: any) {
    console.error('login failed', err);
    return res.status(500).json({ ok: false, error: err?.message || 'login_failed' });
  }
});

// Example API endpoint
router.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example POST request
router.post('/user-data', async (req, res) => {
  const { userId } = req.body;
  res.json({ message: 'User data requested' });
});

/**
 * Reset 'My History' for users inactive for > 7 days
 * This function can be called by a cron job or admin trigger
 */
export const cleanupInactiveUserHistory = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Identify inactive users
    const { data: inactiveUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .lt('last_active', sevenDaysAgo.toISOString());

    if (userError) throw userError;

    if (inactiveUsers && inactiveUsers.length > 0) {
      const userIds = inactiveUsers.map(u => u.id);

      // 2. Delete history for these users
      const { error: deleteError } = await supabase
        .from('bets')
        .delete()
        .in('user_id', userIds);

      if (deleteError) throw deleteError;
      
      console.log(`Cleaned up history for ${userIds.length} inactive users.`);
      return userIds.length;
    }
    return 0;
  } catch (err) {
    console.error('Cleanup job failed:', err);
    throw err;
  }
};

// Admin endpoint to trigger manual cleanup
router.post('/admin/cleanup-history', async (req, res) => {
  try {
    const count = await cleanupInactiveUserHistory();
    res.json({ success: true, message: `Cleaned up ${count} users` });
  } catch (err) {
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

router.post('/game-rounds/force-outcome', async (req, res) => {
  const { gameType, outcome } = req.body;
  if (!gameType || !['wingo', 'k3', 'trx', '5d'].includes(gameType)) {
    return res.status(400).json({ error: 'Invalid gameType' });
  }
  if (!outcome || !['BIG', 'SMALL'].includes(outcome)) {
    return res.status(400).json({ error: 'Invalid outcome' });
  }

  try {
    const tableCandidates = ['game_records', 'game_rounds'];
    let activeRound: { id: string } | null = null;
    let activeTable = '';

    for (const tableName of tableCandidates) {
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .eq('game_type', gameType)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1);

      if (!error && data?.[0]?.id) {
        activeRound = data[0];
        activeTable = tableName;
        break;
      }
    }

    if (!activeRound || !activeTable) {
      return res.status(404).json({ error: 'No active round available' });
    }

    const updatePayloads = [
      { forced_outcome: outcome, manual_result: outcome },
      { manual_result: outcome },
      { forced_outcome: outcome },
    ];

    let updateError: any = null;
    for (const payload of updatePayloads) {
      const { error } = await supabase.from(activeTable).update(payload).eq('id', activeRound.id);
      if (!error) {
        return res.json({ success: true, roundId: activeRound.id, forcedOutcome: outcome });
      }
      updateError = error;
    }

    console.error('Error setting forced outcome', updateError);
    return res.status(500).json({ error: 'Unable to set forced outcome' });
  } catch (err: any) {
    console.error('Force outcome error', err);
    return res.status(500).json({ error: err?.message || 'Error forcing outcome' });
  }
});

export default router;

