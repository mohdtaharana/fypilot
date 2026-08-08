import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';

const dashboardRoutes = new Hono<{ Bindings: Env }>();

// GET /api/dashboard/stats
dashboardRoutes.get('/stats', async (c) => {
  const [proposals, projects, users, tasks] = await Promise.all([
    c.env.DB.prepare(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review
     FROM proposals`).first(),
    c.env.DB.prepare(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN health = 'healthy' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN health = 'at_risk' THEN 1 ELSE 0 END) as at_risk,
      SUM(CASE WHEN health = 'critical' THEN 1 ELSE 0 END) as critical
     FROM projects`).first(),
    c.env.DB.prepare(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
      SUM(CASE WHEN role = 'supervisor' THEN 1 ELSE 0 END) as supervisors,
      SUM(CASE WHEN role = 'coordinator' THEN 1 ELSE 0 END) as coordinators
     FROM users`).first(),
    c.env.DB.prepare(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'overdue' OR (due_date < datetime('now') AND status != 'completed') THEN 1 ELSE 0 END) as overdue
     FROM tasks`).first(),
  ]);

  return c.json({
    success: true,
    data: { proposals, projects, users, tasks }
  });
});

// GET /api/dashboard/ai-usage
dashboardRoutes.get('/ai-usage', async (c) => {
  const stats = await c.env.DB.prepare(
    `SELECT action, COUNT(*) as count, AVG(duration_ms) as avg_duration, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes
     FROM ai_audit_log GROUP BY action ORDER BY count DESC`
  ).all();

  const recent = await c.env.DB.prepare(
    `SELECT action, user_id, entity_type, entity_id, success, duration_ms, created_at
     FROM ai_audit_log ORDER BY created_at DESC LIMIT 20`
  ).all();

  return c.json({ success: true, data: { stats: stats.results, recent: recent.results } });
});

export { dashboardRoutes };
