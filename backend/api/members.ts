import { Router } from 'express';
import { supabase } from '../database/db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone_number, referral_code, referred_by');

    if (error) {
      return res.status(500).json({ error: error.message || 'Unable to load members' });
    }

    return res.json({ members: data || [] });
  } catch (err: any) {
    console.error('members failed', err);
    return res.status(500).json({ error: 'Failed to load members' });
  }
});

export default router;
