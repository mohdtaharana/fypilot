import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';

const dashboardRoutes = new Hono<{ Bindings: Env }>();

// GET /api/dashboard/stats
dashboardRoutes.get('/stats', async (c) => {
  const [proposals, projects, users] = await Promise.all([
    c.env.DB.prepare(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'revision_requested' THEN 1 ELSE 0 END) as revision_requested
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
  ]);

  return c.json({
    success: true,
    data: { proposals, projects, users }
  });
});

// GET /api/dashboard/people — coordinator sees all students & groups (for management view)
dashboardRoutes.get('/people', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (userRole !== 'coordinator') {
    return c.json({ success: false, error: 'Only coordinators can view students & groups' }, 403);
  }

  const [studentsRows, groupsRows, membersRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.department, u.avatar, u.status, u.created_at
       FROM users u WHERE u.role = 'student' AND (u.status = 'active' OR u.status IS NULL) ORDER BY u.name`
    ).all(),
    c.env.DB.prepare(
      `SELECT g.id, g.name, g.status, g.created_at, g.leader_id, l.name as leader_name, l.avatar as leader_avatar
       FROM groups g JOIN users l ON g.leader_id = l.id ORDER BY g.created_at DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT gm.group_id, gm.user_id, u.name, u.avatar, u.email, u.department
       FROM group_members gm JOIN users u ON gm.user_id = u.id ORDER BY u.name`
    ).all(),
  ]);

  const membersByGroup = new Map<string, any[]>();
  for (const m of membersRows.results as any[]) {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
    membersByGroup.get(m.group_id)!.push(m);
  }

  const groups = (groupsRows.results as any[]).map(g => {
    const members = (membersByGroup.get(g.id) || []).map(m => ({
      id: m.user_id, name: m.name, avatar: m.avatar, email: m.email, department: m.department,
      is_leader: m.user_id === g.leader_id,
    }));
    return { ...g, members, member_count: members.length };
  });

  const groupLookup = new Map<string, any>();
  for (const g of groups) groupLookup.set(g.id, g);

  const students = (studentsRows.results as any[]).map(s => {
    const inGroup = groups.find(g => g.members.some(m => m.id === s.id));
    return {
      ...s,
      group_id: inGroup ? inGroup.id : null,
      group_name: inGroup ? inGroup.name : null,
      group_status: inGroup ? inGroup.status : null,
      member_count: inGroup ? inGroup.members.length : 0,
      is_leader: !!(inGroup && inGroup.leader_id === s.id),
    };
  });

  return c.json({
    success: true,
    data: {
      students,
      groups,
      summary: {
        total_students: students.length,
        students_in_groups: students.filter(s => s.group_id).length,
        total_groups: groups.length,
      },
    },
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
