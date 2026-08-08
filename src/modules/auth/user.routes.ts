import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

const userRoutes = new Hono<{ Bindings: Env }>();

// GET /api/users
userRoutes.get('/', async (c) => {
  const role = c.req.query('role');
  let query = 'SELECT id, email, name, role, department, expertise, research_areas, max_students, created_at FROM users';
  
  if (role) {
    const result = await c.env.DB.prepare(query + ' WHERE role = ? ORDER BY name').bind(role).all();
    return c.json({ success: true, data: result.results });
  }
  
  const result = await c.env.DB.prepare(query + ' ORDER BY name').all();
  return c.json({ success: true, data: result.results });
});

// GET /api/users/:id
userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, expertise, research_areas, max_students, created_at FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  return c.json({ success: true, data: user });
});

// POST /api/users
userRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, department, expertise, research_areas, max_students)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.email, body.name, body.role || 'student',
    body.department || null, body.expertise ? JSON.stringify(body.expertise) : null,
    body.research_areas ? JSON.stringify(body.research_areas) : null,
    body.max_students || 8
  ).run();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: user }, 201);
});

// GET /api/users/supervisors/stats - Get supervisors with workload
userRoutes.get('/supervisors/stats', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.department, u.expertise, u.research_areas, u.max_students,
       (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id AND p.status = 'active') as active_projects,
       (SELECT COUNT(*) FROM project_members pm JOIN projects pr ON pm.project_id = pr.id WHERE pr.supervisor_id = u.id AND pr.status = 'active') as active_students
     FROM users u WHERE u.role = 'supervisor' ORDER BY u.name`
  ).all();
  return c.json({ success: true, data: result.results });
});

export { userRoutes };
