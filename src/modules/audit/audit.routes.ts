import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { resolveSessionRole } from '../../utils/session';

const auditRoutes = new Hono<{ Bindings: Env }>();
const AUDIT_ACCESS_ROLES = new Set(['hod', 'dean']);
const normalizeRole = (role?: string | null) => (role || '').trim().toLowerCase();
const isAuditAccessRole = (role?: string | null) => !!role && AUDIT_ACCESS_ROLES.has(normalizeRole(role));

// Exports are opened with window.open(), which cannot send X-User-* headers, so the
// session cookie issued at login is used as a fallback identity source.
async function resolveRequestRole(c: { req: { header(name: string): string | undefined } } & { env: Env }): Promise<string> {
  const headerRole = normalizeRole(c.req.header('X-User-Role'));
  if (isAuditAccessRole(headerRole)) return headerRole;

  const session = await resolveSessionRole(c.env.DB, c.req.header('Cookie'));
  if (session && isAuditAccessRole(session.role)) return normalizeRole(session.role);

  return headerRole;
}

async function ensureAuditTables(db: Env['DB']) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`).run();
}

auditRoutes.use('*', async (c, next) => {
  await ensureAuditTables(c.env.DB);
  await next();
});

export async function logAuditEvent(
  db: Env['DB'],
  actorId: string | null | undefined,
  actorRole: string | null | undefined,
  action: string,
  options: {
    entityType?: string;
    entityId?: string;
    details?: string;
    metadata?: Record<string, any> | null;
  } = {}
) {
  if (!action) return;

  const payload = {
    id: generateId(),
    actor_id: actorId || 'system',
    actor_role: actorRole || 'system',
    action,
    entity_type: options.entityType || null,
    entity_id: options.entityId || null,
    details: options.details || action,
    metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    created_at: new Date().toISOString(),
  };

  await db.prepare(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, details, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.id,
    payload.actor_id,
    payload.actor_role,
    payload.action,
    payload.entity_type,
    payload.entity_id,
    payload.details,
    payload.metadata,
    payload.created_at
  ).run();
}

// GET /api/audit/logs
auditRoutes.get('/logs', async (c) => {
  const userRole = await resolveRequestRole(c);
  if (!isAuditAccessRole(userRole)) {
    return c.json({ success: false, error: 'Only HOD and Dean can view audit logs.' }, 403);
  }

  const result = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200`
  ).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/audit/logs/export?format=csv|json
auditRoutes.get('/logs/export', async (c) => {
  const userRole = await resolveRequestRole(c);
  if (!isAuditAccessRole(userRole)) {
    return c.json({ success: false, error: 'Only HOD and Dean can export audit logs.' }, 403);
  }

  const format = (c.req.query('format') || 'csv').toLowerCase();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`
  ).all();

  const data = rows.results as any[];

  if (format === 'json') {
    return c.json({ success: true, data });
  }

  const headers = ['id', 'actor_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'details', 'metadata', 'created_at'];
  const escapeCsv = (value: any) => {
    const str = value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(','),
    ...data.map((row) => headers.map((header) => escapeCsv((row as Record<string, any>)[header])).join(',')),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fyp_audit_logs.csv"',
    },
  });
});

export { auditRoutes };
