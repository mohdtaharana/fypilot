import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { logAuditEvent } from '../audit/audit.routes';
import { deleteProjectsCascade } from '../../utils/cascade';
import { requireBulkDeleteRole } from '../../utils/bulk-guard';

type Variables = { userId: string; userRole: string };
const projectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

// DELETE /api/projects/bulk — remove EVERY project.
// Registered before `/:id` so the literal path is matched first.
projectRoutes.delete('/bulk', async (c) => {
  const actor = await requireBulkDeleteRole(c);
  if (!actor) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can delete all projects' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL PROJECTS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const rows = await c.env.DB.prepare('SELECT id FROM projects').all();
    const projects = (rows.results || []) as Array<Record<string, any>>;
    if (projects.length === 0) {
      return c.json({ success: true, message: 'There are no projects to delete.', deleted: 0 });
    }

    const ids = projects.map((p) => p.id);
    await deleteProjectsCascade(c.env.DB, ids);

    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'projects_deleted_all', {
      entityType: 'project',
      entityId: '*',
      details: `All ${projects.length} project(s) deleted`,
      metadata: { scope: 'all', deleted_count: projects.length, project_ids: ids },
    });

    return c.json({
      success: true,
      message: `All ${projects.length} project(s) and their milestones, meetings and media were deleted.`,
      deleted: projects.length,
    });
  } catch (e: any) {
    console.error('Delete all projects error:', e);
    return c.json({ success: false, error: 'Failed to delete all projects: ' + (e?.message || 'unknown error') }, 500);
  }
});

// GET /api/projects
projectRoutes.get('/', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  const result = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id ORDER BY p.created_at DESC`
  ).all();

  let projects = result.results;
  if (userRole === 'student') {
    const memberProjects = await c.env.DB.prepare(
      'SELECT project_id FROM project_members WHERE user_id = ?'
    ).bind(userId).all();
    const memberProjectIds = new Set((memberProjects.results || []).map((r: any) => r.project_id));
    projects = projects.filter((p: any) => memberProjectIds.has(p.id));
  }

  return c.json({ success: true, data: projects });
});

// GET /api/projects/:id
projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name, pr.group_id as group_id
     FROM projects p
     LEFT JOIN users u ON p.supervisor_id = u.id
     LEFT JOIN proposals pr ON p.proposal_id = pr.id
     WHERE p.id = ?`
  ).bind(id).first();
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

  // Also fetch members, meetings, verified count, weekly updates, and evaluations
  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.student_id_num FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
  ).bind(id).all();

  const meetings = await c.env.DB.prepare(
    `SELECT m.*, u.name as student_name, s.name as supervisor_name
     FROM meetings m
     LEFT JOIN users u ON m.student_id = u.id
     LEFT JOIN users s ON m.supervisor_id = s.id
     WHERE m.project_id = ? ORDER BY m.meeting_date DESC, m.created_at DESC`
  ).bind(id).all();

  const verifiedRes = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM meetings WHERE project_id = ? AND verification_status = 'verified'`
  ).bind(id).first();
  const verifiedMeetingsCount = (verifiedRes?.count as number) || 0;

  const weeklyUpdates = await c.env.DB.prepare(
    `SELECT w.*, u.name as student_name FROM weekly_updates w JOIN users u ON w.student_id = u.id WHERE w.project_id = ? ORDER BY w.week_number DESC, w.created_at DESC`
  ).bind(id).all();

  const evaluations = await c.env.DB.prepare(
    `SELECT e.*, s.name as supervisor_name, u.name as student_name FROM evaluations e JOIN users s ON e.supervisor_id = s.id JOIN users u ON e.student_id = u.id WHERE e.project_id = ? ORDER BY e.created_at DESC`
  ).bind(id).all();

  const links = await c.env.DB.prepare(
    `SELECT * FROM project_links WHERE project_id = ? ORDER BY created_at ASC`
  ).bind(id).all();

  const media = await c.env.DB.prepare(
    `SELECT pm.*, u.name as uploader_name FROM project_media pm LEFT JOIN users u ON pm.uploaded_by = u.id
     WHERE pm.project_id = ? ORDER BY pm.created_at ASC`
  ).bind(id).all();

  const feedback = await c.env.DB.prepare(
    `SELECT pf.*, u.name as author_name, u.role as author_role FROM project_feedback pf
     JOIN users u ON pf.user_id = u.id
     WHERE pf.project_id = ? ORDER BY pf.created_at ASC`
  ).bind(id).all();

  const feedbackRows = feedback.results;
  const mediaWithFeedback = media.results.map((m: any) => ({
    ...m,
    feedback: feedbackRows.filter((f: any) => f.media_id === m.id)
  }));
  const overallFeedback = feedbackRows.filter((f: any) => !f.media_id);

  return c.json({
    success: true,
    data: {
      ...project,
      members: members.results,
      meetings: meetings.results,
      verifiedMeetingsCount,
      weeklyUpdates: weeklyUpdates.results,
      evaluations: evaluations.results,
      links: links.results,
      media: mediaWithFeedback,
      overallFeedback,
    }
  });
});

// POST /api/projects
projectRoutes.post('/', async (c) => {
  const body = await c.req.json();

  // Projects may only be created from an approved proposal
  if (!body.proposal_id) {
    return c.json({ success: false, error: 'A project can only be created from an approved proposal' }, 400);
  }
  const proposal = await c.env.DB.prepare('SELECT id, status FROM proposals WHERE id = ?').bind(body.proposal_id).first();
  if (!proposal || proposal.status !== 'approved') {
    return c.json({ success: false, error: 'Project creation requires the linked proposal to be approved first' }, 400);
  }

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
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', c.req.header('X-User-Role') || 'system', 'project_created', {
    entityType: 'project',
    entityId: String(id),
    details: `Project ${body.title || 'Untitled'} created`,
    metadata: { project_id: id, title: body.title || null, proposal_id: body.proposal_id || null }
  });
  return c.json({ success: true, data: project }, 201);
});

// PUT /api/projects/:id
projectRoutes.put('/:id', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const id = c.req.param('id');
  const body = await c.req.json();

  const isStudent = userRole === 'student';
  if (isStudent) {
    // Students may only report progress on a project they belong to
    const nonProgressKeys = Object.keys(body).filter(k => k !== 'progress');
    if (nonProgressKeys.length > 0) {
      return c.json({ success: false, error: 'Students can only update project progress' }, 403);
    }
    if (body.progress === undefined) {
      return c.json({ success: false, error: 'No progress value provided' }, 400);
    }
    const progress = Number(body.progress);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return c.json({ success: false, error: 'Progress must be a number between 0 and 100' }, 400);
    }
    const member = await c.env.DB.prepare(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
    ).bind(id, userId).first();
    if (!member) {
      return c.json({ success: false, error: 'You can only update progress on a project you belong to' }, 403);
    }
  } else if (!isExecutiveRole(userRole) && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean, supervisors and project members can update projects' }, 403);
  }

  const fields: string[] = [];
  const values: any[] = [];
  const allowedFields = ['title', 'description', 'status', 'health', 'progress', 'supervisor_id', 'start_date', 'end_date'];
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(field === 'progress' ? Number(body[field]) : body[field]);
    }
  }

  if (fields.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);
  
  fields.push("updated_at = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare(
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id WHERE p.id = ?`
  ).bind(id).first();
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', c.req.header('X-User-Role') || 'system', 'project_updated', {
    entityType: 'project',
    entityId: String(id),
    details: `Project ${updated?.title || id} updated`,
    metadata: { project_id: id, changed_fields: fields.map((field) => field.replace(' = ?', '').trim()) }
  });
  return c.json({ success: true, data: updated });
});

// POST /api/projects/:id/links — student member adds a deliverable link
projectRoutes.post('/:id/links', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only project members can add links' }, 403);
  }
  const member = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId).first();
  if (!member) return c.json({ success: false, error: 'You can only add links to a project you belong to' }, 403);

  const body = await c.req.json();
  const url = (body.url || '').trim();
  if (!url) return c.json({ success: false, error: 'Link URL is required' }, 400);
  const label = (body.label || '').trim() || url;

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO project_links (id, project_id, label, url) VALUES (?, ?, ?, ?)')
    .bind(id, projectId, label, url).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'project_link_created', {
    entityType: 'project_link',
    entityId: String(id),
    details: `Project link created for project ${projectId}`,
    metadata: { project_id: projectId, link_id: id, label, url }
  });
  return c.json({ success: true, message: 'Link added!' }, 201);
});

// DELETE /api/projects/:id/links/:linkId — student member removes a link
projectRoutes.delete('/:id/links/:linkId', async (c) => {
  const projectId = c.req.param('id');
  const linkId = c.req.param('linkId');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only project members can remove links' }, 403);
  }
  const member = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId).first();
  if (!member) return c.json({ success: false, error: 'You can only remove links from a project you belong to' }, 403);

  await c.env.DB.prepare('DELETE FROM project_links WHERE id = ? AND project_id = ?').bind(linkId, projectId).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'project_link_deleted', {
    entityType: 'project_link',
    entityId: String(linkId),
    details: `Project link deleted from project ${projectId}`,
    metadata: { project_id: projectId, link_id: linkId }
  });
  return c.json({ success: true, message: 'Link removed.' });
});

// POST /api/projects/:id/media — student member uploads a screenshot/image (base64 data URL)
projectRoutes.post('/:id/media', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only project members can upload screenshots' }, 403);
  }
  const member = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId).first();
  if (!member) return c.json({ success: false, error: 'You can only upload to a project you belong to' }, 403);

  const body = await c.req.json();
  const data = body.data;
  if (!data || typeof data !== 'string' || !data.startsWith('data:image/')) {
    return c.json({ success: false, error: 'Invalid image. Please upload a valid image.' }, 400);
  }
  const approxBytes = Math.floor(data.length * 3 / 4);
  if (approxBytes > 1000 * 1024) {
    return c.json({ success: false, error: 'Image is too large (max 1MB). Please use a smaller image.' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO project_media (id, project_id, uploaded_by, caption, data) VALUES (?, ?, ?, ?, ?)')
    .bind(id, projectId, userId, (body.caption || '').trim() || null, data).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'project_media_created', {
    entityType: 'project_media',
    entityId: String(id),
    details: `Project media uploaded for project ${projectId}`,
    metadata: { project_id: projectId, media_id: id, caption: (body.caption || '').trim() || null }
  });
  return c.json({ success: true, message: 'Screenshot uploaded!' }, 201);
});

// DELETE /api/projects/:id/media/:mediaId — student member removes a screenshot
projectRoutes.delete('/:id/media/:mediaId', async (c) => {
  const projectId = c.req.param('id');
  const mediaId = c.req.param('mediaId');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only project members can remove screenshots' }, 403);
  }
  const member = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId).first();
  if (!member) return c.json({ success: false, error: 'You can only remove screenshots from a project you belong to' }, 403);

  await c.env.DB.prepare('DELETE FROM project_feedback WHERE media_id = ?').bind(mediaId).run();
  await c.env.DB.prepare('DELETE FROM project_media WHERE id = ? AND project_id = ?').bind(mediaId, projectId).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'project_media_deleted', {
    entityType: 'project_media',
    entityId: String(mediaId),
    details: `Project media deleted from project ${projectId}`,
    metadata: { project_id: projectId, media_id: mediaId }
  });
  return c.json({ success: true, message: 'Screenshot removed.' });
});

// POST /api/projects/:id/feedback — coordinator/supervisor gives feedback (media_id optional = overall)
projectRoutes.post('/:id/feedback', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (!isExecutiveRole(userRole) && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean, and supervisors can give feedback' }, 403);
  }

  const body = await c.req.json();
  const message = (body.message || '').trim();
  if (!message) return c.json({ success: false, error: 'Feedback message is required' }, 400);

  const mediaId = body.media_id || null;
  if (mediaId) {
    const media = await c.env.DB.prepare('SELECT id FROM project_media WHERE id = ? AND project_id = ?').bind(mediaId, projectId).first();
    if (!media) return c.json({ success: false, error: 'Image not found in this project' }, 404);
  }

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO project_feedback (id, project_id, media_id, user_id, message) VALUES (?, ?, ?, ?, ?)')
    .bind(id, projectId, mediaId, userId, message).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'project_feedback_created', {
    entityType: 'project_feedback',
    entityId: String(id),
    details: `Feedback added to project ${projectId}`,
    metadata: { project_id: projectId, media_id: mediaId, message }
  });
  return c.json({ success: true, message: 'Feedback posted!' }, 201);
});

// ==========================================
// WEEKLY PROJECT UPDATES
// ==========================================

const LIFECYCLE_STAGES = [
  'Requirements Gathering',
  'Requirements Analysis',
  'Feasibility Analysis',
  'Planning',
  'System Design',
  'Architecture Design',
  'UI/UX Design',
  'Database Design',
  'Development',
  'Integration',
  'Testing',
  'Debugging',
  'Deployment',
  'Documentation',
  'Maintenance',
  'Research',
  'Presentation Preparation',
  'Other'
];

// GET /api/projects/:id/weekly-updates — fetch project weekly updates
projectRoutes.get('/:id/weekly-updates', async (c) => {
  const projectId = c.req.param('id');
  const result = await c.env.DB.prepare(
    `SELECT w.*, u.name as student_name, u.email as student_email
     FROM weekly_updates w JOIN users u ON w.student_id = u.id
     WHERE w.project_id = ? ORDER BY w.week_number DESC, w.created_at DESC`
  ).bind(projectId).all();

  return c.json({ success: true, data: result.results });
});

// POST /api/projects/:id/weekly-updates — submit weekly project update
projectRoutes.post('/:id/weekly-updates', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';

  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only students can submit weekly project updates' }, 403);
  }

  const member = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId).first();
  if (!member) {
    return c.json({ success: false, error: 'You can only submit updates for your assigned project' }, 403);
  }

  const body = await c.req.json();
  const { week_number, work_done, progress_pct, description, planned_work, lifecycle_stage } = body;

  if (!week_number || isNaN(Number(week_number))) {
    return c.json({ success: false, error: 'Week number is required and must be a number' }, 400);
  }

  if (!work_done || !work_done.trim()) {
    return c.json({ success: false, error: 'Work done summary is required' }, 400);
  }

  if (!description || !description.trim()) {
    return c.json({ success: false, error: 'Short description is required' }, 400);
  }

  if (!planned_work || !planned_work.trim()) {
    return c.json({ success: false, error: 'Next planned work is required' }, 400);
  }

  if (!lifecycle_stage || !LIFECYCLE_STAGES.includes(lifecycle_stage)) {
    return c.json({
      success: false,
      error: `Invalid lifecycle stage. Must be one of: ${LIFECYCLE_STAGES.join(', ')}`
    }, 400);
  }

  const id = generateId();
  const progressVal = progress_pct !== undefined ? Math.min(100, Math.max(0, Number(progress_pct))) : 0;

  await c.env.DB.prepare(
    `INSERT INTO weekly_updates (id, project_id, student_id, week_number, work_done, progress_pct, description, planned_work, lifecycle_stage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, projectId, userId, Number(week_number), work_done.trim(), progressVal, description.trim(), planned_work.trim(), lifecycle_stage
  ).run();
  await logAuditEvent(c.env.DB, userId, userRole, 'weekly_update_created', {
    entityType: 'weekly_update',
    entityId: String(id),
    details: `Weekly update submitted for project ${projectId}`,
    metadata: { project_id: projectId, week_number: Number(week_number), progress_pct: progressVal }
  });

  // Optionally update project overall progress if progressVal > project.progress
  if (progressVal > 0) {
    await c.env.DB.prepare(
      `UPDATE projects SET progress = MAX(progress, ?), updated_at = datetime('now') WHERE id = ?`
    ).bind(progressVal, projectId).run();
  }

  const updateRecord = await c.env.DB.prepare('SELECT * FROM weekly_updates WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updateRecord, message: 'Weekly update submitted successfully!' }, 201);
});

// PUT /api/projects/:id/weekly-updates/:updateId/feedback — supervisor/coordinator adds feedback to weekly update
projectRoutes.put('/:id/weekly-updates/:updateId/feedback', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'supervisor' && !isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only supervisors and executive roles can provide feedback on weekly updates' }, 403);
  }

  const updateId = c.req.param('updateId');
  const body = await c.req.json();
  const feedback = (body.feedback || '').trim();

  if (!feedback) {
    return c.json({ success: false, error: 'Feedback text is required' }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE weekly_updates SET supervisor_feedback = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(feedback, updateId).run();
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'weekly_update_feedback_added', {
    entityType: 'weekly_update',
    entityId: String(updateId),
    details: `Supervisor feedback added to weekly update ${updateId}`,
    metadata: { project_id: c.req.param('id'), feedback }
  });

  return c.json({ success: true, message: 'Feedback added to weekly update.' });
});

// ==========================================
// MEETING VERIFICATION WORKFLOW
// ==========================================

// POST /api/projects/:id/meetings — Student adds a meeting record (PENDING VERIFICATION)
projectRoutes.post('/:id/meetings', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only students can submit meeting records for supervisor verification' }, 403);
  }

  const body = await c.req.json();
  const project = await c.env.DB.prepare('SELECT supervisor_id FROM projects WHERE id = ?').bind(projectId).first();
  const supervisorId = body.supervisor_id || (project ? project.supervisor_id : null);

  const id = generateId();
  const meetingDate = body.meeting_date || body.scheduled_at || new Date().toISOString().split('T')[0];

  // Note: verification_status is set to 'pending'. This DOES NOT increment verified meeting count.
  await c.env.DB.prepare(
    `INSERT INTO meetings (
      id, project_id, student_id, supervisor_id, title, scheduled_at, meeting_date,
      discussion, work_discussed, action_items, next_meeting_plan, verification_status, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'completed')`
  ).bind(
    id,
    projectId,
    userId,
    supervisorId,
    body.title || `Supervisor Meeting (${meetingDate})`,
    meetingDate,
    meetingDate,
    body.discussion || body.notes || null,
    body.work_discussed || null,
    body.action_items || null,
    body.next_meeting_plan || null
  ).run();

  const meeting = await c.env.DB.prepare('SELECT * FROM meetings WHERE id = ?').bind(id).first();
  await logAuditEvent(c.env.DB, userId, userRole, 'meeting_created', {
    entityType: 'meeting',
    entityId: String(id),
    details: `Meeting record created for project ${projectId}`,
    metadata: { project_id: projectId, meeting_id: id, meeting_date: meetingDate }
  });
  return c.json({
    success: true,
    data: meeting,
    message: 'Meeting submitted! Pending verification by supervisor.'
  }, 201);
});

// GET /api/projects/:id/meetings — Fetch all meetings with verification status
projectRoutes.get('/:id/meetings', async (c) => {
  const projectId = c.req.param('id');
  const result = await c.env.DB.prepare(
    `SELECT m.*, u.name as student_name, s.name as supervisor_name
     FROM meetings m
     LEFT JOIN users u ON m.student_id = u.id
     LEFT JOIN users s ON m.supervisor_id = s.id
     WHERE m.project_id = ? ORDER BY m.meeting_date DESC, m.created_at DESC`
  ).bind(projectId).all();

  return c.json({ success: true, data: result.results });
});

// PUT /api/projects/:id/meetings/:meetingId/verify — Supervisor verifies / rejects / requests changes for a meeting
projectRoutes.put('/:id/meetings/:meetingId/verify', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'supervisor' && !isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only supervisors and executive roles can verify meetings' }, 403);
  }

  const meetingId = c.req.param('meetingId');
  const body = await c.req.json();
  const { action, feedback } = body;

  if (!['verify', 'reject', 'request_changes'].includes(action)) {
    return c.json({ success: false, error: 'Action must be verify, reject, or request_changes' }, 400);
  }

  const newStatus = action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : 'revision_requested';

  await c.env.DB.prepare(
    `UPDATE meetings SET
      verification_status = ?,
      supervisor_feedback = ?,
      verified_at = datetime('now')
     WHERE id = ?`
  ).bind(newStatus, feedback || null, meetingId).run();
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'meeting_verified', {
    entityType: 'meeting',
    entityId: String(meetingId),
    details: `Meeting verification status changed to ${newStatus}`,
    metadata: { project_id: c.req.param('id'), meeting_id: meetingId, action, feedback: feedback || null }
  });

  return c.json({
    success: true,
    message: `Meeting status updated to ${newStatus}. ${newStatus === 'verified' ? 'Verified meeting count updated.' : ''}`
  });
});

// ==========================================
// STUDENT EVALUATIONS
// ==========================================

// POST /api/projects/:id/evaluations — Supervisor submits student evaluation
projectRoutes.post('/:id/evaluations', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const supervisorId = c.req.header('X-User-Id') || 'demo-user';

  if (userRole !== 'supervisor' && !isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only supervisors and executive roles can submit student evaluations' }, 403);
  }

  const projectId = c.req.param('id');
  const body = await c.req.json();
  const { student_id, grade, score, comments } = body;

  if (!student_id) {
    return c.json({ success: false, error: 'Student ID is required for evaluation' }, 400);
  }

  if (!comments || !comments.trim()) {
    return c.json({ success: false, error: 'Evaluation comments/feedback are required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO evaluations (id, project_id, student_id, supervisor_id, grade, score, comments)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, student_id, supervisorId, grade || null, score ? Number(score) : null, comments.trim()).run();

  const evalRecord = await c.env.DB.prepare('SELECT * FROM evaluations WHERE id = ?').bind(id).first();
  await logAuditEvent(c.env.DB, supervisorId, userRole, 'evaluation_created', {
    entityType: 'evaluation',
    entityId: String(id),
    details: `Evaluation created for student ${student_id}`,
    metadata: { project_id: projectId, student_id, supervisor_id: supervisorId, grade: grade || null, score: score ? Number(score) : null }
  });
  return c.json({ success: true, data: evalRecord, message: 'Student evaluation submitted successfully.' }, 201);
});

// GET /api/projects/:id/evaluations — List evaluations for a project
projectRoutes.get('/:id/evaluations', async (c) => {
  const projectId = c.req.param('id');
  const result = await c.env.DB.prepare(
    `SELECT e.*, s.name as supervisor_name, u.name as student_name
     FROM evaluations e
     JOIN users s ON e.supervisor_id = s.id
     JOIN users u ON e.student_id = u.id
     WHERE e.project_id = ? ORDER BY e.created_at DESC`
  ).bind(projectId).all();

  return c.json({ success: true, data: result.results });
});

export { projectRoutes };
