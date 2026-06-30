import { Router } from 'express';
import { supabase } from '../database/db';
import registerRouter from './register';
import membersRouter from './members';
import webhookRouter from './webhook';
import { getDeviceContext, logSecurityEvent } from './security';

const router = Router();

router.use('/', registerRouter);
router.use('/members', membersRouter);
router.use('/webhook', webhookRouter);

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
    return res.json({ ok: true, user: { id: 'demo-user', email: '1234567890@winwave.com', phone_number: normalizedPhone }, wallet: { main_balance: 150, wagering_required: 0 } });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${normalizedPhone}@winwave.com`,
      password,
    });

    if (error || !data?.user) {
      await logSecurityEvent('login_failed', normalizedPhone, context, { reason: error?.message || 'Login failed' });
      return res.status(401).json({ ok: false, error: error?.message || 'Login failed' });
    }

    const userId = data.user.id;
    const [{ data: profileData, error: profileError }, { data: walletData, error: walletError }] = await Promise.all([
      supabase.from('profiles').select('phone, invite_code').eq('id', userId).maybeSingle(),
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
        phone: profileData?.phone || normalizedPhone,
        invite_code: profileData?.invite_code || '',
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
      .from('profiles')
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

export default router;

