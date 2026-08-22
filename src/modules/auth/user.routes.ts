import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { deleteGroupsCascade, deleteProjectsCascade } from '../../utils/cascade';
import { createNotification, notifyRole } from '../notifications/notification.routes';

const userRoutes = new Hono<{ Bindings: Env }>();

// POST /api/users/login
userRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { password, username } = body;

  if (!username || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }

  // Look up the user by email or student ID
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, status, password, avatar FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(student_id_num) = LOWER(?)'
  ).bind(username, username).first() as Record<string, unknown> | null;

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

    // If user has an individual password, check it
    if (user.password) {
      if (user.password !== password) {
        return c.json({ success: false, error: 'Incorrect password. Please try again.' }, 401);
      }
    } else {
      // No individual password — fall back to shared role password (demo accounts)
      const sharedPasswords: Record<string, string> = {
        coordinator: 'TahaRana@123',
        supervisor: 'supervisor123',
        student: 'student123'
      };
      const expected = sharedPasswords[user.role as string];
      if (!expected || password !== expected) {
        return c.json({ success: false, error: 'Incorrect password. Please try again.' }, 401);
      }
    }

    // Success — return user without password field
    const { password: _pw, ...safeUser } = user;
    return c.json({ success: true, data: { user: safeUser, message: 'Login successful' } });
  }

  // No account found with this email — try demo quick-login (no email registration)
  // Only allow if they use the exact demo credentials
  const sharedPasswords: Record<string, string> = {
    coordinator: 'TahaRana@123',
    supervisor: 'supervisor123',
    student: 'student123'
  };

  // Find which role this password matches
  let matchedRole: string | null = null;
  for (const [r, p] of Object.entries(sharedPasswords)) {
    if (p === password) { matchedRole = r; break; }
  }

  if (!matchedRole) {
    return c.json({ success: false, error: 'No account found with this email address.' }, 404);
  }

  // Return first active demo user of that role
  const demoUser = await c.env.DB.prepare(
    "SELECT id, email, name, role, department, status FROM users WHERE role = ? AND (status = 'active' OR status IS NULL) ORDER BY id ASC LIMIT 1"
  ).bind(matchedRole).first() as Record<string, unknown> | null;

  const finalUser = demoUser || {
    id: `${matchedRole}-1`,
    name: `${matchedRole.charAt(0).toUpperCase() + matchedRole.slice(1)} User`,
    role: matchedRole,
    department: 'Computer Science'
  };

  return c.json({ success: true, data: { user: finalUser, message: 'Login successful' } });
});

// POST /api/users/register — Self registration for students & supervisors
userRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, role, department, expertise, max_students, password } = body;

    if (!name || !email || !role) {
      return c.json({ success: false, error: 'Name, email, and role are required' }, 400);
    }

    if (!password || password.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }

    if (role === 'coordinator') {
      return c.json({ success: false, error: 'Coordinator accounts cannot self-register' }, 403);
    }

    // Check if email already exists
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return c.json({ success: false, error: 'An account with this email already exists' }, 409);
    }

    const id = generateId();

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, role, department, expertise, max_students, password, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      id, email, name, role,
      department || 'Computer Science',
      expertise ? JSON.stringify(expertise) : null,
      max_students || 8,
      password
    ).run();

    const user = await c.env.DB.prepare('SELECT id, email, name, role, department, status FROM users WHERE id = ?').bind(id).first();
    await notifyRole(c.env.DB, 'coordinator', {
      type: 'approval',
      title: `New ${role} registration pending approval`,
      body: `${name} (${email}) has registered as a ${role} and is waiting for approval.`,
      link_view: 'dashboard',
      ref_id: id,
    });
    return c.json({ success: true, data: user, message: 'Registration submitted! Awaiting coordinator approval.' }, 201);
  } catch (err: any) {
    console.error('Registration Error:', err);
    return c.json({ success: false, error: err?.message || 'Registration failed' }, 500);
  }
});

// GET /api/users/pending — Get all pending approval users (coordinator only)
userRoutes.get('/pending', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (userRole !== 'coordinator') {
    return c.json({ success: false, error: 'Only coordinators can view pending users' }, 403);
  }
  const result = await c.env.DB.prepare(
    "SELECT id, email, name, role, department, expertise, max_students, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"
  ).all();
  return c.json({ success: true, data: result.results });
});

// PUT /api/users/:id/approve — Coordinator approves a pending user
userRoutes.put('/:id/approve', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (userRole !== 'coordinator') {
    return c.json({ success: false, error: 'Only coordinators can approve users' }, 403);
  }
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(id).run();
  const user = await c.env.DB.prepare('SELECT id, email, name, role, department, status FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
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
  if (userRole !== 'coordinator') {
    return c.json({ success: false, error: 'Only coordinators can reject users' }, 403);
  }
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").bind(id).run();
  const rejectedUser = await c.env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(id).first();
  if (rejectedUser) {
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
    'SELECT id, email, name, role, department, expertise, research_areas, max_students, status, created_at, avatar FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  return c.json({ success: true, data: user });
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
  if (approxBytes > 500 * 1024) {
    return c.json({ success: false, error: 'Image is too large (max 500KB). Please use a smaller image.' }, 400);
  }

  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, id).run();
  return c.json({ success: true, message: 'Profile photo updated!' });
});

// PUT /api/users/:id — update own profile (name, email, password)
userRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';

  if (userId !== id && userRole !== 'coordinator') {
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

  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, student_id_num, program, shift, status, avatar FROM users WHERE id = ?'
  ).bind(id).first();
  return c.json({ success: true, data: user, message: 'Profile updated!' });
});

// GET /api/users/:id/student-profile — Full Student Profile with Project, Group, Weekly Updates, Verified Meetings & Evaluations
userRoutes.get('/:id/student-profile', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, student_id_num, program, shift, status, avatar, created_at FROM users WHERE id = ?'
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
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, department, expertise, research_areas, max_students, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  ).bind(
    id, body.email, body.name, body.role || 'student',
    body.department || null,
    body.expertise ? JSON.stringify(body.expertise) : null,
    body.research_areas ? JSON.stringify(body.research_areas) : null,
    body.max_students || 8
  ).run();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: user }, 201);
});

// DELETE /api/users/:id — coordinator deletes a student/supervisor with full cascade
userRoutes.delete('/:id', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (userRole !== 'coordinator') {
    return c.json({ success: false, error: 'Only coordinators can delete users' }, 403);
  }
  const id = c.req.param('id');
  const target = await c.env.DB.prepare(
    'SELECT id, name, role, status, email, student_id_num FROM users WHERE id = ?'
  ).bind(id).first() as Record<string, any> | null;
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);
  if (target.role === 'coordinator') {
    return c.json({ success: false, error: 'Coordinator accounts cannot be deleted' }, 400);
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
    await safeDelete('DELETE FROM user_presence WHERE user_id = ?', id);
    await safeDelete('DELETE FROM tasks WHERE assigned_to = ?', id);
    await safeDelete('DELETE FROM activity_log WHERE user_id = ?', id);
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
  } catch (e) {
    console.error('Delete user error:', e);
    return c.json({ success: false, error: 'Failed to delete user: ' + ((e as Error).message || 'unknown error') }, 500);
  }

  return c.json({ success: true, message: `${target.name || 'User'} has been deleted.` });
});

export { userRoutes };
