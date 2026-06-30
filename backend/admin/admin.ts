import { Router } from 'express';

const router = Router();

// Admin Dashboard Logic
router.get('/', (req, res) => {
  res.send('<h1>Admin Dashboard</h1><p>Welcome to the secure admin area.</p>');
});

router.get('/stats', (req, res) => {
  res.json({ users: 100, deposits: 5000, active: 10 });
});

export default router;
