# 🎮 Wingo Backend - Visual Quick Reference

## 🚀 Start Here (Choose Your Path)

```
┌─────────────────────────────────────────────────────────────┐
│                    WINGO BACKEND SOLUTION                   │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  I want to...   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐         ┌──────────┐        ┌──────────┐
   │ Get     │         │ Setup    │        │ Deploy   │
   │ Started │         │ Locally  │        │ to Prod  │
   │ (5 min) │         │ (10 min) │        │ (30 min) │
   └────┬────┘         └────┬─────┘        └────┬─────┘
        │                   │                   │
        ▼                   ▼                   ▼
   Read:              Read:                 Read:
   QUICK_START        DEPLOYMENT            AWS_GUIDE
```

---

## 📋 5-Minute Quick Start

### Step 1: Start Backend (Terminal 1)
```bash
cd "c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww"
npm run serve:server
```
✅ Output: `✅ Wingo Backend Server running on http://localhost:3000`

### Step 2: Create Tunnel (Terminal 2)
```bash
ngrok http 3000
```
✅ Output: `Forwarding https://xxxx-xx-xxx-xxx.ngrok.io -> http://localhost:3000`

### Step 3: Update Vercel
```
1. Go to https://vercel.com/dashboard
2. Select winwave project
3. Settings → Environment Variables
4. Add:
   REACT_APP_BACKEND_URL = https://xxxx-xx-xxx-xxx.ngrok.io
   REACT_APP_WS_URL = wss://xxxx-xx-xxx-xxx.ngrok.io
5. Redeploy
```

### Step 4: Test
```
✅ Open https://winclub-officiall.vercel.app
✅ Place a bet
✅ See balance deduct
✅ Wait for round to end
✅ See result popup
```

---

## 🏗️ Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  VERCEL FRONTEND                                             │
│  https://winclub-officiall.vercel.app                       │
│  ├─ React UI                                                │
│  ├─ User Auth                                               │
│  ├─ Bet Placement                                           │
│  └─ Balance Display                                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ HTTPS + WebSocket (via ngrok tunnel)                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  LOCAL BACKEND SERVER                                        │
│  http://localhost:3000                                       │
│  ├─ Express API                                             │
│  ├─ WebSocket Server                                        │
│  ├─ Game Engine                                             │
│  └─ Bet Processing                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ SQL (Supabase)                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  SUPABASE DATABASE                                           │
│  ├─ game_rounds (pg_cron)                                   │
│  ├─ betting_history                                         │
│  ├─ users (balance)                                         │
│  └─ Triggers (auto-update)                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎮 Game Flow Diagram

```
TIME: 10:00:00

┌─────────────────────────────────────────────────────────────┐
│ 1. ROUND GENERATION (Supabase pg_cron)                      │
│    Every 30s/1m/3m/5m                                       │
│    ├─ Create new game_rounds                                │
│    ├─ Set ends_at = NOW() + interval                        │
│    └─ Status: active                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND POLLS (Every 5 seconds)                         │
│    GET /api/round/active/30s                                │
│    ├─ Backend fetches from Supabase                         │
│    ├─ Returns current round                                 │
│    └─ Frontend displays countdown                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. USER PLACES BET (10:00:15)                               │
│    POST /api/bet                                            │
│    ├─ Check balance                                         │
│    ├─ Deduct amount                                         │
│    ├─ Insert betting_history                                │
│    └─ Broadcast via WebSocket                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ROUND ENDS (10:00:30)                                    │
│    Supabase pg_cron                                         │
│    ├─ Round status → completed                              │
│    ├─ Calculate result (Big/Small/Color/Number)             │
│    ├─ Update betting_history                                │
│    │  ├─ is_win = true/false                                │
│    │  └─ win_amount = calculated                            │
│    ├─ Trigger: Update user balance                          │
│    └─ Broadcast round_completed                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. FRONTEND SHOWS RESULT                                    │
│    WebSocket: round_completed                               │
│    ├─ Show popup with result                                │
│    ├─ Display win/loss amount                               │
│    ├─ Update balance                                        │
│    └─ Play animation                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoints Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│ GET /api/round/active/:mode                                 │
│ Get current active round for a game mode                    │
│ Response: { success: true, round: {...} }                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GET /api/rounds/active                                      │
│ Get all active rounds                                       │
│ Response: { success: true, rounds: [...] }                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ POST /api/bet                                               │
│ Place a bet                                                 │
│ Body: { userId, roundId, period, betType, betValue, amount }│
│ Response: { success: true, bet: {...}, newBalance: 900 }    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ POST /api/admin/round/target                                │
│ Set round result (admin only)                               │
│ Body: { period, targetResult, adminKey }                    │
│ Response: { success: true }                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GET /health                                                 │
│ Check backend health                                        │
│ Response: { status: "ok", timestamp: "..." }                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 WebSocket Messages

```
┌─────────────────────────────────────────────────────────────┐
│ SUBSCRIBE TO ROUND                                          │
│ { "type": "subscribe_round", "mode": "30s" }                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ BET PLACED                                                  │
│ { "type": "bet_placed", "userId": "...", "amount": 100 }    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ROUND COMPLETED                                             │
│ {                                                           │
│   "type": "round_completed",                                │
│   "result": {                                               │
│     "number": 7,                                            │
│     "size": "Big",                                          │
│     "color": "red"                                          │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ROUND TARGET SET                                            │
│ { "type": "round_target_set", "period": "...", "target": "BIG" }
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Environment Variables

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL (.env.local)                                          │
├─────────────────────────────────────────────────────────────┤
│ PORT=3000                                                   │
│ ADMIN_KEY=dev_admin_key_12345                               │
│ SUPABASE_URL=https://your-project.supabase.co              │
│ SUPABASE_SERVICE_ROLE_KEY=your_key_here                     │
│ VITE_BACKEND_URL=http://localhost:3000                      │
│ VITE_WS_URL=ws://localhost:3000                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION (Vercel Dashboard)                               │
├─────────────────────────────────────────────────────────────┤
│ REACT_APP_BACKEND_URL=https://xxxx-xx-xxx-xxx.ngrok.io     │
│ REACT_APP_WS_URL=wss://xxxx-xx-xxx-xxx.ngrok.io            │
│ VITE_SUPABASE_URL=https://your-project.supabase.co         │
│ VITE_SUPABASE_ANON_KEY=your_anon_key_here                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Troubleshooting Quick Guide

```
PROBLEM                          SOLUTION
─────────────────────────────────────────────────────────────
Backend won't start              Check port 3000 in use
                                 Kill process: taskkill /PID <PID> /F
                                 Try different port: PORT=3001

WebSocket connection fails       ✅ Backend running
                                 ✅ ngrok tunnel active
                                 ✅ Vercel env updated
                                 ✅ Frontend redeployed

Balance not updating             ✅ Check Supabase triggers
                                 ✅ Check betting_history table
                                 ✅ Monitor backend logs

ngrok URL changes                Use ngrok auth token
                                 Or deploy to production

Rounds not generating            ✅ Check pg_cron enabled
                                 ✅ Check fn_tick_game_rounds()
                                 ✅ Check Supabase logs
```

---

## ✅ Verification Checklist

```
SETUP
  ☐ Backend running: npm run serve:server
  ☐ ngrok tunnel active: ngrok http 3000
  ☐ Vercel env variables updated
  ☐ Frontend redeployed

TESTING
  ☐ Can access https://winclub-officiall.vercel.app
  ☐ WebSocket connected (check browser console)
  ☐ Can place bets
  ☐ Balance updates correctly
  ☐ Rounds generating every 30s/1m/3m/5m
  ☐ Results showing in popup
  ☐ Win/loss amounts correct
  ☐ Admin controls working
```

---

## 📚 Documentation Map

```
START HERE
    │
    ├─ QUICK START (5 min)
    │  └─ WINGO_BACKEND_QUICK_START.md
    │
    ├─ FULL SETUP (30 min)
    │  └─ WINGO_BACKEND_DEPLOYMENT.md
    │
    ├─ ARCHITECTURE (10 min)
    │  └─ WINGO_SOLUTION_OVERVIEW.md
    │
    ├─ IMPLEMENTATION (20 min)
    │  └─ IMPLEMENTATION_SUMMARY.md
    │
    └─ PRODUCTION (60 min)
       └─ AWS EC2 / Railway / Render guides
```

---

## 🚀 Production Deployment Options

```
┌──────────────────────────────────────────────────────────────┐
│ OPTION 1: AWS EC2 (Recommended)                              │
├──────────────────────────────────────────────────────────────┤
│ ✅ Full control                                              │
│ ✅ Scalable                                                  │
│ ✅ Cost-effective                                            │
│ ⏱️  Setup time: 30 minutes                                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ OPTION 2: Railway.app                                        │
├──────────────────────────────────────────────────────────────┤
│ ✅ Easy setup                                                │
│ ✅ Auto-deploy from GitHub                                  │
│ ✅ Free tier available                                       │
│ ⏱️  Setup time: 10 minutes                                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ OPTION 3: Render.com                                         │
├──────────────────────────────────────────────────────────────┤
│ ✅ Similar to Railway                                        │
│ ✅ Free tier available                                       │
│ ✅ Good performance                                          │
│ ⏱️  Setup time: 10 minutes                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎮 Game Ready!

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ✅ Backend Server Ready                                    │
│  ✅ Frontend Connected                                      │
│  ✅ Real-time Updates Working                               │
│  ✅ Game Engine Running                                     │
│  ✅ Bets Processing                                         │
│  ✅ Balance Updating                                        │
│  ✅ Admin Controls Available                                │
│  ✅ Production Deployment Options Ready                     │
│                                                              │
│  🚀 YOUR WINGO GAME IS READY TO LAUNCH! 🚀                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📞 Quick Links

- **GitHub**: https://github.com/zulqarnainmanzoor-dev/winwave
- **Frontend**: https://winclub-officiall.vercel.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **ngrok**: https://ngrok.com

---

**Happy Gaming! 🎮**

Last Updated: 2025-01-15
Status: ✅ Complete and Ready
