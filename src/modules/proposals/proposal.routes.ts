import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { createNotification, notifyRole } from '../notifications/notification.routes';

type Variables = { userId: string; userRole: string };
const proposalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/proposals - List all proposals
proposalRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';

  let query = 'SELECT p.*, u.name as submitter_name, gr.name as group_name FROM proposals p JOIN users u ON p.submitted_by = u.id LEFT JOIN groups gr ON p.group_id = gr.id';
  const params: string[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }

  // Students only see proposals from their own group (or their own solo submissions)
  if (userRole === 'student') {
    conditions.push(
      `(p.submitted_by = ? OR p.group_id IN (SELECT gm.group_id FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?))`
    );
    params.push(userId, userId);
  }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
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
    'SELECT p.*, u.name as submitter_name, gr.name as group_name FROM proposals p JOIN users u ON p.submitted_by = u.id LEFT JOIN groups gr ON p.group_id = gr.id WHERE p.id = ?'
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

  // Only the leader of an APPROVED group can submit a proposal for the group
  const group = await c.env.DB.prepare(
    `SELECT g.id, g.name FROM groups g
     WHERE g.leader_id = ? AND g.status = 'approved'
     ORDER BY g.created_at DESC LIMIT 1`
  ).bind(userId).first() as Record<string, any> | null;

  if (!group) {
    return c.json({
      success: false,
      error: 'You must be the leader of an approved group before submitting a proposal.'
    }, 403);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO proposals (id, title, abstract, problem_statement, objectives, methodology, expected_outcomes, technologies, scope, status, submitted_by, group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.abstract || null, body.problem_statement || null,
    body.objectives || null, body.methodology || null, body.expected_outcomes || null,
    body.technologies || null, body.scope || null, body.status || 'draft', userId, group.id
  ).run();

  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
  await notifyRole(c.env.DB, 'coordinator', {
    type: 'proposal',
    title: 'New proposal submitted',
    body: `${group.name} submitted "${body.title}". Review and decide on it.`,
    link_view: 'proposals',
    ref_id: id,
  });
  const supervisors = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'supervisor' AND (status = 'active' OR status IS NULL)").all();
  for (const s of supervisors.results as { id: string }[]) {
    await createNotification(c.env.DB, s.id, {
      type: 'proposal',
      title: 'New proposal submitted',
      body: `${group.name} submitted "${body.title}" — it may need a supervisor.`,
      link_view: 'proposals',
      ref_id: id,
    });
  }
  return c.json({ success: true, data: proposal }, 201);
});

// PUT /api/proposals/:id
proposalRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userRole = c.req.header('X-User-Role') || 'student';

    // Executive actions (status decisions / supervisor assignment) are limited to coordinators & supervisors
    const executiveFields = ['status', 'supervisor_id'];
    const touchesExecutive = executiveFields.some((f) => body[f] !== undefined);
    if (touchesExecutive && userRole !== 'coordinator' && userRole !== 'supervisor') {
      return c.json({ success: false, error: 'Only coordinators and supervisors can approve or assign proposals' }, 403);
    }

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

    if (body.status !== undefined && updated) {
      const statusLabel = { approved: 'approved', rejected: 'rejected', under_review: 'sent for review', revision_requested: 'sent back for revision' };
      await createNotification(c.env.DB, updated.submitted_by, {
        type: 'proposal',
        title: `Your proposal was ${statusLabel[body.status] || body.status}`,
        body: `"${updated.title}" was ${statusLabel[body.status] || body.status} by the coordinator.`,
        link_view: 'proposals',
        ref_id: id,
      });
      if (body.supervisor_id && body.supervisor_id !== '') {
        await createNotification(c.env.DB, body.supervisor_id, {
          type: 'proposal',
          title: 'Proposal assigned to you',
          body: `"${updated.title}" has been assigned to you as supervisor.`,
          link_view: 'proposals',
          ref_id: id,
        });
      }
    }

    // Enforce that projects only exist for approved proposals
    if (body.status !== undefined && updated) {
      if (body.status === 'approved') {
        // Auto-promote approved proposal to active project
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

          // Add student submitter as project member (group leader)
          if (updated.submitted_by) {
            const memberId = generateId();
            await c.env.DB.prepare(
              `INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'lead')`
            ).bind(memberId, projectId, updated.submitted_by).run();
          }

          // Add the rest of the approved group as project members
          if (updated.group_id) {
            const groupMembers = await c.env.DB.prepare(
              'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?'
            ).bind(updated.group_id, updated.submitted_by || '').all();
            for (const m of groupMembers.results) {
              const memberId = generateId();
              await c.env.DB.prepare(
                `INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'member')`
              ).bind(memberId, projectId, m.user_id).run();
            }
          }
        }
      } else {
        // Proposal is no longer approved — remove any linked project
        const linkedProject = await c.env.DB.prepare('SELECT id FROM projects WHERE proposal_id = ?').bind(id).first();
        if (linkedProject) {
          await c.env.DB.prepare('DELETE FROM project_members WHERE project_id = ?').bind(linkedProject.id).run();
          await c.env.DB.prepare('DELETE FROM meetings WHERE project_id = ?').bind(linkedProject.id).run();
          await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(linkedProject.id).run();
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
