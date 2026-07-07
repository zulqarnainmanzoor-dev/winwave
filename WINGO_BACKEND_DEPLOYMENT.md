# Wingo Backend Server Deployment Guide
## Running Local Backend with Vercel Frontend

### Problem
- Frontend deployed on Vercel (https://winclub-officiall.vercel.app)
- Backend needs to run locally for:
  - Game round generation (every 30s, 1m, 3m, 5m)
  - Bet processing and validation
  - Balance updates (deduct on bet, credit on win/loss)
  - Real-time WebSocket updates to frontend
  - Admin controls (set round results)

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL FRONTEND                          │
│         https://winclub-officiall.vercel.app                │
│  (React UI, User Authentication, Bet Placement)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS + WebSocket
                     │
┌────────────────────▼────────────────────────────────────────┐
│              LOCAL BACKEND SERVER                           │
│         http://localhost:3000 (or ngrok tunnel)             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Express.js API Server                                │   │
│  │ - POST /api/bet (place bet)                          │   │
│  │ - GET /api/round/active (get current round)          │   │
│  │ - WebSocket /ws (real-time updates)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Game Engine (pg_cron on Supabase)                    │   │
│  │ - Generate rounds every 30s/1m/3m/5m                 │   │
│  │ - Calculate results deterministically                │   │
│  │ - Update betting_history with results                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Supabase Database                                    │   │
│  │ - game_rounds (active, completed)                    │   │
│  │ - betting_history (user bets)                        │   │
│  │ - users (balance, wagering)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Setup Local Backend Server

### 1.1 Create Backend Entry Point

**File: `server.ts`** (already exists, update it)

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { supabaseAdmin } from './backend/database/db';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// CORS for Vercel frontend
app.use(cors({
  origin: [
    'https://winclub-officiall.vercel.app',
    'http://localhost:5173', // local dev
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

// ═══════════════════════════════════════════════════════════
// GAME ROUND ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Get active round for a game mode
app.get('/api/round/active/:mode', async (req, res) => {
  try {
    const { mode } = req.params; // '30s', '1m', '3m', '5m'
    
    const { data, error } = await supabaseAdmin
      .from('game_rounds')
      .select('*')
      .eq('game_type', 'wingo')
      .eq('mode', mode)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return res.json({
      success: true,
      round: data || null,
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[GET /api/round/active] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get all active rounds
app.get('/api/rounds/active', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('game_rounds')
      .select('*')
      .eq('game_type', 'wingo')
      .eq('status', 'active')
      .order('mode', { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      rounds: data || [],
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[GET /api/rounds/active] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// BET ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Place a bet
app.post('/api/bet', async (req, res) => {
  try {
    const { userId, roundId, period, gameType, mode, betType, betValue, amount } = req.body;

    if (!userId || !roundId || !amount || !betType || !betValue) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check user balance
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('main_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.main_balance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient balance' });
    }

    // Deduct balance
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ main_balance: user.main_balance - amount })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Insert bet
    const { data: bet, error: betError } = await supabaseAdmin
      .from('betting_history')
      .insert([{
        user_id: userId,
        round_id: roundId,
        period,
        game_type: gameType || 'wingo',
        mode: mode || '30s',
        bet_type: betType,
        bet_value: betValue,
        amount,
        status: 'pending',
        is_win: false,
        win_amount: 0
      }])
      .select()
      .single();

    if (betError) throw betError;

    // Broadcast to all connected clients
    broadcastToAll({
      type: 'bet_placed',
      userId,
      roundId,
      amount,
      betType,
      betValue
    });

    return res.json({
      success: true,
      bet,
      newBalance: user.main_balance - amount
    });
  } catch (err: any) {
    console.error('[POST /api/bet] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Set round target result (admin only)
app.post('/api/admin/round/target', async (req, res) => {
  try {
    const { period, targetResult, adminKey } = req.body;

    // Simple admin key check (use env variable in production)
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const { error } = await supabaseAdmin
      .from('game_rounds')
      .update({ target_result: targetResult })
      .eq('period', period)
      .eq('status', 'active');

    if (error) throw error;

    broadcastToAll({
      type: 'round_target_set',
      period,
      targetResult
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/admin/round/target] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// WEBSOCKET REAL-TIME UPDATES
// ═══════════════════════════════════════════════════════════

const clients = new Set<any>();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[WebSocket] Message:', data);

      // Handle different message types
      if (data.type === 'subscribe_round') {
        ws.roundMode = data.mode; // Subscribe to specific round mode
      }
    } catch (err) {
      console.error('[WebSocket] Parse error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
  });
});

// Broadcast to all connected clients
function broadcastToAll(data: any) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Broadcast to specific round mode subscribers
export function broadcastRoundUpdate(mode: string, data: any) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1 && client.roundMode === mode) {
      client.send(message);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Wingo Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🎮 Frontend: https://winclub-officiall.vercel.app\n`);
});

export { broadcastToAll, broadcastRoundUpdate };
```

---

## Step 2: Update Frontend to Connect to Local Backend

### 2.1 Create Backend Config

**File: `src/lib/backendConfig.ts`** (NEW)

```typescript
// Detect if running locally or on Vercel
const isProduction = window.location.hostname !== 'localhost';

export const BACKEND_URL = isProduction
  ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

export const WS_URL = isProduction
  ? (process.env.REACT_APP_WS_URL || 'ws://localhost:3000').replace('http', 'ws')
  : 'ws://localhost:3000';

console.log(`[Backend Config] URL: ${BACKEND_URL}`);
console.log(`[Backend Config] WS: ${WS_URL}`);
```

### 2.2 Update Game Engine to Use Backend

**File: `src/lib/gameEngine.ts`** (NEW)

```typescript
import { BACKEND_URL, WS_URL } from './backendConfig';

export class GameEngine {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor(private onRoundUpdate: (data: any) => void) {}

  // Connect to WebSocket
  connect() {
    try {
      console.log(`[GameEngine] Connecting to ${WS_URL}`);
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[GameEngine] WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[GameEngine] Message:', data);
          this.onRoundUpdate(data);
        } catch (err) {
          console.error('[GameEngine] Parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[GameEngine] WebSocket error:', err);
      };

      this.ws.onclose = () => {
        console.log('[GameEngine] WebSocket closed');
        this.attemptReconnect();
      };
    } catch (err) {
      console.error('[GameEngine] Connection error:', err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[GameEngine] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  // Subscribe to round mode
  subscribeToRound(mode: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_round',
        mode
      }));
    }
  }

  // Fetch active round
  async getActiveRound(mode: string) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/round/active/${mode}`);
      const data = await response.json();
      return data.round;
    } catch (err) {
      console.error('[GameEngine] Fetch error:', err);
      return null;
    }
  }

  // Place bet
  async placeBet(userId: string, roundId: string, period: string, betType: string, betValue: string, amount: number) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roundId,
          period,
          gameType: 'wingo',
          mode: '30s', // or dynamic
          betType,
          betValue,
          amount
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('[GameEngine] Bet error:', err);
      throw err;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### 2.3 Update WinGo Game Component

**File: `src/components/WinGoGame.tsx`** (UPDATE)

```typescript
import { useEffect, useState } from 'react';
import { GameEngine } from '../lib/gameEngine';
import { useUser } from '../context/UserContext';

export default function WinGoGame() {
  const { uid, mainWalletBalance, setMainWalletBalance } = useUser();
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
  const [activeRound, setActiveRound] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize game engine
  useEffect(() => {
    const engine = new GameEngine((data) => {
      console.log('[WinGoGame] Update:', data);

      if (data.type === 'round_completed') {
        // Round ended - update bet results
        setActiveRound(null);
        // Fetch updated balance
        // Show results popup
      } else if (data.type === 'bet_placed') {
        // Another user placed bet
        console.log('User placed bet:', data);
      }
    });

    engine.connect();
    engine.subscribeToRound('30s');
    setGameEngine(engine);

    return () => engine.disconnect();
  }, []);

  // Fetch active round
  useEffect(() => {
    if (!gameEngine) return;

    const fetchRound = async () => {
      const round = await gameEngine.getActiveRound('30s');
      setActiveRound(round);
    };

    fetchRound();
    const interval = setInterval(fetchRound, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [gameEngine]);

  // Place bet
  const handlePlaceBet = async (betType: string, betValue: string, amount: number) => {
    if (!gameEngine || !activeRound || !uid) return;

    setLoading(true);
    try {
      const result = await gameEngine.placeBet(
        uid,
        activeRound.id,
        activeRound.period,
        betType,
        betValue,
        amount
      );

      // Update local balance
      setMainWalletBalance(result.newBalance);
      setBets([...bets, result.bet]);

      // Show success toast
      console.log('✅ Bet placed successfully');
    } catch (err: any) {
      console.error('❌ Bet failed:', err.message);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wingo-game">
      {/* Game UI */}
      <div>Active Round: {activeRound?.period}</div>
      <div>Your Balance: Rs {mainWalletBalance}</div>
      <button onClick={() => handlePlaceBet('size', 'Big', 100)} disabled={loading}>
        Place Bet
      </button>
    </div>
  );
}
```

---

## Step 3: Setup ngrok for Public Access

### 3.1 Install ngrok

```bash
# Windows
choco install ngrok

# Or download from https://ngrok.com/download
```

### 3.2 Create ngrok Tunnel

```bash
# Start local backend
npm run serve:server

# In another terminal, create tunnel
ngrok http 3000

# You'll get: https://xxxx-xx-xxx-xxx.ngrok.io
```

### 3.3 Update Vercel Environment Variables

Go to Vercel Dashboard → Settings → Environment Variables

```
REACT_APP_BACKEND_URL=https://xxxx-xx-xxx-xxx.ngrok.io
REACT_APP_WS_URL=wss://xxxx-xx-xxx-xxx.ngrok.io
```

---

## Step 4: Environment Setup

### 4.1 Create `.env.local`

```env
# Backend
PORT=3000
ADMIN_KEY=your_secret_admin_key_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend (for local dev)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4.2 Create `.env.production`

```env
# Vercel will use these
REACT_APP_BACKEND_URL=https://your-ngrok-url.ngrok.io
REACT_APP_WS_URL=wss://your-ngrok-url.ngrok.io
```

---

## Step 5: Run Everything

### Terminal 1: Start Local Backend

```bash
cd "c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww"
npm run serve:server
```

Output:
```
✅ Wingo Backend Server running on http://localhost:3000
📡 WebSocket: ws://localhost:3000
🎮 Frontend: https://winclub-officiall.vercel.app
```

### Terminal 2: Create ngrok Tunnel

```bash
ngrok http 3000
```

Output:
```
Session Status                online
Account                       your-email@gmail.com
Version                       3.0.0
Region                        United States (us)
Forwarding                    https://xxxx-xx-xxx-xxx.ngrok.io -> http://localhost:3000
```

### Terminal 3: Deploy Frontend (Optional)

```bash
git push origin main
# Vercel auto-deploys
```

---

## Step 6: Test the Flow

### 6.1 Local Testing

```bash
# Terminal 1: Backend running
# Terminal 2: ngrok tunnel active

# Open browser
http://localhost:5173  # Local frontend (if running)
```

### 6.2 Production Testing

```bash
# Open browser
https://winclub-officiall.vercel.app

# Backend connects via ngrok tunnel
# WebSocket updates in real-time
# Bets placed and processed
# Balance updated
```

---

## Architecture Flow

### Game Round Lifecycle

```
1. Supabase pg_cron triggers fn_tick_game_rounds() every minute
   ↓
2. New game_rounds created for each mode (30s, 1m, 3m, 5m)
   ↓
3. Frontend polls /api/round/active/:mode every 5 seconds
   ↓
4. User places bet via POST /api/bet
   ↓
5. Backend deducts balance, inserts betting_history
   ↓
6. WebSocket broadcasts bet_placed to all clients
   ↓
7. Round ends (pg_cron calculates result)
   ↓
8. Trigger updates betting_history with result (win/loss)
   ↓
9. Trigger credits/debits user balance
   ↓
10. WebSocket broadcasts round_completed with results
    ↓
11. Frontend shows popup, updates balance
```

### Real-time Update Flow

```
User Places Bet
    ↓
POST /api/bet (Backend)
    ↓
Deduct Balance + Insert Bet
    ↓
WebSocket: broadcastToAll({ type: 'bet_placed' })
    ↓
All Connected Clients Receive Update
    ↓
Frontend Updates UI (show bet in list)
```

---

## Troubleshooting

### Issue: WebSocket Connection Refused

**Solution**: 
- Ensure backend is running on port 3000
- Check ngrok tunnel is active
- Verify CORS settings in server.ts

### Issue: Balance Not Updating

**Solution**:
- Check Supabase connection
- Verify user has sufficient balance
- Check database triggers are enabled

### Issue: Rounds Not Generating

**Solution**:
- Verify pg_cron is enabled in Supabase
- Check fn_tick_game_rounds() function exists
- Monitor Supabase logs

### Issue: ngrok URL Changes

**Solution**:
- Use ngrok auth token for persistent URL
- Update Vercel env variables when URL changes
- Or use custom domain with ngrok Pro

---

## Production Deployment

### Option 1: AWS EC2 (Recommended)

```bash
# Launch EC2 instance
# SSH into instance
# Clone repo
# Install Node.js
# Run: npm run serve:server
# Use PM2 to keep running
npm install -g pm2
pm2 start server.ts --name wingo-backend
pm2 startup
pm2 save
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
# Auto-deploys from GitHub
```

---

## Summary

✅ **Local Backend**: Runs on `http://localhost:3000`
✅ **Public Tunnel**: ngrok exposes to internet
✅ **Vercel Frontend**: Connects via ngrok URL
✅ **Real-time Updates**: WebSocket for instant feedback
✅ **Game Engine**: Supabase pg_cron handles rounds
✅ **Balance Updates**: Automatic via database triggers

This setup allows you to develop and test locally while having a production-ready frontend on Vercel!
