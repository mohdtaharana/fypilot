import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

type Variables = { userId: string; userRole: string };
const projectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    `SELECT p.*, u.name as supervisor_name FROM projects p LEFT JOIN users u ON p.supervisor_id = u.id WHERE p.id = ?`
  ).bind(id).first();
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

  // Also fetch members and meetings
  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
  ).bind(id).all();

  const meetings = await c.env.DB.prepare(
    `SELECT * FROM meetings WHERE project_id = ? ORDER BY scheduled_at DESC LIMIT 10`
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
  } else if (userRole !== 'coordinator' && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators, supervisors and project members can update projects' }, 403);
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
  return c.json({ success: true, message: 'Screenshot removed.' });
});

// POST /api/projects/:id/feedback — coordinator/supervisor gives feedback (media_id optional = overall)
projectRoutes.post('/:id/feedback', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'coordinator' && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators and supervisors can give feedback' }, 403);
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
  return c.json({ success: true, message: 'Feedback posted!' }, 201);
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
