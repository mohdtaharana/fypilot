import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { aiRoutes } from './modules/ai/ai.routes';
import { proposalRoutes } from './modules/proposals/proposal.routes';
import { projectRoutes } from './modules/projects/project.routes';
import { userRoutes } from './modules/auth/user.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { groupRoutes } from './modules/groups/group.routes';
import { chatRoutes, presenceRoutes } from './modules/chat/chat.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { applicationRoutes } from './modules/applications/application.routes';
import { defenseRoutes } from './modules/defense/defense.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { evaluationRoutes } from './modules/evaluations/evaluation.routes';
import type { Env } from './modules/ai/ai.types';

const app = new Hono<{ Bindings: Env }>();

// Error boundary: the Vite/wrangler dev server runs this app in-process, so a
// thrown handler error (e.g. a malformed D1 query while loading /evaluate/:token)
// must never escape as an unhandled rejection. Convert it to a normal Response.
app.onError((err, c) => {
  console.error(`[request error] ${c.req.method} ${c.req.path}:`, err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
  return c.text('Internal server error', 500);
});

// CORS
app.use('/api/*', cors());

// API Routes
app.route('/api/applications', applicationRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/proposals', proposalRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/users', userRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api/chats', chatRoutes);
app.route('/api/presence', presenceRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/defense', defenseRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/evaluations', evaluationRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Unknown API routes must return JSON, never the SPA shell. Registered after
// every real API route but before the static/SPA handlers.
app.all('/api/*', (c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Serve static assets before the SPA catch-all. `hono/cloudflare-workers`
// serveStatic depends on the legacy Workers Sites manifest, which is absent
// under the Vite dev server and `wrangler pages dev`; degrade to the next
// handler instead of throwing so a missing file never 500s the app.
const staticAsset = (prefix: string): MiddlewareHandler<{ Bindings: Env }> => {
  const handler = serveStatic({ root: './public' });
  return async (c, next) => {
    try {
      await handler(c, next);
    } catch (err) {
      console.error(`[static] lookup failed for ${prefix}:`, err);
      await next();
    }
  };
};

app.use('/static/*', staticAsset('/static/*'));
app.use('/images/*', staticAsset('/images/*'));
app.use('/icons/*', staticAsset('/icons/*'));
app.use('/manifest.webmanifest', staticAsset('/manifest.webmanifest'));
app.use('/sw.js', staticAsset('/sw.js'));
app.use('/favicon.ico', staticAsset('/favicon.ico'));

// SPA fallback: every remaining GET request returns the app shell so that
// client-side routes such as /evaluate/:token and /apply survive a hard refresh.
// Must be the last route on the stack.
app.get('*', (c) => {
  return c.html(getIndexHTML());
});

// Keep the Node dev server alive if a background promise rejects or a stray
// exception slips past the routes. Guarded so it is a no-op on Cloudflare.
type NodeProcessLike = {
  on(event: 'unhandledRejection', cb: (reason: unknown) => void): void;
  on(event: 'uncaughtException', cb: (err: unknown) => void): void;
};
const nodeProcess = (globalThis as { process?: NodeProcessLike }).process;
if (nodeProcess && typeof nodeProcess.on === 'function') {
  nodeProcess.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
  nodeProcess.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
  });
}

function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FYPilot — AI Intelligence Layer for FYP Management</title>
  <meta name="description" content="AI Intelligence Layer for FYP Management">
  <meta name="theme-color" content="#0284c7">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="FYPilot">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="icon" type="image/png" href="/images/fypilotlogo.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- Renders the external examiner evaluation QR code. Served from our own
       origin (bundled from the qrcode npm package) so the panel still works
       offline and on exam day without a CDN. -->
  <script src="/static/vendor/qrcode.min.js?v=20260929-1" data-qr-lib="1" defer></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
            fypilot: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  <div id="toast-container" class="fixed bottom-4 right-4 z-[99999] pointer-events-none"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  </script>
  <script src="/static/app.js?v=20261001-client-pdf-text"></script>
</body>
</html>`;
}

export default app;
