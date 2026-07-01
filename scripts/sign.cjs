const crypto = require('crypto');
const secret = process.argv[2];
const payload = process.argv[3] || '';
if (!secret || !payload) {
  console.error('Usage: node sign.cjs <secret> <payload>');
  process.exit(1);
}
console.log(crypto.createHmac('sha256', secret).update(payload).digest('hex'));
