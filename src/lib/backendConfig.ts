// Backend Configuration
// Automatically detects local vs production environment

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Backend URL - use env variable or default to localhost
export const BACKEND_URL = isLocalhost
  ? 'http://localhost:3000'
  : (import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000');

// WebSocket URL - convert http to ws
export const WS_URL = isLocalhost
  ? 'ws://localhost:3000'
  : (import.meta.env.VITE_WS_URL || process.env.REACT_APP_WS_URL || 'ws://localhost:3000')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

console.log(`[Backend Config] Environment: ${isLocalhost ? 'LOCAL' : 'PRODUCTION'}`);
console.log(`[Backend Config] Backend URL: ${BACKEND_URL}`);
console.log(`[Backend Config] WebSocket URL: ${WS_URL}`);

export { isLocalhost };
