# Backend Architecture & Deployment Strategy

## Current Status

### ✅ What's Working
1. **Vercel Serverless Functions** - API routes deployed at `/api/*`
2. **Deposit Webhook** - PKPay deposits trigger balance credit via database trigger
3. **Payout Endpoint** - Processes withdrawals to PKPay gateway
4. **CORS Configuration** - Frontend can call backend APIs
5. **Environment Variables** - Set in Vercel dashboard

### ❌ What's NOT Working on Vercel
1. **`npm run serve:server`** - This is for LOCAL development only
2. **WinGo Game Engine** - Requires 24/7 running process (not serverless)
3. **Real-time Updates** - Betting/winning popups need WebSocket or polling
4. **Balance Deduction/Credit** - Needs to happen in real-time during gameplay

---

## Architecture Explanation

### Local Development (npm run serve:server)
```
User Browser (localhost:5173)
    ↓
Express Server (localhost:3000)
    ├── API Routes (/api/*)
    ├── WinGo Engine (24/7 running)
    ├── WebSocket for real-time updates
    └── Vite middleware for hot reload
```

### Vercel Production (Serverless)
```
User Browser (vercel.app)
    ↓
Vercel Edge Network
    ↓
Serverless Functions (/api/*)
    ├── Deposit webhook handler
    ├── Payout processor
    ├── Login/register
    └── Other API endpoints
    
⚠️ NO 24/7 running process
⚠️ NO WebSocket support
⚠️ NO real-time game engine
```

---

## The Problem: WinGo Game Engine

The WinGo game engine needs to:
1. Generate results every 2 minutes (24/7)
2. Update database with results
3. Notify users in real-time
4. Deduct/credit balances

**Vercel serverless functions CANNOT do this** because:
- Functions only run when called
- No persistent background processes
- No WebSocket support
- Functions timeout after 60 seconds

---

## Solutions for Backend Tasks

### Option 1: Use Vercel Cron Jobs (Recommended for now)
```
- Deploy WinGo engine as separate cron job
- Runs every 2 minutes
- Updates database with results
- Frontend polls for updates (not real-time, but works)
```

### Option 2: Use External Service
```
- AWS Lambda + EventBridge
- Google Cloud Functions + Cloud Scheduler
- Heroku Dyno (paid)
- Railway.app (paid)
```

### Option 3: Hybrid Approach
```
- Vercel for API endpoints
- Separate service for WinGo engine
- Database as source of truth
- Frontend polls database for updates
```

---

## Current Implementation Status

### ✅ Deposit Flow (WORKING)
```
1. User deposits via PKPay
2. PKPay sends webhook to /api/webhook/deposit
3. Webhook marks deposit as "completed"
4. Database trigger trg_deposit_approved fires
5. User's main_balance is credited
6. wagering_required is set
```

### ✅ Payout Flow (WORKING)
```
1. Admin approves withdrawal
2. Frontend calls /api/payout
3. Payout endpoint sends to PKPay
4. PKPay webhook updates status
5. Withdrawal marked as "completed"
```

### ❌ WinGo Game Flow (NOT WORKING on Vercel)
```
1. Game engine generates results every 2 minutes
   ⚠️ PROBLEM: No 24/7 process on Vercel
2. Results stored in database
3. Frontend polls for results
4. User places bet
5. Balance deducted immediately
6. Game result determines win/loss
7. Balance credited if won
   ⚠️ PROBLEM: No real-time updates
```

### ❌ Real-time Updates (NOT WORKING on Vercel)
```
1. User places bet
2. Server should notify user immediately
   ⚠️ PROBLEM: No WebSocket on Vercel
3. User sees winning/losing popup
4. Balance updates in real-time
   ⚠️ PROBLEM: Frontend must poll instead
```

---

## What You Need to Do

### Immediate (To fix 500 error)
1. Check Vercel Function Logs for actual error
2. Ensure all environment variables are set
3. Test `/api/health` endpoint

### Short-term (To get MVP working)
1. **Disable real-time features** for now
2. **Use polling** instead of WebSocket
3. **Deploy WinGo engine separately** (Heroku/Railway)
4. **Test deposit/payout flows** manually

### Long-term (Production-ready)
1. Set up proper game engine service
2. Implement WebSocket for real-time updates
3. Add proper error handling and monitoring
4. Set up database backups and recovery

---

## Recommended Next Steps

### Step 1: Fix the 500 Error
- Check Vercel Function Logs
- Share the error message
- Fix the root cause

### Step 2: Test Core Flows
```javascript
// Test 1: Health check
fetch("https://winclub-officiall.vercel.app/api/health")

// Test 2: Deposit webhook (simulate PKPay)
fetch("https://winclub-officiall.vercel.app/api/webhook/deposit", {
  method: "POST",
  body: JSON.stringify({
    out_trade_no: "test-123",
    status: "success",
    amount: 1000,
    user_id: "user-123",
    sign: "..."
  })
})

// Test 3: Payout endpoint
fetch("https://winclub-officiall.vercel.app/api/payout", {
  method: "POST",
  body: JSON.stringify({
    withdrawal_id: "withdrawal-123",
    adminSecretToken: "ww-admin-mutation-key-2025-secure-change-in-production"
  })
})
```

### Step 3: Deploy WinGo Engine Separately
- Move `backend/game-engine/wingoEngine.ts` to separate service
- Deploy to Heroku/Railway/AWS Lambda
- Have it update database every 2 minutes
- Frontend polls database for results

### Step 4: Implement Polling
- Frontend polls `/api/game-status` every 5 seconds
- Shows results and updates balance
- Not real-time, but works on Vercel

---

## Files That Need Attention

### Working ✅
- `backend/api/deposit-webhook.ts` - Deposit handling
- `backend/api/payout.ts` - Withdrawal handling
- `api/index.ts` - Vercel handler
- `backend/api/api.ts` - Route definitions

### Needs Work ⚠️
- `backend/game-engine/wingoEngine.ts` - Needs separate deployment
- `server.ts` - Only for local development
- Frontend polling logic - Needs implementation

---

## Summary

**The 405/500 errors are routing issues that we're fixing.**

**The bigger issue is that Vercel serverless functions cannot run the WinGo game engine 24/7.**

You need to:
1. Fix the current 500 error (check Function Logs)
2. Deploy WinGo engine to a separate service
3. Have frontend poll for game results instead of real-time updates
4. Test deposit/payout flows manually

Once you share the Function Logs error, I can fix the 500 error immediately.
