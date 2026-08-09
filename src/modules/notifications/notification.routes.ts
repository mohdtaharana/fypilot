// FYPilot Notifications Module
import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

const notificationRoutes = new Hono<{ Bindings: Env }>();

type NotificationPayload = {
  type: 'approval' | 'proposal' | 'project' | 'group' | 'chat' | 'feedback' | 'system';
  title: string;
  body?: string;
  link_view?: string;
  ref_id?: string;
};

/**
 * Create a notification for a recipient. Used by other modules (users, proposals, projects, groups, chats).
 * Safe to call — never throws.
 */
export async function createNotification(db: D1Database, userId: string | null | undefined, payload: NotificationPayload): Promise<void> {
  if (!userId || !payload.title) return;
  try {
    const id = generateId();
    await db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link_view, ref_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, payload.type, payload.title, payload.body || null, payload.link_view || null, payload.ref_id || null).run();
  } catch (e) {
    // Notifications must never break the underlying action
  }
}

/**
 * Notify all users matching a role (e.g. every coordinator about a pending approval).
 */
export async function notifyRole(db: D1Database, role: string, payload: NotificationPayload): Promise<void> {
  try {
    const res = await db.prepare(
      "SELECT id FROM users WHERE role = ? AND (status = 'active' OR status IS NULL)"
    ).bind(role).all();
    for (const u of res.results as { id: string }[]) {
      await createNotification(db, u.id, payload);
    }
  } catch (e) {
    // ignore
  }
}

// GET /api/notifications — recent notifications for the current user
notificationRoutes.get('/', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const limit = parseInt(c.req.query('limit') || '30', 10);
  const result = await c.env.DB.prepare(
    `SELECT seq, id, user_id, type, title, body, link_view, ref_id, is_read, created_at
     FROM notifications WHERE user_id = ? ORDER BY created_at DESC, seq DESC LIMIT ?`
  ).bind(userId, Math.min(100, Math.max(1, limit))).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/notifications/unread-counts — per-view unread counts for nav bubbles
notificationRoutes.get('/unread-counts', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const result = await c.env.DB.prepare(
    `SELECT link_view, COUNT(*) as cnt FROM notifications
     WHERE user_id = ? AND is_read = 0
     GROUP BY link_view`
  ).bind(userId).all();

  const counts: Record<string, number> = { dashboard: 0, proposals: 0, projects: 0, groups: 0, chats: 0, people: 0, profile: 0 };
  let total = 0;
  for (const r of result.results as { link_view: string | null; cnt: number }[]) {
    const key = r.link_view || 'dashboard';
    counts[key] = (counts[key] || 0) + r.cnt;
    total += r.cnt;
  }

  return c.json({ success: true, data: { total, counts } });
});

// POST /api/notifications/:id/read — mark a single notification as read
notificationRoutes.post('/:id/read', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const id = c.req.param('id');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ success: true });
});

// POST /api/notifications/read-all — mark everything read (optionally filter by link_view)
notificationRoutes.post('/read-all', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const view = body.link_view;
  if (view) {
    await c.env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND link_view = ?"
    ).bind(userId, view).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?"
    ).bind(userId).run();
  }

  return c.json({ success: true });
});

export { notificationRoutes };
