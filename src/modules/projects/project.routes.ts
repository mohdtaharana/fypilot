import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

type Variables = { userId: string; userRole: string };
const projectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/projects
projectRoutes.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id ORDER BY p.created_at DESC`
  ).all();
  return c.json({ success: true, data: result.results });
});

// GET /api/projects/:id
projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id WHERE p.id = ?`
  ).bind(id).first();
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

  // Also fetch members, tasks, milestones
  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
  ).bind(id).all();

  const tasks = await c.env.DB.prepare(
    `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC`
  ).bind(id).all();

  const milestones = await c.env.DB.prepare(
    `SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date ASC`
  ).bind(id).all();

  const meetings = await c.env.DB.prepare(
    `SELECT * FROM meetings WHERE project_id = ? ORDER BY scheduled_at DESC LIMIT 10`
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...project,
      members: members.results,
      tasks: tasks.results,
      milestones: milestones.results,
      meetings: meetings.results,
    }
  });
});

// POST /api/projects
projectRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, 'healthy', 0, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.description || null, body.proposal_id || null,
    body.status || 'active', body.supervisor_id || null,
    body.department || null, body.start_date || null, body.end_date || null
  ).run();

  // Add members if provided
  if (body.members && Array.isArray(body.members)) {
    for (const memberId of body.members) {
      await c.env.DB.prepare(
        `INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)`
      ).bind(generateId(), id, memberId).run();
    }
  }

  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: project }, 201);
});

// PUT /api/projects/:id
projectRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: any[] = [];
  const allowedFields = ['title', 'description', 'status', 'health', 'progress', 'supervisor_id', 'start_date', 'end_date'];
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (fields.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);
  
  fields.push("updated_at = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id WHERE p.id = ?`
  ).bind(id).first();
  return c.json({ success: true, data: updated });
});

// POST /api/projects/:id/tasks
projectRoutes.post('/:id/tasks', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json();
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, project_id, milestone_id, title, description, assigned_to, status, priority, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, projectId, body.milestone_id || null, body.title, body.description || null,
    body.assigned_to || null, body.status || 'todo', body.priority || 'medium', body.due_date || null
  ).run();

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: task }, 201);
});

// PUT /api/projects/:projectId/tasks/:taskId
projectRoutes.put('/:projectId/tasks/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: any[] = [];
  const allowedFields = ['title', 'description', 'assigned_to', 'status', 'priority', 'due_date', 'milestone_id'];
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (body.status === 'completed') {
    fields.push("completed_at = datetime('now')");
  }

  fields.push("updated_at = datetime('now')");
  values.push(taskId);

  await c.env.DB.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  return c.json({ success: true, data: updated });
});

// POST /api/projects/:id/milestones
projectRoutes.post('/:id/milestones', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json();
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO milestones (id, project_id, title, description, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, body.title, body.description || null, body.due_date || null, body.status || 'pending').run();

  const milestone = await c.env.DB.prepare('SELECT * FROM milestones WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: milestone }, 201);
});

// POST /api/projects/:id/meetings
projectRoutes.post('/:id/meetings', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json();
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO meetings (id, project_id, title, scheduled_at, status)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, projectId, body.title || 'Supervisor Meeting', body.scheduled_at || null, body.status || 'scheduled').run();

  const meeting = await c.env.DB.prepare('SELECT * FROM meetings WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: meeting }, 201);
});

export { projectRoutes };
