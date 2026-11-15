import { handleStudioApiRequest } from '../server/studioApi.mjs';

export default async function handler(req, res) {
  const rawUrl = req.url || '/api/health';
  const parsed = new URL(rawUrl, 'http://localhost');

  if (parsed.pathname.startsWith('/api/index') || parsed.pathname === '/api' || parsed.searchParams.has('__path')) {
    const rewritten = parsed.searchParams.get('__path') || '';
    parsed.searchParams.delete('__path');
    const qs = parsed.searchParams.toString();
    req.url = `/api/${rewritten.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
  }

  try {
    const handled = await handleStudioApiRequest(req, res);
    if (!handled && !res.headersSent) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'API route not found' }));
    }
  } catch (err) {
    console.error('Vercel Studio API error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
    }
  }
}
