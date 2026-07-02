import 'dotenv/config';
import fs from 'fs';
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";

const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

async function startServer() {
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envExamplePath });
  }

  const { default: apiRouter } = await import("./backend/api/api");

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

  // API Routes
  app.use("/api", apiRouter);

  // Always return JSON on internal API errors so the frontend does not fail parsing
  app.use((err: any, req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);
    console.error('Unexpected API error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error', details: err?.message || 'Unknown error' });
  });

  // Admin dashboard route: serve the frontend app at /api/admin/:secret
  const adminSecret = process.env.ADMIN_SECRET_ID || "3399944";
  app.get('/api/admin/:secret', (req, res) => {
    if (req.params.secret !== adminSecret) {
      return res.status(403).send('Unauthorized admin access');
    }

    const indexPath = path.join(process.cwd(), 'index.html');
    return res.sendFile(indexPath);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel available at: http://localhost:${PORT}/api/admin/${adminSecret}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is already in use; continuing without starting a new server instance.`);
      return;
    }
    console.error(error);
  });
}

startServer();
