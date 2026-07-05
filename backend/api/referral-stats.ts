import { Router } from 'express';
import { supabase, supabaseAdmin } from '../database/db';

const router = Router();

/**
 * Optimized endpoint to fetch referral statistics
 * Reduces RAM usage by using efficient queries and limiting data transfer
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { level, dateRange } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const client = supabaseAdmin || supabase;

    // Build level filter - fetch IDs at each level
    let targetIds: string[] = [userId];
    let currentLevelIds = [userId];

    const maxLevel = level && level !== 'All' ? parseInt(level as string) : 7;

    for (let i = 1; i <= maxLevel; i++) {
      const { data: levelUsers, error } = await client
        .from('users')
        .select('id')
        .in('referred_by', currentLevelIds);

      if (error) throw error;

      const levelIds = (levelUsers || []).map((u: any) => u.id);
      targetIds.push(...levelIds);
      currentLevelIds = levelIds;

      if (levelIds.length === 0) break;
    }

    const { data: directUsers, error: directError } = await client
      .from('users')
      .select('id')
      .eq('referred_by', userId);

    if (directError) throw directError;

    if (targetIds.length === 1) {
      return res.json({
        success: true,
        stats: {
          total_users: 0,
          total_deposits: 0,
          total_bets: 0,
          deposit_users: 0,
          bettor_users: 0,
        }
      });
    }

    // Fetch deposit stats with date filter
    let depositQuery = client
      .from('deposit_history')
      .select('user_id, amount, status')
      .in('user_id', targetIds)
      .eq('status', 'success');

    if (dateRange) {
      const [from, to] = (dateRange as string).split(',');
      if (from) depositQuery = depositQuery.gte('created_at', from);
      if (to) depositQuery = depositQuery.lt('created_at', to);
    }

    const { data: deposits, error: depositError } = await depositQuery;

    if (depositError) throw depositError;

    // Fetch bet stats with date filter
    let betQuery = client
      .from('betting_history')
      .select('user_id, amount')
      .in('user_id', targetIds);

    if (dateRange) {
      const [from, to] = (dateRange as string).split(',');
      if (from) betQuery = betQuery.gte('created_at', from);
      if (to) betQuery = betQuery.lt('created_at', to);
    }

    const { data: bets, error: betError } = await betQuery;

    if (betError) throw betError;

    // Calculate stats efficiently
    const depositUsers = new Set((deposits || []).map((d: any) => d.user_id));
    const bettorUsers = new Set((bets || []).map((b: any) => b.user_id));

    const totalDeposits = (deposits || []).reduce((sum, d: any) => sum + Number(d.amount), 0);
    const totalBets = (bets || []).reduce((sum, b: any) => sum + Number(b.amount), 0);

    res.json({
      success: true,
      stats: {
        total_users: (directUsers || []).length,
        total_deposits: totalDeposits,
        total_bets: totalBets,
        deposit_users: depositUsers.size,
        bettor_users: bettorUsers.size,
      }
    });

  } catch (error: any) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

/**
 * Optimized endpoint to fetch subordinates list
 * Returns only necessary fields to reduce memory usage
 */
router.get('/subordinates/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { level, search } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const client = supabaseAdmin || supabase;

    // Build hierarchy
    let allSubordinates: any[] = [];
    let currentLevelIds = [userId];
    const maxLevel = level && level !== 'All' ? parseInt(level as string) : 7;

    for (let i = 1; i <= maxLevel; i++) {
      const { data: users, error } = await client
        .from('users')
        .select('id, invite_code, total_deposit, total_bets, created_at, phone_number, referred_by')
        .in('referred_by', currentLevelIds);

      if (error) throw error;

      const levelUsers = (users || []).map((u: any) => ({ ...u, level: i }));
      allSubordinates.push(...levelUsers);

      currentLevelIds = (users || []).map((u: any) => u.id);
      if (currentLevelIds.length === 0) break;
    }

    // Apply search filter if provided
    if (search) {
      const searchTerm = (search as string).toUpperCase();
      allSubordinates = allSubordinates.filter((sub: any) => {
        const uidMatch = (sub.invite_code || '').toUpperCase().includes(searchTerm);
        const idMatch = sub.id.toUpperCase().includes(searchTerm);
        return uidMatch || idMatch;
      });
    }

    // Map to minimal format
    const subordinates = allSubordinates.map((sub: any) => ({
      id: sub.id,
      uid: sub.invite_code || sub.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
      level: sub.level,
      deposit_amount: Number(sub.total_deposit || 0),
      commission: Number(sub.total_bets || 0) * 0.005,
      created_at: sub.created_at,
      phone_number: sub.phone_number,
    }));

    res.json({
      success: true,
      subordinates,
      total: subordinates.length
    });

  } catch (error: any) {
    console.error('Error fetching subordinates:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch subordinates' });
  }
});

router.get('/invitees/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to, search, limit, offset } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const client = supabaseAdmin || supabase;
    const pageSize = Math.max(1, Math.min(100, Number(limit || 20)));
    const pageOffset = Math.max(0, Number(offset || 0));

    let query = client
      .from('users')
      .select('id, phone_number, referral_code, invite_code, total_bets, account_status, created_at, referred_by', { count: 'exact' })
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', String(from));
    if (to) query = query.lt('created_at', String(to));
    if (search) {
      const term = String(search).trim();
      query = query.or(`phone_number.ilike.%${term}%,referral_code.ilike.%${term}%,invite_code.ilike.%${term}%,id.ilike.%${term}%`);
    }

    const { data, error, count } = await query.range(pageOffset, pageOffset + pageSize - 1);

    if (error) throw error;

    return res.json({
      success: true,
      invitees: data || [],
      total: count ?? (data || []).length,
    });
  } catch (error: any) {
    console.error('Error fetching invitees:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invitees' });
  }
});

export default router;