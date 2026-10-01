import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { createNotification, createNotificationWithEmail, notifyRole } from '../notifications/notification.routes';
import { logAuditEvent } from '../audit/audit.routes';
import { deleteProposalsCascade } from '../../utils/cascade';
import { requireBulkDeleteRole } from '../../utils/bulk-guard';

type Variables = { userId: string; userRole: string };
const proposalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

// DELETE /api/proposals/bulk — remove EVERY proposal.
// Registered before `/:id` so the literal path is matched first.
proposalRoutes.delete('/bulk', async (c) => {
  const actor = await requireBulkDeleteRole(c);
  if (!actor) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can delete all proposals' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL PROPOSALS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const rows = await c.env.DB.prepare('SELECT id FROM proposals').all();
    const proposals = (rows.results || []) as Array<Record<string, any>>;
    if (proposals.length === 0) {
      return c.json({ success: true, message: 'There are no proposals to delete.', deleted: 0 });
    }

    const ids = proposals.map((p) => p.id);
    await deleteProposalsCascade(c.env.DB, ids);

    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'proposals_deleted_all', {
      entityType: 'proposal',
      entityId: '*',
      details: `All ${proposals.length} proposal(s) deleted`,
      metadata: { scope: 'all', deleted_count: proposals.length, proposal_ids: ids },
    });

    return c.json({
      success: true,
      message: `All ${proposals.length} proposal(s) and their linked projects were deleted.`,
      deleted: proposals.length,
    });
  } catch (e: any) {
    console.error('Delete all proposals error:', e);
    return c.json({ success: false, error: 'Failed to delete all proposals: ' + (e?.message || 'unknown error') }, 500);
  }
});

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

  const existingProposal = await c.env.DB.prepare(
    'SELECT id FROM proposals WHERE group_id = ? LIMIT 1'
  ).bind(group.id).first();
  if (existingProposal) {
    return c.json({
      success: false,
      error: 'This group already has a proposal. A new proposal cannot be created after submission.'
    }, 409);
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
  await logAuditEvent(c.env.DB, userId, userRole, 'proposal_created', {
    entityType: 'proposal',
    entityId: String(id),
    details: `Proposal ${body.title} created by student leader`,
    metadata: { proposal_id: id, proposal_title: body.title, group_id: group.id }
  });
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
    const userId = c.req.header('X-User-Id') || 'demo-user';

    const proposal = await c.env.DB.prepare(
      'SELECT * FROM proposals WHERE id = ?'
    ).bind(id).first() as Record<string, any> | null;
    if (!proposal) return c.json({ success: false, error: 'Proposal not found' }, 404);

    if (userRole === 'student' && proposal.status !== 'draft') {
      return c.json({
        success: false,
        error: 'Proposal is locked after submission and cannot be edited by students.'
      }, 403);
    }

    if (userRole === 'student' && proposal.submitted_by && proposal.submitted_by !== userId) {
      return c.json({ success: false, error: 'Only the proposal submitter can edit this draft.' }, 403);
    }

    // Executive actions (status decisions / supervisor assignment) are limited to coordinators & supervisors
    const executiveFields = ['status', 'supervisor_id'];
    const touchesExecutive = executiveFields.some((f) => body[f] !== undefined);
    if (touchesExecutive && !isExecutiveRole(userRole) && userRole !== 'supervisor') {
      return c.json({ success: false, error: 'Only executive roles and supervisors can approve or assign proposals' }, 403);
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
    await logAuditEvent(c.env.DB, userId, userRole, 'proposal_updated', {
      entityType: 'proposal',
      entityId: String(id),
      details: `Proposal ${updated?.title || id} updated`,
      metadata: { proposal_id: id, changed_fields: fields.map((field) => field.replace(' = ?', '').trim()) }
    });

    if (body.status !== undefined && updated) {
      await logAuditEvent(c.env.DB, userId, userRole, 'proposal_status_changed', {
        entityType: 'proposal',
        entityId: String(id),
        details: `Proposal status changed to ${body.status}`,
        metadata: { proposal_id: id, status: body.status, actor_id: userId, actor_role: userRole }
      });
      const statusLabel: Record<string, string> = {
        approved: 'approved',
        rejected: 'rejected',
        under_review: 'sent for review',
        revision_requested: 'sent back for revision',
      };
      const proposalStatusText = statusLabel[String(body.status)] || String(body.status);
      await createNotificationWithEmail(c.env, updated.submitted_by, {
        type: 'proposal',
        title: `Your proposal was ${proposalStatusText}`,
        body: `"${updated.title}" was ${proposalStatusText} by the coordinator.`,
        link_view: 'proposals',
        ref_id: id,
      });
      if (body.supervisor_id && body.supervisor_id !== '') {
        await createNotificationWithEmail(c.env, body.supervisor_id, {
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
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only students can submit proposals.' }, 403);
  }

  const proposal = await c.env.DB.prepare(
    'SELECT * FROM proposals WHERE id = ?'
  ).bind(id).first() as Record<string, any> | null;
  if (!proposal) return c.json({ success: false, error: 'Proposal not found' }, 404);

  if (proposal.submitted_by !== userId) {
    return c.json({ success: false, error: 'Only the group leader who created this proposal can submit it.' }, 403);
  }

  if (proposal.status !== 'draft') {
    return c.json({ success: false, error: 'This proposal has already been submitted and is locked.' }, 409);
  }

  const group = await c.env.DB.prepare(
    'SELECT leader_id FROM groups WHERE id = ?'
  ).bind(proposal.group_id).first() as { leader_id: string } | null;
  if (!group || group.leader_id !== userId) {
    return c.json({ success: false, error: 'Only the group leader can submit the proposal.' }, 403);
  }

  await c.env.DB.prepare("UPDATE proposals SET status = 'submitted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
  await logAuditEvent(c.env.DB, userId, userRole, 'proposal_submitted', {
    entityType: 'proposal',
    entityId: String(id),
    details: `Proposal ${updated?.title || id} submitted by group leader`,
    metadata: { proposal_id: id, group_id: proposal.group_id, submitted_by: userId }
  });
  return c.json({ success: true, data: updated });
});

export { proposalRoutes };
