import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';

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
    'SELECT id, email, name, role, department, status, password FROM users WHERE email = ?'
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
    'SELECT id, email, name, role, department, expertise, research_areas, max_students, status, created_at FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  return c.json({ success: true, data: user });
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

export { userRoutes };
