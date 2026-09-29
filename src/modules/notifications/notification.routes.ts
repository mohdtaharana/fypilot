import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { sendEmail, resolveAppUrl, buildNotificationEmail } from '../../utils/email';
import { resolveSessionRole } from '../../utils/session';

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
    const roles = role === 'coordinator' ? ['coordinator', 'hod', 'dean'] : [role];
    const placeholders = roles.map(() => '?').join(', ');
    const res = await db.prepare(
      `SELECT id FROM users WHERE role IN (${placeholders}) AND (status = 'active' OR status IS NULL)`
    ).bind(...roles).all();
    for (const u of res.results as { id: string }[]) {
      await createNotification(db, u.id, payload);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Create a notification in database AND send an email alert via SMTP2GO (non-blocking).
 */
export async function createNotificationWithEmail(
  env: Env,
  userId: string | null | undefined,
  payload: NotificationPayload,
  actionUrl?: string
): Promise<void> {
  if (!userId || !payload.title) return;
  await createNotification(env.DB, userId, payload);

  if (env.SMTP2GO_API_KEY) {
    try {
      const user = await env.DB.prepare(
        'SELECT name, email FROM users WHERE id = ?'
      ).bind(userId).first() as { name?: string; email?: string } | null;

      if (user?.email) {
        const html = buildNotificationEmail({
          title: payload.title,
          body: payload.body || payload.title,
          recipientName: user.name,
          actionUrl,
        });
        await sendEmail(env, {
          to: user.email,
          subject: `[FYPilot] ${payload.title}`,
          html,
        });
      }
    } catch (e) {
      console.error('[Notification] Failed to send email alert:', e);
    }
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

// POST /api/notifications/test-email — Test sending an email via SMTP2GO
notificationRoutes.post('/test-email', async (c) => {
  // Restricted to executive roles: without a guard this endpoint lets anyone
  // send email to any address through the SMTP2GO account.
  const session = await resolveSessionRole(c.env.DB, c.req.header('Cookie'));
  if (!session || !['coordinator', 'hod', 'dean', 'admin'].includes(session.role)) {
    return c.json({ success: false, error: 'Not authorized' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const to = body.to;
  if (!to) {
    return c.json({ success: false, error: 'Recipient "to" email address is required' }, 400);
  }

  const subject = body.subject || 'FYPilot Email Integration Test';
  const message = body.message || 'This is a test notification confirming that SMTP2GO email delivery is working successfully!';
  const recipientName = body.name || 'FYPilot User';

  const html = buildNotificationEmail({
    title: subject,
    body: message,
    recipientName,
    actionText: 'Open FYPilot Dashboard',
    actionUrl: body.actionUrl || resolveAppUrl(c.req.url, c.env),
  });

  const result = await sendEmail(c.env, {
    to,
    subject,
    html,
  });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 500);
  }

  return c.json({
    success: true,
    message: `Test email successfully dispatched to ${to}`,
    id: result.id,
  });
});

export { notificationRoutes };
