import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

const copyAssetsPlugin = (): Plugin => ({
  name: 'copy-assets',
  apply: 'build',
  closeBundle() {
    const from = path.resolve(__dirname, 'assets');
    const to = path.resolve(__dirname, 'dist', 'assets');
    if (fs.existsSync(from)) {
      // Merge assets into `dist/assets` instead of removing the directory.
      // Removing the directory would delete Vite's built asset files (JS/CSS),
      // causing 404s for the generated bundles when deployed to Netlify.
      if (!fs.existsSync(to)) {
        fs.cpSync(from, to, { recursive: true });
      } else {
        // Copy files without removing existing built assets.
        const copyRecursive = (srcDir: string, destDir: string) => {
          for (const name of fs.readdirSync(srcDir)) {
            const srcPath = path.join(srcDir, name);
            const destPath = path.join(destDir, name);
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
              if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
              copyRecursive(srcPath, destPath);
            } else {
              // Only copy if the destination file doesn't already exist to avoid
              // overwriting Vite's generated asset files.
              if (!fs.existsSync(destPath)) fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        copyRecursive(from, to);
      }
    }
  },
  configureServer(server: any) {
    server.middlewares.use('/assets', (req: any, res: any, next: any) => {
      const requestPath = decodeURIComponent(req.url || '').split('?')[0].replace(/^\/assets/, '');
      const filePath = path.join(__dirname, 'assets', requestPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return next();
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      fs.createReadStream(filePath).pipe(res);
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyAssetsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
  };
});