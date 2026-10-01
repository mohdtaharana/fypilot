import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { logAuditEvent } from '../audit/audit.routes';

const defenseRoutes = new Hono<{ Bindings: Env }>();
const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

const DEFAULT_DEFENSE_CONFIG = {
  submission_deadline: null,
  presentation_start: '09:00',
  presentation_end: '17:00',
  default_duration_minutes: 15,
};

const DEFENSE_UPLOAD_RULES = {
  pptx_file: { allowedMime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'], allowedExt: ['.pptx', '.ppt'], maxBytes: 100 * 1024 * 1024 },
  pptx_pdf_file: { allowedMime: ['application/pdf'], allowedExt: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
  docx_file: { allowedMime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'], allowedExt: ['.docx', '.doc'], maxBytes: 100 * 1024 * 1024 },
  docx_pdf_file: { allowedMime: ['application/pdf'], allowedExt: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
};

function parseDataUrlMime(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return null;
  const match = /^data:([^;,]+);base64,/i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

function validateDefenseDataUrl(fieldName: string, value: string | null | undefined) {
  const rule = DEFENSE_UPLOAD_RULES[fieldName as keyof typeof DEFENSE_UPLOAD_RULES];
  if (!rule) return true;
  if (!value) return false;

  const mime = parseDataUrlMime(value);
  if (!mime) return false;
  const name = String(value || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';

  const mimeAllowed = rule.allowedMime.includes(mime);
  const extAllowed = rule.allowedExt.includes(ext);
  if (!mimeAllowed && !extAllowed) return false;

  const base64 = value.split(',')[1] || '';
  const padded = base64.length % 4;
  const bytes = Math.ceil((base64.length * 3) / 4) - (padded === 0 ? 0 : 4 - padded);
  if (bytes > rule.maxBytes) return false;

  return true;
}

async function ensureDefenseTables(db: Env['DB']) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS defense_deadlines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Final Defense',
      submission_deadline TEXT,
      presentation_start TEXT NOT NULL DEFAULT '09:00',
      presentation_end TEXT NOT NULL DEFAULT '17:00',
      default_duration_minutes INTEGER NOT NULL DEFAULT 15,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS defense_submissions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      project_id TEXT,
      group_name TEXT,
      pptx_file TEXT,
      pptx_pdf_file TEXT,
      docx_file TEXT,
      docx_pdf_file TEXT,
      notes TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'pending', 'approved', 'rejected'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS defense_slots (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL UNIQUE,
      project_id TEXT,
      group_name TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 15,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  try {
    await db.prepare(`ALTER TABLE defense_submissions ADD COLUMN created_at TEXT DEFAULT (datetime('now'))`).run();
  } catch (error: any) {
    const message = String(error?.message || '');
    if (!message.toLowerCase().includes('duplicate column name')) {
      throw error;
    }
  }

  await db.prepare(`UPDATE defense_submissions SET created_at = COALESCE(created_at, uploaded_at, datetime('now')) WHERE created_at IS NULL`).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_deadlines_created ON defense_deadlines(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_submissions_group ON defense_submissions(group_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_submissions_status ON defense_submissions(status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_submissions_created ON defense_submissions(created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_slots_group ON defense_slots(group_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_defense_slots_status ON defense_slots(status)`).run();
}

defenseRoutes.use('*', async (c, next) => {
  await ensureDefenseTables(c.env.DB);
  await next();
});

function toDateTimeValue(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function resolveGroupIdsForUser(db: Env['DB'], userId: string) {
  const result = await db.prepare(
    'SELECT group_id FROM group_members WHERE user_id = ?'
  ).bind(userId).all();
  return (result.results || []).map((row: any) => row.group_id);
}

async function resolveGroupName(db: Env['DB'], groupId: string) {
  const result = await db.prepare('SELECT name FROM groups WHERE id = ?').bind(groupId).first() as { name?: string } | null;
  return result?.name || 'Unknown Group';
}

function parseFileRecord(value: any) {
  if (!value || typeof value !== 'string') return null;
  return value.trim() ? value : null;
}

function safeDateLabel(value: string | null | undefined) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// GET /api/defense/config
 defenseRoutes.get('/config', async (c) => {
  const config = await c.env.DB.prepare(
    'SELECT * FROM defense_deadlines ORDER BY created_at DESC LIMIT 1'
  ).first() as Record<string, any> | null;

  const normalized = config ? {
    id: config.id,
    title: config.title || 'Final Defense',
    submission_deadline: config.submission_deadline,
    presentation_start: config.presentation_start || DEFAULT_DEFENSE_CONFIG.presentation_start,
    presentation_end: config.presentation_end || DEFAULT_DEFENSE_CONFIG.presentation_end,
    default_duration_minutes: Number(config.default_duration_minutes || DEFAULT_DEFENSE_CONFIG.default_duration_minutes),
    created_at: config.created_at,
  } : {
    id: null,
    title: 'Final Defense',
    submission_deadline: null,
    presentation_start: DEFAULT_DEFENSE_CONFIG.presentation_start,
    presentation_end: DEFAULT_DEFENSE_CONFIG.presentation_end,
    default_duration_minutes: DEFAULT_DEFENSE_CONFIG.default_duration_minutes,
    created_at: null,
  };

  return c.json({ success: true, data: normalized });
});

// POST /api/defense/config
 defenseRoutes.post('/config', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can set defense deadlines.' }, 403);
  }

  const body = await c.req.json();
  const configId = generateId();
  const payload = {
    id: configId,
    title: body.title || 'Final Defense',
    submission_deadline: toDateTimeValue(body.submission_deadline) || null,
    presentation_start: body.presentation_start || DEFAULT_DEFENSE_CONFIG.presentation_start,
    presentation_end: body.presentation_end || DEFAULT_DEFENSE_CONFIG.presentation_end,
    default_duration_minutes: Number(body.default_duration_minutes || DEFAULT_DEFENSE_CONFIG.default_duration_minutes),
    created_at: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `INSERT INTO defense_deadlines (id, title, submission_deadline, presentation_start, presentation_end, default_duration_minutes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.id,
    payload.title,
    payload.submission_deadline,
    payload.presentation_start,
    payload.presentation_end,
    payload.default_duration_minutes,
    payload.created_at
  ).run();

  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'defense_config_updated', {
    entityType: 'defense',
    entityId: String(configId),
    details: `Defense deadline configuration updated`,
    metadata: payload
  });

  return c.json({ success: true, data: payload });
});

function buildDefaultSlotsFromWindow(startTime: string, endTime: string, durationMinutes: number) {
  const [startHour, startMinute] = String(startTime || '09:00').split(':').map(Number);
  const [endHour, endMinute] = String(endTime || '17:00').split(':').map(Number);

  const dayBase = new Date();
  dayBase.setHours(0, 0, 0, 0);

  const start = new Date(dayBase);
  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(dayBase);
  end.setHours(endHour, endMinute, 0, 0);

  const slots: { start_time: string; end_time: string }[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    if (slotEnd > end) break;
    slots.push({
      start_time: cursor.toISOString(),
      end_time: slotEnd.toISOString(),
    });
    cursor = slotEnd;
  }

  return slots;
}

// POST /api/defense/auto-schedule
 defenseRoutes.post('/auto-schedule', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can auto-schedule defense slots.' }, 403);
  }

  const config = await c.env.DB.prepare(
    'SELECT * FROM defense_deadlines ORDER BY created_at DESC LIMIT 1'
  ).first() as Record<string, any> | null;

  const defaultStart = config?.presentation_start || DEFAULT_DEFENSE_CONFIG.presentation_start;
  const defaultEnd = config?.presentation_end || DEFAULT_DEFENSE_CONFIG.presentation_end;
  const durationMinutes = Number(config?.default_duration_minutes || DEFAULT_DEFENSE_CONFIG.default_duration_minutes);

  const groups = await c.env.DB.prepare(
    "SELECT * FROM defense_submissions WHERE status IN ('submitted', 'pending') ORDER BY COALESCE(created_at, uploaded_at) ASC"
  ).all();

  const slots = buildDefaultSlotsFromWindow(defaultStart, defaultEnd, durationMinutes);
  const existingBooked = await c.env.DB.prepare(
    "SELECT start_time, end_time FROM defense_slots WHERE start_time IS NOT NULL AND end_time IS NOT NULL AND status = 'scheduled'"
  ).all();

  const reservedRanges = (existingBooked.results || []).map((row: any) => ({
    start: new Date(row.start_time),
    end: new Date(row.end_time),
  }));

  const scheduled = [];
  let nextSlotCursor = 0;

  for (let i = 0; i < groups.results.length; i++) {
    const group = groups.results[i] as Record<string, any>;
    let planned: { start_time: string | null; end_time: string | null } = { start_time: null, end_time: null };

    for (let index = nextSlotCursor; index < slots.length; index++) {
      const candidate = slots[index];
      const candidateStart = new Date(candidate.start_time);
      const candidateEnd = new Date(candidate.end_time);
      const overlapsExisting = reservedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start);
      if (!overlapsExisting) {
        planned = candidate;
        nextSlotCursor = index + 1;
        reservedRanges.push({ start: candidateStart, end: candidateEnd });
        break;
      }
    }

    const slotId = generateId();
    const slotRecord = {
      id: slotId,
      group_id: group.group_id,
      project_id: group.project_id,
      group_name: group.group_name || 'Group',
      start_time: planned.start_time || null,
      end_time: planned.end_time || null,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    const existing = await c.env.DB.prepare(
      'SELECT id FROM defense_slots WHERE group_id = ?'
    ).bind(group.group_id).first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE defense_slots SET group_id = ?, project_id = ?, group_name = ?, start_time = ?, end_time = ?, duration_minutes = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(
        slotRecord.group_id,
        slotRecord.project_id,
        slotRecord.group_name,
        slotRecord.start_time,
        slotRecord.end_time,
        slotRecord.duration_minutes,
        slotRecord.status,
        existing.id
      ).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO defense_slots (id, group_id, project_id, group_name, start_time, end_time, duration_minutes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        slotRecord.id,
        slotRecord.group_id,
        slotRecord.project_id,
        slotRecord.group_name,
        slotRecord.start_time,
        slotRecord.end_time,
        slotRecord.duration_minutes,
        slotRecord.status,
        slotRecord.created_at
      ).run();
    }

    scheduled.push({
      group_id: group.group_id,
      group_name: group.group_name,
      start_time: slotRecord.start_time,
      end_time: slotRecord.end_time,
    });
  }

  return c.json({ success: true, data: { scheduled, default_duration_minutes: durationMinutes } });
});

// GET /api/defense
 defenseRoutes.get('/', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'guest';

  const config = await c.env.DB.prepare(
    'SELECT * FROM defense_deadlines ORDER BY created_at DESC LIMIT 1' 
  ).first() as Record<string, any> | null;

  let query = `
    SELECT ds.*, g.name as group_name, s.id as slot_id, s.start_time as slot_start, s.end_time as slot_end, s.duration_minutes as slot_duration
    FROM defense_submissions ds
    LEFT JOIN groups g ON g.id = ds.group_id
    LEFT JOIN defense_slots s ON s.group_id = ds.group_id
    ORDER BY COALESCE(ds.created_at, ds.uploaded_at) DESC
  `;

  let rows = await c.env.DB.prepare(query).all();

  if (userRole === 'student') {
    const eligibleGroupIds = new Set(await resolveGroupIdsForUser(c.env.DB, userId));
    rows.results = (rows.results || []).filter((row: any) => eligibleGroupIds.has(row.group_id));
  }

  const result = (rows.results || []).map((row: any) => ({
    id: row.id,
    group_id: row.group_id,
    project_id: row.project_id,
    group_name: row.group_name || 'Unknown Group',
    pptx_file: parseFileRecord(row.pptx_file),
    pptx_pdf_file: parseFileRecord(row.pptx_pdf_file),
    docx_file: parseFileRecord(row.docx_file),
    docx_pdf_file: parseFileRecord(row.docx_pdf_file),
    status: row.status || 'pending',
    uploaded_by: row.uploaded_by,
    uploaded_at: row.uploaded_at,
    slot_id: row.slot_id,
    slot_start: row.slot_start,
    slot_end: row.slot_end,
    slot_duration: row.slot_duration || config?.default_duration_minutes || DEFAULT_DEFENSE_CONFIG.default_duration_minutes,
  }));

  return c.json({
    success: true,
    data: {
      config: config ? {
        id: config.id,
        title: config.title || 'Final Defense',
        submission_deadline: config.submission_deadline,
        presentation_start: config.presentation_start || DEFAULT_DEFENSE_CONFIG.presentation_start,
        presentation_end: config.presentation_end || DEFAULT_DEFENSE_CONFIG.presentation_end,
        default_duration_minutes: Number(config.default_duration_minutes || DEFAULT_DEFENSE_CONFIG.default_duration_minutes),
      } : {
        id: null,
        title: 'Final Defense',
        submission_deadline: null,
        presentation_start: DEFAULT_DEFENSE_CONFIG.presentation_start,
        presentation_end: DEFAULT_DEFENSE_CONFIG.presentation_end,
        default_duration_minutes: DEFAULT_DEFENSE_CONFIG.default_duration_minutes,
      },
      submissions: result,
    }
  });
});

// POST /api/defense/upload
 defenseRoutes.post('/upload', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();

  if (userRole === 'student') {
    const groupIds = new Set(await resolveGroupIdsForUser(c.env.DB, userId));
    if (!body.group_id || !groupIds.has(body.group_id)) {
      return c.json({ success: false, error: 'You can only upload defense documents for your own group.' }, 403);
    }

    const group = await c.env.DB.prepare('SELECT leader_id FROM groups WHERE id = ?').bind(body.group_id).first() as { leader_id?: string } | null;
    if (!group || group.leader_id !== userId) {
      return c.json({ success: false, error: 'Only the group leader can upload defense files.' }, 403);
    }
  }

  const groupId = body.group_id;
  const groupName = (body.group_name || await resolveGroupName(c.env.DB, groupId) || 'Unknown Group').trim();
  const projectId = body.project_id || null;

  const requiredFields = ['pptx_file', 'pptx_pdf_file', 'docx_file', 'docx_pdf_file'];
  for (const field of requiredFields) {
    if (!validateDefenseDataUrl(field, body[field])) {
      return c.json({ success: false, error: `Invalid ${field.replace('_file', '').replace('_', ' ')} upload. Only the allowed file type is accepted.` }, 400);
    }
  }

  const payload = {
    id: generateId(),
    group_id: groupId,
    project_id: projectId,
    group_name: groupName,
    pptx_file: parseFileRecord(body.pptx_file),
    pptx_pdf_file: parseFileRecord(body.pptx_pdf_file),
    docx_file: parseFileRecord(body.docx_file),
    docx_pdf_file: parseFileRecord(body.docx_pdf_file),
    notes: body.notes || null,
    uploaded_by: userId,
    uploaded_at: new Date().toISOString(),
    status: 'submitted',
  };

  if (!payload.group_id) {
    return c.json({ success: false, error: 'Group is required for defense submission.' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM defense_submissions WHERE group_id = ?').bind(groupId).first();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE defense_submissions SET project_id = ?, group_name = ?, pptx_file = ?, pptx_pdf_file = ?, docx_file = ?, docx_pdf_file = ?, notes = ?, uploaded_by = ?, uploaded_at = ?, status = ? WHERE group_id = ?`
    ).bind(
      payload.project_id,
      payload.group_name,
      payload.pptx_file,
      payload.pptx_pdf_file,
      payload.docx_file,
      payload.docx_pdf_file,
      payload.notes,
      payload.uploaded_by,
      payload.uploaded_at,
      payload.status,
      payload.group_id
    ).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO defense_submissions (id, group_id, project_id, group_name, pptx_file, pptx_pdf_file, docx_file, docx_pdf_file, notes, uploaded_by, uploaded_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.id,
      payload.group_id,
      payload.project_id,
      payload.group_name,
      payload.pptx_file,
      payload.pptx_pdf_file,
      payload.docx_file,
      payload.docx_pdf_file,
      payload.notes,
      payload.uploaded_by,
      payload.uploaded_at,
      payload.status
    ).run();
  }

  return c.json({ success: true, data: payload });
});

// PUT /api/defense/slots/:id
 defenseRoutes.put('/slots/:id', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can manage defense time slots.' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT * FROM defense_slots WHERE id = ?').bind(id).first();
  const groupId = body.group_id || (existing as any)?.group_id || null;

  if (!existing && !groupId) {
    return c.json({ success: false, error: 'Defense slot not found.' }, 404);
  }

  const startTime = body.start_time || (existing as any)?.start_time;
  const endTime = body.end_time || (existing as any)?.end_time || startTime;
  const durationMinutes = Number(body.duration_minutes || (existing as any)?.duration_minutes || 15);

  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (start && end && start.getTime() >= end.getTime()) {
    return c.json({ success: false, error: 'Defense slot end time must be after the start time.' }, 400);
  }

  const overlapping = await c.env.DB.prepare(
    `SELECT id, group_id, start_time, end_time FROM defense_slots WHERE status = 'scheduled' AND group_id != ? AND start_time IS NOT NULL AND end_time IS NOT NULL`
  ).bind(groupId).all();

  const overlapFound = (overlapping.results || []).some((row: any) => {
    if (!row.start_time || !row.end_time) return false;
    const rowStart = new Date(row.start_time);
    const rowEnd = new Date(row.end_time);
    return start && end && rowStart < end && rowEnd > start;
  });

  if (overlapFound) {
    return c.json({ success: false, error: 'This time overlaps with another group’s defense slot.' }, 409);
  }

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE defense_slots SET start_time = ?, end_time = ?, duration_minutes = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(startTime, endTime, durationMinutes, body.status || 'scheduled', id).run();
    return c.json({ success: true, data: { id, start_time: startTime, end_time: endTime, duration_minutes: durationMinutes } });
  }

  const groupMeta = groupId ? await c.env.DB.prepare('SELECT group_id, project_id, group_name FROM defense_submissions WHERE group_id = ?').bind(groupId).first() as Record<string, any> | null : null;
  const slotId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO defense_slots (id, group_id, project_id, group_name, start_time, end_time, duration_minutes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slotId,
    groupId,
    groupMeta?.project_id || null,
    groupMeta?.group_name || 'Group',
    startTime,
    endTime,
    durationMinutes,
    body.status || 'scheduled',
    new Date().toISOString()
  ).run();

  return c.json({ success: true, data: { id: slotId, group_id: groupId, start_time: startTime, end_time: endTime, duration_minutes: durationMinutes } });
});

// GET /api/defense/groups/:groupId/download
 defenseRoutes.get('/groups/:groupId/download', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'guest';
  const groupId = c.req.param('groupId');

  if (userRole === 'student') {
    const groupIds = new Set(await resolveGroupIdsForUser(c.env.DB, userId));
    if (!groupIds.has(groupId)) {
      return c.json({ success: false, error: 'You can only download your own group documents.' }, 403);
    }
  }

  const reviewRoles = new Set(['coordinator', 'hod', 'dean', 'supervisor']);
  if (!reviewRoles.has(userRole) && userRole !== 'student') {
    return c.json({ success: false, error: 'You do not have access to defense documents.' }, 403);
  }

  const submission = await c.env.DB.prepare(
    `SELECT ds.*, g.name as group_name, s.start_time, s.end_time FROM defense_submissions ds
     LEFT JOIN groups g ON g.id = ds.group_id
     LEFT JOIN defense_slots s ON s.group_id = ds.group_id
     WHERE ds.group_id = ?`
  ).bind(groupId).first() as Record<string, any> | null;

  if (!submission) {
    return c.json({ success: false, error: 'No defense upload found for this group.' }, 404);
  }

  const documents = [
    { file_name: `${(submission.group_name || 'group').replace(/[^a-zA-Z0-9_-]+/g, '_')}-pptx.pptx`, data_url: submission.pptx_file },
    { file_name: `${(submission.group_name || 'group').replace(/[^a-zA-Z0-9_-]+/g, '_')}-pptx.pdf`, data_url: submission.pptx_pdf_file },
    { file_name: `${(submission.group_name || 'group').replace(/[^a-zA-Z0-9_-]+/g, '_')}-docx.docx`, data_url: submission.docx_file },
    { file_name: `${(submission.group_name || 'group').replace(/[^a-zA-Z0-9_-]+/g, '_')}-docx.pdf`, data_url: submission.docx_pdf_file },
  ].filter((doc) => doc.data_url);

  return c.json({
    success: true,
    data: {
      group_id: groupId,
      group_name: submission.group_name || 'Unknown Group',
      slot_start: submission.start_time,
      slot_end: submission.end_time,
      documents,
    }
  });
});

export { defenseRoutes };
