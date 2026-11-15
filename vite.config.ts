import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';
import {handleStudioApiRequest} from './server/studioApi.mjs';

function studioApiPlugin() {
  return {
    name: 'yashraj-studio-api',
    configureServer(server: {middlewares: {use: (fn: (req: any, res: any, next: () => void) => void) => void}}) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          try {
            const handled = await handleStudioApiRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error('Vite Studio API middleware error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ok: false, error: 'Internal server error'}));
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  if (process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim().startsWith('sk_')) {
    delete process.env.VITE_CLERK_PUBLISHABLE_KEY;
  }
  if (process.env.VITE_SUPABASE_ANON_KEY?.trim().startsWith('sb_secret_')) {
    delete process.env.VITE_SUPABASE_ANON_KEY;
  }

  return {
    envPrefix: ['VITE_', 'CLERK_PUBLISHABLE_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    plugins: [tailwindcss(), studioApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
