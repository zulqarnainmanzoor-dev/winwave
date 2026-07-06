# Fix 500 Error - Vercel Environment Variables Setup

## Problem
The 500 error with "A server e..." is because **Vercel doesn't load .env files**. Environment variables must be set in the Vercel dashboard.

## Solution - Set Environment Variables in Vercel Dashboard

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com/dashboard
2. Click on your project: **winwave-w8gb**
3. Go to **Settings** tab
4. Click **Environment Variables** in the left sidebar

### Step 2: Add Each Variable
For each variable below, click "Add New" and paste:

**Supabase Configuration:**
```
VITE_SUPABASE_URL = https://stsemiuoqwfowgbbnjhu.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjQwNjQsImV4cCI6MjA5ODgwMDA2NH0.z3FcP0V28aiYYalHWeSSt66Rx0BB-ptrX8NcmCSLiDM
SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyNDA2NCwiZXhwIjoyMDk4ODAwMDY0fQ.YHdWBkW4xXumEFykb7w5FEFEaSOv0FY1b_4G7MYpmGk
```

**Admin Security:**
```
ADMIN_SECRET_ID = 3399944
ADMIN_INTERNAL_MUTATION_KEY = ww-admin-mutation-key-2025-secure-change-in-production
```

**PKPay Payment Gateway:**
```
Merchant_ID = 23809862
Payout_API_key = f3b49d2ee8626b29b87b749a60441f6bb42a0f82f108de27
Payout_API_secret = fd15ac098353d2890ba348b90c75b1b88fad9c65b4835404f23b8a51790dfb6d
Pay_in_API_key = 759a92901b180045ff4b3f728ebfa0fe150dffc6a00845fc
Pay_in_API_secret = 02ef341fe5ce9d56d7a678182998803ca1f3817ce0538539f25574151b35b1ee
Webhook_secret = dc10753b34618089c66d653c6521d6fa90ee891a6cbe17de8e18d99b4a02786f
```

**WinGo Game Engine:**
```
WINGO_HMAC_SECRET = ww-hmac-2025-secure-key-change-in-prod
RESULT_STORE_KEY = a3f8c2e1d4b7a9f0e2c5d8b1a4f7c0e3d6b9a2f5c8e1d4b7a0f3c6e9d2b5a8f1
```

### Step 3: Redeploy
1. After adding all variables, go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Select **Redeploy**
4. Wait for deployment to complete

### Step 4: Test the Endpoint
After redeployment, test with:
```javascript
fetch("https://winclub-officiall.vercel.app/api/health")
  .then(r => r.json())
  .then(data => console.log("Health:", data))
  .catch(err => console.error("Error:", err))
```

Should return: `{ status: 'ok', timestamp: '...' }`

Then test payout:
```javascript
fetch("https://winclub-officiall.vercel.app/api/payout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    withdrawal_id: "test-id", 
    adminSecretToken: "ww-admin-mutation-key-2025-secure-change-in-production" 
  })
})
.then(r => r.json())
.then(data => console.log("Response:", data))
.catch(err => console.error("Error:", err))
```

Should return: `{ success: false, error: "Target transaction record not found." }` (because test-id doesn't exist)

## Why This Fixes It
- Vercel reads environment variables from the dashboard, not from .env files
- Without these variables, the Supabase client fails to initialize
- This causes the handler to crash with a 500 error
- Setting them in Vercel dashboard makes them available to the serverless function
