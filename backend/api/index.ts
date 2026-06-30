import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import apiRouter from './api';
import adminRouter from '../admin/admin';

const app = express();
const adminSecret = process.env.ADMIN_SECRET_ID || '3399944';
const adminIndexPath = path.join(process.cwd(), 'dist', 'index.html');

app.use(express.json());

app.get(`/api/admin/${adminSecret}`, (req, res) => {
  if (!fs.existsSync(adminIndexPath)) {
    return res.status(404).send('Admin UI not built yet');
  }
  res.type('html').send(fs.readFileSync(adminIndexPath, 'utf-8'));
});

app.use('/api', apiRouter);
app.use(`/api/admin/${adminSecret}`, adminRouter);

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
