# Clear and Re-Import Environment Variables in Vercel

## Step 1: Delete All Current Environment Variables

1. Go to https://vercel.com/dashboard
2. Select project: **winwave-w8gb**
3. Click **Settings** tab
4. Click **Environment Variables** in left sidebar
5. For EACH variable shown, click the trash icon to delete it
   - Delete all variables one by one

## Step 2: Re-Import from .env File

### Option A: Manual Import (Recommended)
Copy each line from `.env.vercel` file and add to Vercel:

```
VITE_SUPABASE_URL=https://stsemiuoqwfowgbbnjhu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjQwNjQsImV4cCI6MjA5ODgwMDA2NH0.z3FcP0V28aiYYalHWeSSt66Rx0BB-ptrX8NcmCSLiDM
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyNDA2NCwiZXhwIjoyMDk4ODAwMDY0fQ.YHdWBkW4xXumEFykb7w5FEFEaSOv0FY1b_4G7MYpmGk
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzIyNDA2NCwiZXhwIjoyMDk4ODAwMDY0fQ.YHdWBkW4xXumEFykb7w5FEFEaSOv0FY1b_4G7MYpmGk
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

For each line:
1. Click "Add New"
2. Paste the key name (e.g., `VITE_SUPABASE_URL`)
3. Paste the value
4. Click "Save"

### Option B: Using Vercel CLI (If Available)
```bash
vercel env pull .env.vercel
vercel env import .env.vercel
```

## Step 3: Verify Variables Are Set
1. In Vercel dashboard, you should see all 15 variables listed
2. Check that none are empty

## Step 4: Redeploy
1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Select **Redeploy**
4. Wait for deployment to complete (should take 1-2 minutes)

## Step 5: Test the Endpoint
After redeployment completes, test:

```javascript
// Test 1: Health check
fetch("https://winclub-officiall.vercel.app/api/health")
  .then(r => r.json())
  .then(data => console.log("Health:", data))
  .catch(err => console.error("Error:", err))

// Test 2: Payout endpoint
fetch("https://winclub-officiall.vercel.app/api/payout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    withdrawal_id: "test-id", 
    adminSecretToken: "ww-admin-mutation-key-2025-secure-change-in-production" 
  })
})
.then(r => r.json())
.then(data => console.log("Payout Response:", data))
.catch(err => console.error("Error:", err))
```

Expected responses:
- Health: `{ status: 'ok', timestamp: '...' }`
- Payout: `{ success: false, error: "Target transaction record not found." }` (because test-id doesn't exist)

## Troubleshooting

If you still get 500 error:
1. Check Vercel Function Logs:
   - Go to Deployments → Click latest deployment → Function Logs
   - Look for error messages
2. Verify all variables are set correctly
3. Check that SERVICE_ROLE_KEY is not empty
4. Ensure no typos in variable names

## Important Notes
- Variable names are CASE-SENSITIVE
- Do NOT include quotes around values
- Do NOT include comments in Vercel dashboard
- After adding variables, you MUST redeploy for changes to take effect
