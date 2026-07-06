# Deployment Strategy: Vercel + Separate WinGo Engine

## Current Situation
- ✅ Local server works perfectly with WinGo engine
- ❌ Vercel can't run 24/7 processes
- ✅ API endpoints work on Vercel
- ❌ WinGo engine needs separate deployment

## Solution: Split Architecture

### Frontend + API (Vercel) ✅
```
https://winclub-officiall.vercel.app
├── Frontend (React app)
├── API endpoints (/api/*)
│   ├── /api/payout
│   ├── /api/webhook/deposit
│   ├── /api/login
│   └── /api/withdraw
└── Database (Supabase)
```

### WinGo Engine (Separate Service) ✅
```
Heroku / Railway / AWS Lambda
├── WinGo game engine (24/7)
├── Generates results every 2 minutes
├── Updates database
└── Database (same Supabase)
```

### Frontend Communication
```
Frontend (Vercel)
├── Call /api/payout (Vercel)
├── Call /api/login (Vercel)
├── Poll /api/game-status (Vercel)
└── Vercel queries database for WinGo results
```

---

## Deployment Options

### Option 1: Heroku (Easiest, but paid)
**Cost:** $7-50/month
**Setup:** 5 minutes
**Pros:** Simple, reliable, good for Node.js
**Cons:** Paid service

**Steps:**
1. Create Heroku account
2. Create new app
3. Connect GitHub repo
4. Set environment variables
5. Deploy

### Option 2: Railway.app (Recommended)
**Cost:** $5-20/month
**Setup:** 10 minutes
**Pros:** Modern, easy, good pricing
**Cons:** Newer platform

**Steps:**
1. Go to railway.app
2. Connect GitHub
3. Select repository
4. Set environment variables
5. Deploy

### Option 3: AWS Lambda + EventBridge (Most complex)
**Cost:** Free tier available
**Setup:** 30 minutes
**Pros:** Scalable, pay-per-use
**Cons:** Complex setup

### Option 4: Render.com (Good alternative)
**Cost:** Free tier available
**Setup:** 10 minutes
**Pros:** Easy, free tier, good for Node.js
**Cons:** Free tier has limitations

---

## Recommended: Railway.app

### Step 1: Prepare Code

Create a new file: `wingo-server.ts`

```typescript
import 'dotenv/config';
import { startWinGoEngine, stopWinGoEngine } from './backend/game-engine/wingoEngine';

console.log('[WinGo Server] Starting...');

// Start the game engine
startWinGoEngine();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WinGo Server] Shutting down...');
  stopWinGoEngine();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WinGo Server] Shutting down...');
  stopWinGoEngine();
  process.exit(0);
});

console.log('[WinGo Server] Running 24/7');
```

### Step 2: Update package.json

Add a new script:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "serve:server": "tsx server.ts",
    "wingo:server": "tsx wingo-server.ts",
    "preview": "vite preview"
  }
}
```

### Step 3: Deploy to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Select your repository
5. Select branch: `main`
6. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_ANON_KEY`
   - `WINGO_HMAC_SECRET`
   - `RESULT_STORE_KEY`
7. Set start command: `npm run wingo:server`
8. Deploy

### Step 4: Update Frontend

The frontend should poll for game results:

```typescript
// In your game component
async function getGameResults() {
  const response = await fetch('https://winclub-officiall.vercel.app/api/game-status');
  const data = await response.json();
  return data.results; // Latest game results from database
}

// Poll every 5 seconds
setInterval(getGameResults, 5000);
```

---

## What Happens After Deployment

### Game Flow
```
1. WinGo engine (Railway) generates result every 2 minutes
2. Result stored in Supabase database
3. Frontend (Vercel) polls /api/game-status every 5 seconds
4. Frontend gets latest result from database
5. Frontend shows winning/losing popup
6. Frontend updates user balance
```

### Deposit Flow
```
1. User deposits via PKPay
2. PKPay webhook → Vercel /api/webhook/deposit
3. Vercel updates database
4. Database trigger credits balance
5. Frontend polls and sees updated balance
```

### Payout Flow
```
1. Admin approves withdrawal
2. Frontend calls Vercel /api/payout
3. Vercel sends to PKPay
4. PKPay webhook updates database
5. Frontend polls and sees updated balance
```

---

## Current Status

### ✅ Working Locally
- WinGo engine generates results
- Deposits credit balance
- Payouts process
- All game logic works

### ✅ Working on Vercel
- API endpoints
- Deposit webhook
- Payout endpoint
- Login/register

### ❌ Not Working on Vercel
- WinGo engine (needs separate deployment)
- Real-time updates (needs polling)

### ✅ Will Work After Deployment
- Everything! 🎉

---

## Next Steps

### Immediate (Today)
1. Fix the 500 error on Vercel (check Function Logs)
2. Test deposit/payout flows
3. Verify all API endpoints work

### Short-term (This week)
1. Create `wingo-server.ts` file
2. Deploy to Railway.app
3. Update frontend to poll for results
4. Test full game flow

### Long-term (Next month)
1. Add real-time WebSocket (optional)
2. Optimize polling frequency
3. Add monitoring and alerts
4. Scale as needed

---

## Cost Breakdown

### Current (Vercel only)
- Vercel: Free tier (or $20/month for pro)
- Supabase: Free tier (or $25/month for pro)
- **Total: $0-45/month**

### After WinGo Deployment
- Vercel: Free tier (or $20/month)
- Supabase: Free tier (or $25/month)
- Railway: $5-20/month
- **Total: $5-65/month**

---

## Summary

**You have two options:**

### Option A: Keep Local Server Running
- Run `npm run serve:server` on your computer 24/7
- Frontend connects to your local IP
- Works but not scalable

### Option B: Deploy to Railway (Recommended)
- Deploy WinGo engine to Railway
- Keep API on Vercel
- Scalable and professional
- Cost: $5-20/month

**I recommend Option B.** It's the proper way to deploy a production app.

Would you like me to help you set up Railway deployment?
