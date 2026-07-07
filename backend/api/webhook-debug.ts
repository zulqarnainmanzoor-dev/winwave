import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[WEBHOOK-DEBUG] ${timestamp}`);
  console.log(`${'='.repeat(80)}`);
  
  // Log all headers
  console.log('[WEBHOOK-DEBUG] HEADERS:');
  Object.entries(req.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Log raw body
  console.log('[WEBHOOK-DEBUG] RAW BODY:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Log query params
  console.log('[WEBHOOK-DEBUG] QUERY PARAMS:');
  console.log(JSON.stringify(req.query, null, 2));
  
  // Log method and URL
  console.log(`[WEBHOOK-DEBUG] METHOD: ${req.method}`);
  console.log(`[WEBHOOK-DEBUG] URL: ${req.originalUrl}`);
  console.log(`[WEBHOOK-DEBUG] PATH: ${req.path}`);
  
  console.log(`${'='.repeat(80)}\n`);
  
  // Always return 200 OK so PKPay knows we received it
  return res.status(200).json({ 
    received: true, 
    timestamp,
    note: 'Debug endpoint - check server logs'
  });
});

export default router;
