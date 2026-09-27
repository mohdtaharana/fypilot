import { Hono } from 'hono';
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
import type { Env } from './modules/ai/ai.types';

const app = new Hono<{ Bindings: Env }>();

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

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Serve static assets before the SPA catch-all
app.use('/static/*', serveStatic({ root: './public' }));

// Serve the SPA frontend
app.get('*', (c) => {
  return c.html(getIndexHTML());
});

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
  <script src="/static/app.js?v=20260927-1"></script>
</body>
</html>`;
}

export default app;
