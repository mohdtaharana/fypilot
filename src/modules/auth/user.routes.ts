import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { deleteGroupsCascade, deleteProjectsCascade } from '../../utils/cascade';

const userRoutes = new Hono<{ Bindings: Env }>();

// POST /api/users/login
userRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { password, username } = body;

  if (!username || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }

  // Look up the user by email
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, status, password, avatar FROM users WHERE email = ?'
  ).bind(username).first() as Record<string, unknown> | null;

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
  if (userId !== id) {
    return c.json({ success: false, error: 'You can only update your own profile' }, 403);
  }

  const body = await c.req.json();
  const fields: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ success: false, error: 'Name cannot be empty' }, 400);
    fields.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.email !== undefined) {
    const email = body.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return c.json({ success: false, error: 'Invalid email address' }, 400);
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, id).first();
    if (existing) return c.json({ success: false, error: 'Email is already in use' }, 409);
    fields.push('email = ?');
    values.push(email);
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
    'SELECT id, email, name, role, department, status, avatar FROM users WHERE id = ?'
  ).bind(id).first();
  return c.json({ success: true, data: user, message: 'Profile updated!' });
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
    'SELECT id, name, role, status FROM users WHERE id = ?'
  ).bind(id).first() as Record<string, any> | null;
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);
  if (target.role === 'coordinator') {
    return c.json({ success: false, error: 'Coordinator accounts cannot be deleted' }, 400);
  }

  try {
    // Groups led by this user are deleted entirely (with their proposals/projects).
    const ledGroups = await c.env.DB.prepare('SELECT id FROM groups WHERE leader_id = ?').bind(id).all();
    const ledGroupIds = ledGroups.results.map((r: any) => r.id);
    if (ledGroupIds.length) await deleteGroupsCascade(c.env.DB, ledGroupIds);

    // All proposals referencing this user (submitted OR supervised) + their projects.
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

    // Projects supervised by this user are deleted too (they become orphaned otherwise).
    const supRows = await c.env.DB.prepare('SELECT id FROM projects WHERE supervisor_id = ?').bind(id).all();
    projectIds = projectIds.concat(supRows.results.map((r: any) => r.id));

    if (projectIds.length) await deleteProjectsCascade(c.env.DB, projectIds);
    if (proposalIds.length) {
      await c.env.DB.prepare('DELETE FROM proposals WHERE id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(proposalIds)).run();
    }

    // Clear every remaining reference to this user so the final DELETE never hits an FK constraint.
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM group_members WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM project_members WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM project_media WHERE uploaded_by = ?').bind(id),
      c.env.DB.prepare('DELETE FROM project_feedback WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM feedback WHERE from_user_id = ? OR to_user_id = ?').bind(id, id),
      c.env.DB.prepare('DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE user_a = ? OR user_b = ?)').bind(id, id),
      c.env.DB.prepare('DELETE FROM chats WHERE user_a = ? OR user_b = ?').bind(id, id),
      c.env.DB.prepare('DELETE FROM ai_audit_log WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM ai_rate_limits WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ]);
  } catch (e) {
    return c.json({ success: false, error: 'Failed to delete user: ' + ((e as Error).message || 'unknown error') }, 500);
  }

  return c.json({ success: true, message: `${target.name || 'User'} has been deleted.` });
});

export { userRoutes };
