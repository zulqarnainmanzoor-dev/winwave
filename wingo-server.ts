import 'dotenv/config';
import { startWinGoEngine, stopWinGoEngine } from './backend/game-engine/wingoEngine';

const PORT = process.env.PORT || 3001;

async function startWinGoServer() {
  console.log('[WinGo Server] Initializing...');
  console.log('[WinGo Server] Environment:', process.env.NODE_ENV || 'development');
  
  // Verify environment variables
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'SERVICE_ROLE_KEY',
    'WINGO_HMAC_SECRET',
    'RESULT_STORE_KEY'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('[WinGo Server] ❌ Missing environment variables:', missingVars);
    process.exit(1);
  }

  console.log('[WinGo Server] ✅ All environment variables set');

  // Start the WinGo game engine
  try {
    console.log('[WinGo Server] Starting WinGo 24/7 engine...');
    startWinGoEngine();
    console.log('[WinGo Server] ✅ WinGo engine started successfully');
  } catch (error: any) {
    console.error('[WinGo Server] ❌ Failed to start WinGo engine:', error?.message);
    process.exit(1);
  }

  // Graceful shutdown handlers
  process.on('SIGTERM', () => {
    console.log('[WinGo Server] 🛑 SIGTERM received - shutting down gracefully...');
    stopWinGoEngine();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[WinGo Server] 🛑 SIGINT received - shutting down gracefully...');
    stopWinGoEngine();
    process.exit(0);
  });

  // Unhandled error handlers
  process.on('uncaughtException', (error) => {
    console.error('[WinGo Server] ❌ Uncaught Exception:', error);
    stopWinGoEngine();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[WinGo Server] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
    stopWinGoEngine();
    process.exit(1);
  });

  console.log('[WinGo Server] 🎮 WinGo Server running 24/7');
  console.log('[WinGo Server] Generating game results every 2 minutes');
  console.log('[WinGo Server] Press Ctrl+C to stop');
}

startWinGoServer().catch((error) => {
  console.error('[WinGo Server] ❌ Fatal error:', error);
  process.exit(1);
});
