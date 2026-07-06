# Vercel Environment Variables - SAFE TO ADD

## Important: Only Add These Variables to Vercel

Vercel is warning about `VITE_` prefixed keys because they get exposed to the browser. Here's what's safe:

### ✅ SAFE TO ADD (These are OK to be public or server-side only)

```
VITE_SUPABASE_URL=https://stsemiuoqwfowgbbnjhu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjQwNjQsImV4cCI6MjA5ODgwMDA2NH0.z3FcP0V28aiYYalHWeSSt66Rx0BB-ptrX8NcmCSLiDM
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyNDA2NCwiZXhwIjoyMDk4ODAwMDY0fQ.YHdWBkW4xXumEFykb7w5FEFEaSOv0FY1b_4G7MYpmGk
SUPABASE_JWKS_URL=https://stsemiuoqwfowgbbnjhu.supabase.co/auth/v1/.well-known/jwks.json
ADMIN_SECRET_ID=3399944
ADMIN_INTERNAL_MUTATION_KEY=ww-admin-mutation-key-2025-secure-change-in-production
Merchant_ID=23809862
Pay_in_API_key=759a92901b180045ff4b3f728ebfa0fe150dffc6a00845fc
Pay_in_API_secret=02ef341fe5ce9d56d7a678182998803ca1f3817ce0538539f25574151b35b1ee
Payout_API_key=f3b49d2ee8626b29b87b749a60441f6bb42a0f82f108de27
Payout_API_secret=fd15ac098353d2890ba348b90c75b1b88fad9c65b4835404f23b8a51790dfb6d
Webhook_secret=dc10753b34618089c66d653c6521d6fa90ee891a6cbe17de8e18d99b4a02786f
WINGO_HMAC_SECRET=ww-hmac-2025-secure-key-change-in-prod
RESULT_STORE_KEY=a3f8c2e1d4b7a9f0e2c5d8b1a4f7c0e3d6b9a2f5c8e1d4b7a0f3c6e9d2b5a8f1
PORT=3000
NODE_ENV=production
SMART_RISK_ENABLED=true
```

### ❌ DO NOT ADD (These should NOT be in Vercel)

- `VITE_SUPABASE_SERVICE_ROLE_KEY` - This is a SECRET, remove VITE_ prefix
- `VITE_API_PROXY_TARGET` - This is for local development only
- `NEXT_PUBLIC_*` variables - These are for Next.js, not needed for Vercel serverless

## Why the Warning?

Vercel warns about `VITE_` prefixed variables because:
- `VITE_` prefix means the variable gets exposed to the browser (client-side)
- Service role keys should NEVER be exposed to the browser
- They should only be available on the server

## What I Changed

1. Removed `VITE_` prefix from `SUPABASE_SERVICE_ROLE_KEY` → now just `SERVICE_ROLE_KEY`
2. Updated `db.ts` to look for `SERVICE_ROLE_KEY` (without VITE_ prefix)
3. This keeps the secret safe on the server only

## Steps to Fix in Vercel

1. Go to https://vercel.com/dashboard
2. Select **winwave-w8gb** project
3. Go to **Settings → Environment Variables**
4. **Delete** any variables with `VITE_SUPABASE_SERVICE_ROLE_KEY`
5. **Add** `SERVICE_ROLE_KEY` (without VITE_ prefix) with the same value
6. Add all other variables from the list above
7. **Redeploy** the project

## Verification

After adding variables, you should see:
- ✅ No warnings about sensitive keys
- ✅ 15 total environment variables
- ✅ No empty values

Then test:
```javascript
fetch("https://winclub-officiall.vercel.app/api/health")
  .then(r => r.json())
  .then(data => console.log(data))
```

Should return: `{ status: 'ok', timestamp: '...' }`
