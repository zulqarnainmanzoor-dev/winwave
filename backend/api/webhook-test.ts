import { Router } from 'express';

const router = Router();

// Test endpoint to verify webhook is reachable
router.get('/test', (req, res) => {
  console.log('✅ Webhook test endpoint hit');
  res.json({
    success: true,
    message: 'Webhook endpoint is reachable',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    headers: req.headers,
  });
});

// Echo endpoint to test POST requests
router.post('/echo', (req, res) => {
  console.log('✅ Webhook echo endpoint hit');
  console.log('Request body:', req.body);
  console.log('Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'Webhook echo received',
    timestamp: new Date().toISOString(),
    body: req.body,
    headers: req.headers,
  });
});

export default router;