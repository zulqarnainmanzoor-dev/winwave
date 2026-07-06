import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let apiRouter: any = null;
let adminRouter: any = null;
let importError: any = null;

try {
  apiRouter = require('../backend/api/api').default;
  adminRouter = require('../backend/admin/admin').default;
} catch (err: any) {
  importError = err;
  console.error('[Handler] Import error:', err?.message);
}

const app = express();
const adminSecret = process.env.ADMIN_SECRET_ID || '3399944';
const adminIndexPath = path.join(process.cwd(), 'dist', 'index.html');

// Enable CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://winclub-officiall.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Simple test endpoint (no dependencies)
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: process.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
      serviceRoleKey: process.env.SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      anonKey: process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
    },
    importError: importError ? importError.message : null
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
});

app.get(`/admin/${adminSecret}`, (req, res) => {
  if (!fs.existsSync(adminIndexPath)) {
    return res.status(404).send('Admin UI not built yet');
  }
  res.type('html').send(fs.readFileSync(adminIndexPath, 'utf-8'));
});

// Serve Admin login UI path as well so client-side can handle auth flow
app.get('/admin/login', (req, res) => {
  if (!fs.existsSync(adminIndexPath)) {
    return res.status(404).send('Admin UI not built yet');
  }
  res.type('html').send(fs.readFileSync(adminIndexPath, 'utf-8'));
});

if (apiRouter) {
  app.use('/api', apiRouter);
}
if (adminRouter) {
  app.use(`/api/admin/${adminSecret}`, adminRouter);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
