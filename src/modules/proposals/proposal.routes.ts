import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

type Variables = { userId: string; userRole: string };
const proposalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/proposals - List all proposals
proposalRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';

  let query = 'SELECT p.*, u.name as submitter_name FROM proposals p JOIN users u ON p.submitted_by = u.id';
  const params: string[] = [];

  if (status) {
    query += ' WHERE p.status = ?';
    params.push(status);
  }
  query += ' ORDER BY p.created_at DESC';

  const result = params.length > 0
    ? await c.env.DB.prepare(query).bind(...params).all()
    : await c.env.DB.prepare(query).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/proposals/:id
proposalRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const proposal = await c.env.DB.prepare(
    'SELECT p.*, u.name as submitter_name FROM proposals p JOIN users u ON p.submitted_by = u.id WHERE p.id = ?'
  ).bind(id).first();

  if (!proposal) return c.json({ success: false, error: 'Proposal not found' }, 404);
  return c.json({ success: true, data: proposal });
});

// POST /api/proposals - Create new proposal (Students only)
proposalRoutes.post('/', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only students can submit proposals.' }, 403);
  }

  const body = await c.req.json();
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO proposals (id, title, abstract, problem_statement, objectives, methodology, expected_outcomes, technologies, scope, status, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.abstract || null, body.problem_statement || null,
    body.objectives || null, body.methodology || null, body.expected_outcomes || null,
    body.technologies || null, body.scope || null, body.status || 'draft', userId
  ).run();

  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: proposal }, 201);
});

// PUT /api/proposals/:id
proposalRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['title', 'abstract', 'problem_statement', 'objectives', 'methodology', 'expected_outcomes', 'technologies', 'scope', 'status', 'supervisor_id'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    await c.env.DB.prepare(`UPDATE proposals SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    const updated = await c.env.DB.prepare(
      'SELECT p.*, u.name as submitter_name FROM proposals p LEFT JOIN users u ON p.submitted_by = u.id WHERE p.id = ?'
    ).bind(id).first() as Record<string, any> | null;

    // Auto-promote proposal to active project when approved
    if (body.status === 'approved' && updated) {
      const existingProject = await c.env.DB.prepare('SELECT id FROM projects WHERE proposal_id = ?').bind(id).first();
      if (!existingProject) {
        const projectId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department, start_date)
           VALUES (?, ?, ?, ?, 'active', 'healthy', 0, ?, ?, date('now'))`
        ).bind(
          projectId,
          updated.title,
          updated.abstract || updated.problem_statement || 'Approved FYP Project',
          id,
          updated.supervisor_id || null,
          updated.department || 'Computer Science'
        ).run();

        // Add student submitter as project member
        if (updated.submitted_by) {
          const memberId = generateId();
          await c.env.DB.prepare(
            `INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'lead')`
          ).bind(memberId, projectId, updated.submitted_by).run();
        }
      }
    }

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('Update Proposal Error:', err);
    return c.json({ success: false, error: err?.message || 'Failed to update proposal' }, 500);
  }
});

// POST /api/proposals/:id/submit
proposalRoutes.post('/:id/submit', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE proposals SET status = 'submitted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

export { proposalRoutes };
