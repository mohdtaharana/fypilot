import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { aiRoutes } from './modules/ai/ai.routes';
import { proposalRoutes } from './modules/proposals/proposal.routes';
import { projectRoutes } from './modules/projects/project.routes';
import { userRoutes } from './modules/auth/user.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { groupRoutes } from './modules/groups/group.routes';
import { chatRoutes, presenceRoutes } from './modules/chat/chat.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import type { Env } from './modules/ai/ai.types';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/api/*', cors());

// API Routes
app.route('/api/ai', aiRoutes);
app.route('/api/proposals', proposalRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/users', userRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api/chats', chatRoutes);
app.route('/api/presence', presenceRoutes);
app.route('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

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
  <style>
    [x-cloak] { display: none !important; }
    .fade-in { animation: fadeIn 0.3s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .score-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .score-ring svg { transform: rotate(-90deg); }
    .toast { position: fixed; bottom: 1rem; right: 1rem; z-index: 9999; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 999px; }
    .eq-bar { transform-origin: bottom; }
    .chat-voice-playing .eq-bar { animation: eqBounce 0.9s ease-in-out infinite; }
    @keyframes eqBounce { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  <div id="toast-container" class="toast"></div>
  <script src="/static/app.js?v=20260810-notif"></script>
</body>
</html>`;
}

export default app;
