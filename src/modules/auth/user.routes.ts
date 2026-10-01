import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { deleteGroupsCascade, deleteProjectsCascade, deleteUsersCascade } from '../../utils/cascade';
import { requireBulkDeleteRole } from '../../utils/bulk-guard';
import {
  clearedSessionCookie,
  createSession,
  destroySession,
  readSessionToken,
  resolveSessionRole,
  sessionCookie,
} from '../../utils/session';
import { createNotification, notifyRole } from '../notifications/notification.routes';
import { logAuditEvent } from '../audit/audit.routes';
import { ensureUserDocumentColumns, isPdfDataUrl, validateMemberDocuments } from '../groups/member-docs';

const userRoutes = new Hono<{ Bindings: Env }>();
const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

userRoutes.use('*', async (c, next) => {
  await ensureUserDocumentColumns(c.env.DB);
  await next();
});

// DELETE /api/users/bulk — remove EVERY student account.
// Supervisors and executive accounts are deliberately left untouched.
// Registered before `/:id` so the literal path is matched first.
userRoutes.delete('/bulk', async (c) => {
  const actor = await requireBulkDeleteRole(c);
  if (!actor) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can delete all students' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL STUDENTS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const rows = await c.env.DB.prepare(
      "SELECT id FROM users WHERE role = 'student'"
    ).all();
    const students = (rows.results || []) as Array<Record<string, any>>;
    if (students.length === 0) {
      return c.json({ success: true, message: 'There are no student accounts to delete.', deleted: 0 });
    }

    await deleteUsersCascade(c.env.DB, students.map((s) => s.id));

    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'users_deleted_all', {
      entityType: 'user',
      entityId: '*',
      details: `All ${students.length} student account(s) deleted`,
      metadata: { scope: 'all_students', deleted_count: students.length, user_ids: students.map((s) => s.id) },
    });

    return c.json({
      success: true,
      message: `All ${students.length} student account(s) and their groups, proposals and projects were deleted.`,
      deleted: students.length,
    });
  } catch (e: any) {
    console.error('Delete all students error:', e);
    return c.json({ success: false, error: 'Failed to delete all students: ' + (e?.message || 'unknown error') }, 500);
  }
});

/**
 * Executive accounts are self-healing: created on first boot if missing, and
 * re-asserted afterwards.
 *
 * These are the project's testing credentials. The emails are the maintainer's
 * personal addresses so a single inbox set can drive every role during demos;
 * the shared password is fixed and unhashed. Replace both with real
 * institutional accounts and a hashed password before this is exposed to
 * anyone outside the team.
 */
async function ensureExecutiveAccounts(db: Env['DB']) {
  if (!db) return;
  const required = [
    { id: 'coord-1', email: 'rtmea85@gmail.com', name: 'Dr. Admin Coordinator', role: 'coordinator' },
    { id: 'hod-1', email: 'rtmea84@gmail.com', name: 'Dr. HOD', role: 'hod' },
    { id: 'dean-1', email: 'dev.ranataha@gmail.com', name: 'Dr. Dean', role: 'dean' },
  ];

  for (const user of required) {
    try {
      const existing = await db.prepare(
        'SELECT id, email FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1'
      ).bind(user.id, user.email).first<{ id: string; email: string }>();

      if (!existing) {
        await db.prepare(
          `INSERT INTO users (id, email, name, role, department, status, password)
           VALUES (?, ?, ?, ?, 'Computer Science', 'active', 'TahaRana@123')`
        ).bind(user.id, user.email, user.name, user.role).run();
      } else {
        await db.prepare(
          `UPDATE users SET email = ?, name = ?, role = ?, department = COALESCE(department, 'Computer Science'), status = 'active', password = COALESCE(password, 'TahaRana@123') WHERE id = ?`
        ).bind(user.email, user.name, user.role, existing.id).run();
      }
    } catch (err) {
      console.error('ensureExecutiveAccounts error for', user.id, err);
    }
  }
}

// POST /api/users/login
userRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { password, username } = body;

  if (!username || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }

  if (c.env && c.env.DB) {
    await ensureExecutiveAccounts(c.env.DB);
  }

  const aliasMap: Record<string, string> = {
    'admin@university.edu': 'rtmea85@gmail.com',
    'coordinator@university.edu': 'rtmea85@gmail.com',
    'hod@university.edu': 'rtmea84@gmail.com',
    'dean@university.edu': 'dev.ranataha@gmail.com',
  };
  const normalizedUsername = aliasMap[username.toLowerCase().trim()] || username.trim();

  // Look up the user by email or student ID
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, status, password, avatar, internship_certificate, internship_filename, transcript_certificate, transcript_filename FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(student_id_num) = LOWER(?)'
  ).bind(normalizedUsername, normalizedUsername).first() as Record<string, unknown> | null;

  if (user) {
    // Enforce approval status
    if (user.status === 'pending') {
      return c.json({
        success: false,
        error: 'Your account is pending coordinator approval. Once approved, you can log in.'
      }, 403);
    }
    if (user.status === 'rejected') {
      return c.json({
        success: false,
        error: 'Your registration request was rejected. Please contact the coordinator.'
      }, 403);
    }

    // Check password — custom password if set, or role default password for seeded accounts
    if (user.password) {
      if (user.password !== password) {
        return c.json({ success: false, error: 'Incorrect password. Please try again.' }, 401);
      }
    } else {
      // Default passwords for seeded accounts
      const defaultPasswords: Record<string, string> = {
        coordinator: 'TahaRana@123',
        hod: 'TahaRana@123',
        dean: 'TahaRana@123',
        supervisor: 'supervisor123',
        student: 'student123'
      };
      const expectedPassword = defaultPasswords[user.role as string];
      if (!expectedPassword || password !== expectedPassword) {
        return c.json({ success: false, error: 'Incorrect password. Please try again.' }, 401);
      }
    }

    // Success — return user without password field
    const { password: _pw, ...safeUser } = user;
    const token = await createSession(c.env.DB, String(user.id), String(user.role));
    const isHttps = new URL(c.req.url).protocol === 'https:';
    c.header('Set-Cookie', sessionCookie(token, isHttps), { append: true });
    await logAuditEvent(c.env.DB, String(user.id), String(user.role), 'user_login_success', {
      entityType: 'user',
      entityId: String(user.id),
      details: `${user.name} logged in successfully`,
      metadata: { email: user.email, role: user.role }
    });
    return c.json({ success: true, data: { user: safeUser, message: 'Login successful' } });
  }

  // No account found
  return c.json({ success: false, error: 'No account found with this email address.' }, 404);
});

// POST /api/users/register — Self-registration is DISABLED.
// Students apply via /apply; supervisors are registered by coordinators.
userRoutes.post('/register', async (c) => {
  return c.json({
    success: false,
    error: 'Self-registration is disabled. Students should use the /apply form. Supervisors are registered by the coordinator.'
  }, 403);
});

// POST /api/users/logout — clears the session cookie used by plain browser navigations
userRoutes.post('/logout', async (c) => {
  await destroySession(c.env.DB, readSessionToken(c.req.header('Cookie')));
  c.header('Set-Cookie', clearedSessionCookie(), { append: true });
  return c.json({ success: true, message: 'Logged out' });
});

// GET /api/users/pending — Get all pending approval users (coordinator only)
userRoutes.get('/pending', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can view pending users' }, 403);
  }
  const result = await c.env.DB.prepare(
    "SELECT id, email, name, role, department, expertise, max_students, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"
  ).all();
  return c.json({ success: true, data: result.results });
});

// PUT /api/users/:id/approve — Coordinator approves a pending user
userRoutes.put('/:id/approve', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can approve users' }, 403);
  }
  const id = c.req.param('id');
  const actorId = c.req.header('X-User-Id') || 'system';
  const actorRole = c.req.header('X-User-Role') || 'system';
  await c.env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(id).run();
  const user = await c.env.DB.prepare('SELECT id, email, name, role, department, status FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  await logAuditEvent(c.env.DB, actorId, actorRole, 'user_approved', {
    entityType: 'user',
    entityId: String(id),
    details: `${actorRole} approved ${user.name || 'user'} account`,
    metadata: { approved_user_id: id, approved_user_email: user.email, approved_user_role: user.role }
  });
  await createNotification(c.env.DB, id, {
    type: 'approval',
    title: 'Your account was approved!',
    body: `Welcome aboard, ${user.name}. Your account is now active and you can log in.`,
    link_view: 'dashboard',
    ref_id: id,
  });
  return c.json({ success: true, data: user });
});

// PUT /api/users/:id/reject — Coordinator rejects a pending user
userRoutes.put('/:id/reject', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can reject users' }, 403);
  }
  const id = c.req.param('id');
  const actorId = c.req.header('X-User-Id') || 'system';
  const actorRole = c.req.header('X-User-Role') || 'system';
  await c.env.DB.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").bind(id).run();
  const rejectedUser = await c.env.DB.prepare('SELECT id, name, email, role FROM users WHERE id = ?').bind(id).first();
  if (rejectedUser) {
    await logAuditEvent(c.env.DB, actorId, actorRole, 'user_rejected', {
      entityType: 'user',
      entityId: String(id),
      details: `${actorRole} rejected ${rejectedUser.name || 'user'} account`,
      metadata: { rejected_user_id: id, rejected_user_email: rejectedUser.email, rejected_user_role: rejectedUser.role }
    });
    await createNotification(c.env.DB, id, {
      type: 'approval',
      title: 'Your registration was rejected',
      body: `Hi ${rejectedUser.name}, your registration request was rejected. Please contact the coordinator if you believe this is a mistake.`,
      link_view: 'dashboard',
      ref_id: id,
    });
  }
  return c.json({ success: true, message: 'User registration rejected' });
});

// GET /api/users/chattable — returns only users the authenticated caller is allowed to chat with.
// Role is derived from the DB (never trusted from the header) so it cannot be spoofed.
userRoutes.get('/chattable', async (c) => {
  const callerId = c.req.header('X-User-Id') || '';
  if (!callerId || callerId === 'guest') {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }

  const caller = await c.env.DB.prepare(
    `SELECT id, role FROM users WHERE id = ? AND (status = 'active' OR status IS NULL)`
  ).bind(callerId).first() as { id: string; role: string } | null;

  if (!caller) return c.json({ success: false, error: 'Not authenticated' }, 401);

  // Determine which roles this user may chat with
  let allowedRoles: string[] = [];
  if (isExecutiveRole(caller.role)) {
    allowedRoles = ['supervisor', 'student'];
  } else if (caller.role === 'supervisor') {
    allowedRoles = ['student', 'coordinator', 'hod', 'dean'];
  } else if (caller.role === 'student') {
    allowedRoles = ['supervisor', 'coordinator', 'hod', 'dean'];
  }

  if (!allowedRoles.length) {
    return c.json({ success: true, data: [] });
  }

  const placeholders = allowedRoles.map(() => '?').join(', ');
  const result = await c.env.DB.prepare(
    `SELECT id, email, name, role, department, avatar FROM users
     WHERE (status = 'active' OR status IS NULL)
       AND role IN (${placeholders})
       AND id != ?
     ORDER BY name`
  ).bind(...allowedRoles, caller.id).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/users — only active users (by default)
userRoutes.get('/', async (c) => {
  const role = c.req.query('role');
  let query = "SELECT id, email, name, role, department, expertise, research_areas, max_students, status, created_at FROM users WHERE (status = 'active' OR status IS NULL)";

  if (role) {
    const result = await c.env.DB.prepare(query + ' AND role = ? ORDER BY name').bind(role).all();
    return c.json({ success: true, data: result.results });
  }

  const result = await c.env.DB.prepare(query + ' ORDER BY name').all();
  return c.json({ success: true, data: result.results });
});

// GET /api/users/supervisors/stats
userRoutes.get('/supervisors/stats', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.department, u.expertise, u.research_areas, u.max_students,
       (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id AND p.status = 'active') as active_projects,
       (SELECT COUNT(*) FROM project_members pm JOIN projects pr ON pm.project_id = pr.id WHERE pr.supervisor_id = u.id AND pr.status = 'active') as active_students
     FROM users u WHERE u.role = 'supervisor' AND (u.status = 'active' OR u.status IS NULL) ORDER BY u.name`
  ).all();
  return c.json({ success: true, data: result.results });
});

// GET /api/users/:id
userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, expertise, research_areas, max_students, status, created_at, avatar, internship_certificate, internship_filename, transcript_certificate, transcript_filename FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  return c.json({ success: true, data: user });
});

// PUT /api/users/:id/documents — upload internship letter + transcript for student profile
userRoutes.put('/:id/documents', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  if (userId !== id) {
    return c.json({ success: false, error: 'You can only update your own uploaded documents' }, 403);
  }

  const body = await c.req.json();
  const internshipCertificate = typeof body.internship_certificate === 'string' ? body.internship_certificate.trim() : null;
  const transcriptCertificate = typeof body.transcript_certificate === 'string' ? body.transcript_certificate.trim() : null;
  const internshipFilename = typeof body.internship_filename === 'string' && body.internship_filename.trim() ? body.internship_filename.trim() : 'internship_letter.pdf';
  const transcriptFilename = typeof body.transcript_filename === 'string' && body.transcript_filename.trim() ? body.transcript_filename.trim() : 'transcript.pdf';

  if (!internshipCertificate || !isPdfDataUrl(internshipCertificate)) {
    return c.json({ success: false, error: 'Internship letter must be a valid PDF upload.' }, 400);
  }

  const transcriptValidation = await validateMemberDocuments({
    internship_certificate: internshipCertificate,
    transcript_certificate: transcriptCertificate,
    transcript_text: body.transcript_text || body.transcript_content || null,
  });

  if (!transcriptValidation.ok) {
    return c.json({ success: false, error: transcriptValidation.error }, 400);
  }

  if (!transcriptCertificate || !isPdfDataUrl(transcriptCertificate)) {
    return c.json({ success: false, error: 'Academic transcript must be a valid PDF upload.' }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET internship_certificate = ?, internship_filename = ?, transcript_certificate = ?, transcript_filename = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(internshipCertificate, internshipFilename, transcriptCertificate, transcriptFilename, id).run();

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, student_id_num, program, shift, status, avatar, internship_certificate, internship_filename, transcript_certificate, transcript_filename FROM users WHERE id = ?'
  ).bind(id).first();

  await logAuditEvent(c.env.DB, userId, c.req.header('X-User-Role') || 'student', 'user_documents_updated', {
    entityType: 'user',
    entityId: String(id),
    details: `Uploaded internship and transcript documents for ${user?.name || id}`,
    metadata: { user_id: id }
  });

  return c.json({ success: true, data: user, message: 'Documents uploaded successfully.' });
});

// PUT /api/users/:id/avatar — upload profile photo (base64 data URL)
userRoutes.put('/:id/avatar', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  if (userId !== id) {
    return c.json({ success: false, error: 'You can only update your own profile photo' }, 403);
  }

  const body = await c.req.json();
  const avatar = body.avatar;
  if (!avatar || typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return c.json({ success: false, error: 'Invalid image format. Please upload a valid image.' }, 400);
  }
  const approxBytes = Math.floor(avatar.length * 3 / 4);
  if (approxBytes > 2 * 1024 * 1024) {
    return c.json({ success: false, error: 'Image is too large (max 2MB). Please use a smaller image.' }, 400);
  }

  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, id).run();
  await logAuditEvent(c.env.DB, userId, c.req.header('X-User-Role') || 'student', 'user_avatar_updated', {
    entityType: 'user',
    entityId: String(id),
    details: `Profile photo updated for user ${id}`,
    metadata: { user_id: id }
  });
  return c.json({ success: true, message: 'Profile photo updated!' });
});

// PUT /api/users/:id — update own profile (name, email, password)
userRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';

  if (userId !== id && !isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'You can only update your own profile' }, 403);
  }

  const currentUser = await c.env.DB.prepare('SELECT id, role, email FROM users WHERE id = ?').bind(id).first();
  if (!currentUser) return c.json({ success: false, error: 'User not found' }, 404);

  const body = await c.req.json();
  const fields: string[] = [];
  const values: any[] = [];

  // Enforce: Students CANNOT change university email!
  if (body.email !== undefined && body.email !== currentUser.email) {
    if (currentUser.role === 'student' || userRole === 'student') {
      return c.json({ success: false, error: 'University Email is read-only and cannot be changed by the student.' }, 403);
    }
    const email = body.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return c.json({ success: false, error: 'Invalid email address' }, 400);
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, id).first();
    if (existing) return c.json({ success: false, error: 'Email is already in use' }, 409);
    fields.push('email = ?');
    values.push(email);
  }

  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ success: false, error: 'Name cannot be empty' }, 400);
    fields.push('name = ?');
    values.push(body.name.trim());
  }

  // Student ID must stay unique — changing it must not collide with another user.
  if (body.student_id_num !== undefined) {
    const sid = String(body.student_id_num ?? '').trim();
    if (sid && !/^[A-Za-z0-9\-\/]{2,32}$/.test(sid)) {
      return c.json({ success: false, error: 'Student ID may only contain letters, numbers, dash and slash (2-32 characters)' }, 400);
    }
    const currentSidRow = await c.env.DB.prepare('SELECT student_id_num FROM users WHERE id = ?').bind(id).first() as Record<string, any> | null;
    const currentSid = String(currentSidRow?.student_id_num || '').trim();
    if (sid !== currentSid) {
      if (sid) {
        const taken = await c.env.DB.prepare(
          `SELECT id, name, status FROM users
           WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ? AND id != ?`
        ).bind(sid, id).first() as Record<string, any> | null;
        if (taken) {
          return c.json({
            success: false,
            error: 'This Student ID is already registered to another user.',
            existing_user_id: taken.id,
            existing_name: taken.name
          }, 409);
        }
      }
      fields.push('student_id_num = ?');
      values.push(sid || null);
    }
  }

  if (body.password !== undefined) {
    if (!body.password || body.password.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }
    fields.push('password = ?');
    values.push(body.password);
  }

  if (fields.length === 0) return c.json({ success: false, error: 'Nothing to update' }, 400);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  try {
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/UNIQUE constraint failed/i.test(msg)) {
      return c.json({ success: false, error: 'Email or Student ID is already registered.' }, 409);
    }
    throw e;
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, student_id_num, program, shift, status, avatar, internship_certificate, internship_filename, transcript_certificate, transcript_filename FROM users WHERE id = ?'
  ).bind(id).first();
  await logAuditEvent(c.env.DB, userId, userRole, 'user_updated', {
    entityType: 'user',
    entityId: String(id),
    details: `Profile updated for ${user?.name || id}`,
    metadata: { user_id: id, changed_fields: fields.map((field) => field.replace(' = ?', '').trim()) }
  });
  return c.json({ success: true, data: user, message: 'Profile updated!' });
});

// GET /api/users/:id/student-profile — Full Student Profile with Project, Group, Weekly Updates, Verified Meetings & Evaluations
userRoutes.get('/:id/student-profile', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, student_id_num, program, shift, status, avatar, internship_certificate, internship_filename, transcript_certificate, transcript_filename, created_at FROM users WHERE id = ?'
  ).bind(id).first();

  if (!user) return c.json({ success: false, error: 'Student not found' }, 404);

  // Group details
  const groupMem = await c.env.DB.prepare(
    `SELECT g.id as group_id, g.name as group_name, g.leader_id
     FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = ?`
  ).bind(id).first();

  let groupData = null;
  if (groupMem) {
    const members = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.student_id_num FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`
    ).bind(groupMem.group_id).all();
    groupData = { ...groupMem, members: members.results };
  }

  // Project details
  const projMem = await c.env.DB.prepare(
    `SELECT p.*, s.name as supervisor_name, s.email as supervisor_email
     FROM project_members pm JOIN projects p ON pm.project_id = p.id
     LEFT JOIN users s ON p.supervisor_id = s.id WHERE pm.user_id = ? ORDER BY p.created_at DESC LIMIT 1`
  ).bind(id).first();

  let weeklyUpdates: any[] = [];
  let verifiedMeetingsCount = 0;
  let meetingsList: any[] = [];
  let evaluations: any[] = [];

  if (projMem) {
    const updatesRes = await c.env.DB.prepare(
      `SELECT w.*, u.name as student_name FROM weekly_updates w JOIN users u ON w.student_id = u.id WHERE w.project_id = ? ORDER BY w.week_number DESC`
    ).bind(projMem.id).all();
    weeklyUpdates = updatesRes.results;

    const meetingsRes = await c.env.DB.prepare(
      `SELECT m.*, s.name as supervisor_name FROM meetings m LEFT JOIN users s ON m.supervisor_id = s.id WHERE m.project_id = ? ORDER BY m.created_at DESC`
    ).bind(projMem.id).all();
    meetingsList = meetingsRes.results;

    const verifiedRes = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM meetings WHERE project_id = ? AND verification_status = 'verified'`
    ).bind(projMem.id).first();
    verifiedMeetingsCount = (verifiedRes?.count as number) || 0;

    const evalsRes = await c.env.DB.prepare(
      `SELECT e.*, s.name as supervisor_name FROM evaluations e JOIN users s ON e.supervisor_id = s.id WHERE e.student_id = ? OR e.project_id = ? ORDER BY e.created_at DESC`
    ).bind(id, projMem.id).all();
    evaluations = evalsRes.results;
  } else {
    // If no project bound yet, check meetings directly by student_id
    const verifiedRes = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM meetings WHERE student_id = ? AND verification_status = 'verified'`
    ).bind(id).first();
    verifiedMeetingsCount = (verifiedRes?.count as number) || 0;
  }

  return c.json({
    success: true,
    data: {
      student: user,
      group: groupData,
      project: projMem || null,
      weekly_updates: weeklyUpdates,
      verified_meetings_count: verifiedMeetingsCount,
      meetings: meetingsList,
      evaluations: evaluations
    }
  });
});

// POST /api/users (coordinator adds directly — status = active immediately)
userRoutes.post('/', async (c) => {
  const body = await c.req.json();

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return c.json({ success: false, error: 'A valid email address is required' }, 400);
  }

  const studentIdNum = body.student_id_num !== undefined && body.student_id_num !== null
    ? String(body.student_id_num).trim()
    : '';
  if (studentIdNum && !/^[A-Za-z0-9\-\/]{2,32}$/.test(studentIdNum)) {
    return c.json({ success: false, error: 'Student ID may only contain letters, numbers, dash and slash (2-32 characters)' }, 400);
  }

  // Email must be unique (case-insensitive) across ALL users, not just active ones.
  const emailTaken = await c.env.DB.prepare(
    'SELECT id, status FROM users WHERE LOWER(email) = ?'
  ).bind(email).first() as Record<string, any> | null;
  if (emailTaken) {
    return c.json({
      success: false,
      error: emailTaken.status === 'pending'
        ? 'This email already has a pending registration request.'
        : 'An account with this email already exists.',
      existing_status: emailTaken.status
    }, 409);
  }

  // Student ID must be unique — one student ID can only ever belong to one user.
  if (studentIdNum) {
    const idTaken = await c.env.DB.prepare(
      `SELECT id, email, name, status FROM users
       WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ?`
    ).bind(studentIdNum).first() as Record<string, any> | null;
    if (idTaken) {
      await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', c.req.header('X-User-Role') || 'system', 'duplicate_student_id_blocked', {
        entityType: 'user',
        entityId: String(idTaken.id),
        details: `Blocked registration for duplicate Student ID ${studentIdNum}`,
        metadata: { attempted_student_id_num: studentIdNum, attempted_email: email, existing_user_id: idTaken.id, existing_status: idTaken.status }
      });
      return c.json({
        success: false,
        error: 'This Student ID is already registered to another user.',
        existing_user_id: idTaken.id,
        existing_name: idTaken.name,
        existing_status: idTaken.status
      }, 409);
    }
  }

  const id = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, role, department, student_id_num, expertise, research_areas, max_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(
      id, email, body.name, body.role || 'student',
      body.department || null,
      studentIdNum || null,
      body.expertise ? JSON.stringify(body.expertise) : null,
      body.research_areas ? JSON.stringify(body.research_areas) : null,
      body.max_students || 8
    ).run();
  } catch (e) {
    // Last-resort guard: the DB unique indexes (0017) reject duplicates even if
    // two requests race past the checks above.
    const msg = String((e as Error)?.message || e);
    if (/UNIQUE constraint failed/i.test(msg)) {
      return c.json({ success: false, error: 'Email or Student ID is already registered.' }, 409);
    }
    throw e;
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', c.req.header('X-User-Role') || 'system', 'user_created', {
    entityType: 'user',
    entityId: String(id),
    details: `User ${body.name || body.email} created`,
    metadata: { created_user_id: id, email: body.email, role: body.role || 'student' }
  });
  return c.json({ success: true, data: user }, 201);
});

// DELETE /api/users/:id — coordinator deletes a student/supervisor with full cascade
userRoutes.delete('/:id', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, and Dean can delete users' }, 403);
  }
  const id = c.req.param('id');
  const target = await c.env.DB.prepare(
    'SELECT id, name, role, status, email, student_id_num FROM users WHERE id = ?'
  ).bind(id).first() as Record<string, any> | null;
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);
  if (isExecutiveRole(target.role)) {
    return c.json({ success: false, error: 'Executive accounts cannot be deleted' }, 400);
  }

  try {
    // 1. Groups led by this user are deleted entirely (with their proposals/projects).
    const ledGroups = await c.env.DB.prepare('SELECT id FROM groups WHERE leader_id = ?').bind(id).all();
    const ledGroupIds = ledGroups.results.map((r: any) => r.id);
    if (ledGroupIds.length) await deleteGroupsCascade(c.env.DB, ledGroupIds);

    // 2. All proposals referencing this user (submitted OR supervised) + their projects.
    const proposalRows = await c.env.DB.prepare(
      'SELECT id FROM proposals WHERE submitted_by = ? OR supervisor_id = ?'
    ).bind(id, id).all();
    const proposalIds = proposalRows.results.map((r: any) => r.id);

    let projectIds: string[] = [];
    if (proposalIds.length) {
      const projectRows = await c.env.DB.prepare(
        `SELECT id FROM projects WHERE proposal_id IN (SELECT value FROM json_each(?))`
      ).bind(JSON.stringify(proposalIds)).all();
      projectIds = projectRows.results.map((r: any) => r.id);
    }

    // Projects supervised by this user are deleted too.
    const supRows = await c.env.DB.prepare('SELECT id FROM projects WHERE supervisor_id = ?').bind(id).all();
    projectIds = projectIds.concat(supRows.results.map((r: any) => r.id));

    if (projectIds.length) await deleteProjectsCascade(c.env.DB, projectIds);
    if (proposalIds.length) {
      await c.env.DB.prepare('DELETE FROM feedback WHERE proposal_id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(proposalIds)).run();
      await c.env.DB.prepare('DELETE FROM proposals WHERE id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(proposalIds)).run();
    }

    // 3. Clear EVERY remaining reference to this user so the final DELETE never hits an FK constraint.
    const email = target.email || '';
    const studentIdNum = target.student_id_num || '';

    const safeDelete = async (sql: string, ...args: any[]) => {
      try {
        await c.env.DB.prepare(sql).bind(...args).run();
      } catch (e) {
        // Ignored if table doesn't exist or already cleaned up
      }
    };

    await safeDelete('DELETE FROM weekly_updates WHERE student_id = ?', id);
    await safeDelete('DELETE FROM meetings WHERE student_id = ? OR supervisor_id = ?', id, id);
    await safeDelete('DELETE FROM evaluations WHERE student_id = ? OR supervisor_id = ?', id, id);
    await safeDelete('DELETE FROM notifications WHERE user_id = ?', id);
    await safeDelete('DELETE FROM presence WHERE user_id = ?', id);
    await safeDelete('DELETE FROM group_members WHERE user_id = ?', id);
    await safeDelete('DELETE FROM project_members WHERE user_id = ?', id);
    await safeDelete('DELETE FROM project_media WHERE uploaded_by = ?', id);
    await safeDelete('DELETE FROM project_feedback WHERE user_id = ?', id);
    await safeDelete('DELETE FROM feedback WHERE from_user_id = ? OR to_user_id = ?', id, id);
    await safeDelete('DELETE FROM messages WHERE sender_id = ?', id);
    await safeDelete('DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? OR user_b = ?)', id, id);
    await safeDelete('DELETE FROM chats WHERE user_a = ? OR user_b = ?', id, id);
    await safeDelete('DELETE FROM ai_audit_log WHERE user_id = ?', id);
    await safeDelete('DELETE FROM ai_rate_limits WHERE user_id = ?', id);
    if (email || studentIdNum) {
      await safeDelete('DELETE FROM student_applications WHERE email = ? OR student_id_num = ?', email, studentIdNum);
    }

    // Final delete user
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole || 'system', 'user_deleted', {
      entityType: 'user',
      entityId: String(id),
      details: `User ${target.name || target.email || id} deleted`,
      metadata: { deleted_user_id: id, deleted_user_email: target.email || null, deleted_user_role: target.role || null }
    });
  } catch (e) {
    console.error('Delete user error:', e);
    return c.json({ success: false, error: 'Failed to delete user: ' + ((e as Error).message || 'unknown error') }, 500);
  }

  return c.json({ success: true, message: `${target.name || 'User'} has been deleted.` });
});

export { userRoutes };
