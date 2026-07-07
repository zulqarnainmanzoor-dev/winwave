# 🎮 Wingo Backend - Quick Start Guide

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- ngrok account (free at https://ngrok.com)
- Supabase project setup

---

## 🚀 Quick Start (5 minutes)

### Step 1: Setup Environment

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Backend Server

```bash
npm run serve:server
```

Expected output:
```
✅ Wingo Backend Server running on http://localhost:3000
📡 WebSocket: ws://localhost:3000
🎮 Frontend: https://winclub-officiall.vercel.app
```

### Step 4: Create ngrok Tunnel (New Terminal)

```bash
# Install ngrok (if not already installed)
# Windows: choco install ngrok
# Mac: brew install ngrok

# Create tunnel
ngrok http 3000
```

Expected output:
```
Forwarding                    https://xxxx-xx-xxx-xxx.ngrok.io -> http://localhost:3000
```

### Step 5: Update Vercel Environment

1. Go to https://vercel.com/dashboard
2. Select your project (winwave)
3. Settings → Environment Variables
4. Add/Update:
   - `REACT_APP_BACKEND_URL` = `https://xxxx-xx-xxx-xxx.ngrok.io`
   - `REACT_APP_WS_URL` = `wss://xxxx-xx-xxx-xxx.ngrok.io`
5. Redeploy

### Step 6: Test

Open https://winclub-officiall.vercel.app and:
- ✅ Place a bet
- ✅ See balance deduct
- ✅ Wait for round to end
- ✅ See result popup
- ✅ Balance updates (win/loss)

---

## 📁 Project Structure

```
ww/
├── server.ts                          # Main backend entry point
├── backend/
│   ├── api/
│   │   ├── api.ts                    # Express routes
│   │   ├── payout.ts                 # Payout endpoints
│   │   └── ...
│   ├── database/
│   │   └── db.ts                     # Supabase client
│   ├── lib/
│   │   └── pkpay-api.ts              # Payment gateway
│   └── supabase/
│       └── MASTER_PRODUCTION_SCHEMA.sql
├── src/
│   ├── lib/
│   │   ├── backendConfig.ts          # NEW: Backend URL config
│   │   ├── gameEngine.ts             # NEW: Game engine client
│   │   └── supabaseClient.ts
│   ├── components/
│   │   ├── WinGoGame.tsx             # Game component
│   │   └── ...
│   └── context/
│       └── UserContext.tsx
├── .env.local.example                # NEW: Local env template
├── .env.production.example           # NEW: Production env template
└── WINGO_BACKEND_DEPLOYMENT.md       # NEW: Full guide
```

---

## 🔧 Commands

```bash
# Start backend server
npm run serve:server

# Start frontend (local dev)
npm run dev

# Build frontend
npm run build

# Type check
npm run lint

# Start ngrok tunnel
ngrok http 3000
```

---

## 🌐 Architecture

```
┌─────────────────────────────────────────┐
│  Vercel Frontend                        │
│  https://winclub-officiall.vercel.app  │
└────────────────┬────────────────────────┘
                 │
                 │ HTTPS + WebSocket
                 │ (via ngrok tunnel)
                 │
┌────────────────▼────────────────────────┐
│  Local Backend Server                   │
│  http://localhost:3000                  │
│  ├─ Express API                         │
│  ├─ WebSocket Server                    │
│  └─ Game Engine                         │
└────────────────┬────────────────────────┘
                 │
                 │ SQL
                 │
┌────────────────▼────────────────────────┐
│  Supabase Database                      │
│  ├─ game_rounds                         │
│  ├─ betting_history                     │
│  ├─ users                               │
│  └─ pg_cron (game engine)               │
└─────────────────────────────────────────┘
```

---

## 🎯 Game Flow

### 1. Round Generation (Supabase pg_cron)
```
Every 30s/1m/3m/5m:
  fn_tick_game_rounds() 
    → Creates new game_rounds
    → Completes expired rounds
    → Calculates results
```

### 2. User Places Bet
```
Frontend:
  User clicks "Big" button
    ↓
  POST /api/bet
    ↓
Backend:
  Check balance
  Deduct amount
  Insert betting_history
  Broadcast via WebSocket
    ↓
Frontend:
  Update balance
  Show bet in list
```

### 3. Round Ends
```
Supabase:
  Round status → completed
  Calculate result (Big/Small/Color/Number)
  Update betting_history with result
  Trigger: Credit/Debit user balance
    ↓
Backend:
  Poll for completed rounds
  Broadcast round_completed
    ↓
Frontend:
  Show result popup
  Update balance
  Show win/loss animation
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F

# Try different port
PORT=3001 npm run serve:server
```

### WebSocket connection fails
```
✅ Backend running on http://localhost:3000
✅ ngrok tunnel active
✅ Vercel env variables updated
✅ Frontend redeployed

If still failing:
- Check browser console for errors
- Check backend logs
- Verify ngrok URL is correct
```

### Balance not updating
```
✅ Check Supabase database triggers
✅ Verify user has sufficient balance
✅ Check betting_history table for bets
✅ Monitor backend logs
```

### ngrok URL keeps changing
```
Solution 1: Use ngrok auth token
  ngrok config add-authtoken <token>
  ngrok http 3000
  (URL will be persistent)

Solution 2: Use custom domain (ngrok Pro)
  ngrok http 3000 --domain=your-domain.ngrok.io

Solution 3: Deploy backend to production
  Use AWS EC2, Railway, Render, etc.
```

---

## 📊 Monitoring

### Backend Logs
```
[GameEngine] Initialized
[GameEngine] ✅ WebSocket connected
[GameEngine] 📨 Message: bet_placed
[GameEngine] 💰 Placing bet: size=Big, amount=100
[GameEngine] ✅ Bet placed successfully
```

### Frontend Logs
```
[Backend Config] Environment: PRODUCTION
[Backend Config] Backend URL: https://xxxx-xx-xxx-xxx.ngrok.io
[Backend Config] WebSocket URL: wss://xxxx-xx-xxx-xxx.ngrok.io
```

### Supabase Logs
```
Dashboard → Logs → Edge Functions
Dashboard → Logs → Database
```

---

## 🚀 Production Deployment

### Option 1: AWS EC2 (Recommended)

```bash
# Launch EC2 instance (Ubuntu 22.04)
# SSH into instance

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone https://github.com/your-repo/winwave.git
cd winwave

# Install dependencies
npm install

# Create .env file
nano .env

# Install PM2
npm install -g pm2

# Start server
pm2 start server.ts --name wingo-backend

# Setup auto-restart
pm2 startup
pm2 save

# Get public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Update Vercel env variables
# REACT_APP_BACKEND_URL=http://<EC2_IP>:3000
# REACT_APP_WS_URL=ws://<EC2_IP>:3000
```

### Option 2: Railway.app

```bash
# Connect GitHub repo
# Set environment variables
# Deploy
# Get public URL
```

### Option 3: Render.com

```bash
# Similar to Railway
# Free tier available
```

---

## 📝 Environment Variables

### Local (.env.local)
```
PORT=3000
ADMIN_KEY=dev_admin_key_12345
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_BACKEND_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Production (Vercel Dashboard)
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_WS_URL=wss://your-backend-url.com
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## ✅ Checklist

- [ ] Backend running on localhost:3000
- [ ] ngrok tunnel active
- [ ] Vercel env variables updated
- [ ] Frontend redeployed
- [ ] Can place bets
- [ ] Balance updates correctly
- [ ] WebSocket connected
- [ ] Rounds generating
- [ ] Results showing

---

## 📞 Support

For issues:
1. Check logs (backend terminal, browser console)
2. Verify all services running
3. Check environment variables
4. Restart backend and frontend
5. Check Supabase status

---

**Happy gaming! 🎮**
