import { BACKEND_URL, WS_URL } from './backendConfig';

export interface GameRound {
  id: string;
  game_type: string;
  mode: string;
  period: string;
  started_at: string;
  ends_at: string;
  status: 'active' | 'completed';
  target_result: string | null;
  result_number: number | null;
  result_size: string | null;
  result_color: string | null;
  total_big: number;
  total_small: number;
}

export interface BetResult {
  success: boolean;
  bet?: any;
  newBalance?: number;
  error?: string;
}

export type GameEngineCallback = (data: any) => void;

export class GameEngine {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;
  private messageQueue: any[] = [];

  constructor(private onUpdate: GameEngineCallback) {
    console.log('[GameEngine] Initialized');
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        console.log('[GameEngine] Already connecting...');
        return resolve();
      }

      this.isConnecting = true;

      try {
        console.log(`[GameEngine] Connecting to ${WS_URL}`);
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('[GameEngine] ✅ WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // Send queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.ws?.send(JSON.stringify(msg));
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[GameEngine] 📨 Message:', data.type);
            this.onUpdate(data);
          } catch (err) {
            console.error('[GameEngine] Parse error:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.error('[GameEngine] ❌ WebSocket error:', err);
          this.isConnecting = false;
          reject(err);
        };

        this.ws.onclose = () => {
          console.log('[GameEngine] 🔌 WebSocket closed');
          this.isConnecting = false;
          this.attemptReconnect();
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.isConnecting) {
            console.error('[GameEngine] Connection timeout');
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (err) {
        console.error('[GameEngine] Connection error:', err);
        this.isConnecting = false;
        this.attemptReconnect();
        reject(err);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`[GameEngine] 🔄 Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect().catch(err => console.error(err)), delay);
    } else {
      console.error('[GameEngine] ❌ Max reconnection attempts reached');
    }
  }

  /**
   * Subscribe to round mode updates
   */
  subscribeToRound(mode: string) {
    const message = {
      type: 'subscribe_round',
      mode
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log(`[GameEngine] 📡 Subscribed to mode: ${mode}`);
    } else {
      this.messageQueue.push(message);
      console.log(`[GameEngine] ⏳ Queued subscription for mode: ${mode}`);
    }
  }

  /**
   * Fetch active round for a game mode
   */
  async getActiveRound(mode: string): Promise<GameRound | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/round/active/${mode}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[GameEngine] 🎮 Active round (${mode}):`, data.round?.period);
      return data.round || null;
    } catch (err) {
      console.error(`[GameEngine] ❌ Fetch active round error:`, err);
      return null;
    }
  }

  /**
   * Fetch all active rounds
   */
  async getAllActiveRounds(): Promise<GameRound[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rounds/active`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[GameEngine] 🎮 All active rounds:`, data.rounds?.length);
      return data.rounds || [];
    } catch (err) {
      console.error(`[GameEngine] ❌ Fetch all rounds error:`, err);
      return [];
    }
  }

  /**
   * Place a bet
   */
  async placeBet(
    userId: string,
    roundId: string,
    period: string,
    betType: string,
    betValue: string,
    amount: number
  ): Promise<BetResult> {
    try {
      console.log(`[GameEngine] 💰 Placing bet: ${betType}=${betValue}, amount=${amount}`);

      const response = await fetch(`${BACKEND_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roundId,
          period,
          gameType: 'wingo',
          mode: '30s', // TODO: make dynamic
          betType,
          betValue,
          amount
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Bet failed');
      }

      console.log(`[GameEngine] ✅ Bet placed successfully`);
      return data;
    } catch (err: any) {
      console.error(`[GameEngine] ❌ Bet error:`, err.message);
      return {
        success: false,
        error: err.message || 'Failed to place bet'
      };
    }
  }

  /**
   * Set round target (admin only)
   */
  async setRoundTarget(period: string, targetResult: string, adminKey: string): Promise<boolean> {
    try {
      console.log(`[GameEngine] 🎯 Setting round target: ${period} = ${targetResult}`);

      const response = await fetch(`${BACKEND_URL}/api/admin/round/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          targetResult,
          adminKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to set target');
      }

      console.log(`[GameEngine] ✅ Round target set`);
      return true;
    } catch (err: any) {
      console.error(`[GameEngine] ❌ Set target error:`, err.message);
      return false;
    }
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET'
      });

      const data = await response.json();
      console.log(`[GameEngine] ✅ Backend health: OK`);
      return data.status === 'ok';
    } catch (err) {
      console.error(`[GameEngine] ❌ Backend health check failed:`, err);
      return false;
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      console.log('[GameEngine] 🔌 Disconnecting WebSocket');
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'DISCONNECTED';
      default: return 'UNKNOWN';
    }
  }
}

// Singleton instance
let gameEngineInstance: GameEngine | null = null;

export function getGameEngine(onUpdate: GameEngineCallback): GameEngine {
  if (!gameEngineInstance) {
    gameEngineInstance = new GameEngine(onUpdate);
  }
  return gameEngineInstance;
}
