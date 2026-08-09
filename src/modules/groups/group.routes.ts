import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { deleteGroupsCascade } from '../../utils/cascade';
import { createNotification, notifyRole } from '../notifications/notification.routes';

const groupRoutes = new Hono<{ Bindings: Env }>();

// GET /api/groups — coordinator/supervisor: all groups, student: their own groups
groupRoutes.get('/', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  let result;
  if (userRole === 'student') {
    result = await c.env.DB.prepare(
      `SELECT g.*, l.name as leader_name FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users l ON g.leader_id = l.id
       WHERE gm.user_id = ? ORDER BY g.created_at DESC`
    ).bind(userId).all();
  } else {
    result = await c.env.DB.prepare(
      `SELECT g.*, l.name as leader_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
       FROM groups g JOIN users l ON g.leader_id = l.id ORDER BY g.created_at DESC`
    ).all();
  }

  return c.json({ success: true, data: result.results });
});

// GET /api/groups/available-students — active students NOT already in a group (for member pickers)
groupRoutes.get('/available-students', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.department FROM users u
     WHERE u.role = 'student' AND (u.status = 'active' OR u.status IS NULL)
     AND u.id NOT IN (
       SELECT gm.user_id FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       WHERE g.status IN ('pending', 'approved')
     )
     ORDER BY u.name`
  ).all();
  return c.json({ success: true, data: result.results });
});

// GET /api/groups/:id — group detail with full member list
groupRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const group = await c.env.DB.prepare(
    `SELECT g.*, l.name as leader_name, l.email as leader_email
     FROM groups g JOIN users l ON g.leader_id = l.id WHERE g.id = ?`
  ).bind(id).first();
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.department, gm.joined_at,
       CASE WHEN g.leader_id = u.id THEN 1 ELSE 0 END as is_leader
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     JOIN groups g ON gm.group_id = g.id
     WHERE gm.group_id = ? ORDER BY is_leader DESC, u.name`
  ).bind(id).all();

  return c.json({ success: true, data: { ...group, members: members.results } });
});

// POST /api/groups — student creates a group (becomes leader), max 4, min 1
groupRoutes.post('/', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';
  if (userRole !== 'student') {
    return c.json({ success: false, error: 'Only students can create groups' }, 403);
  }

  const body = await c.req.json();
  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, error: 'Group name is required' }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT g.id, g.status FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ? AND g.status != 'rejected'`
  ).bind(userId).first();
  if (existing) {
    return c.json({ success: false, error: 'You are already part of a group' }, 409);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO groups (id, name, leader_id, status, max_members) VALUES (?, ?, ?, 'pending', 4)`
  ).bind(id, body.name.trim(), userId).run();
  await c.env.DB.prepare(
    `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
  ).bind(generateId(), id, userId).run();

  // Add initial members (max 4 total including leader)
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any>;
  for (const mid of memberIds) {
    if (mid === userId) continue;
    const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').bind(id).first();
    if (Number(count?.c || 0) >= Number(group.max_members || 4)) break;
    const memberUser = await c.env.DB.prepare(
      "SELECT id, name FROM users WHERE id = ? AND role = 'student' AND (status = 'active' OR status IS NULL)"
    ).bind(mid).first();
    if (!memberUser) continue;
    const otherGroup = await c.env.DB.prepare(
      `SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? AND g.status != 'rejected'`
    ).bind(mid).first();
    if (otherGroup) continue;
    await c.env.DB.prepare(
      `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
    ).bind(generateId(), id, mid).run();
  }

  const fullGroup = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first();
  const leader = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first();
  await notifyRole(c.env.DB, 'coordinator', {
    type: 'group',
    title: 'New group awaiting approval',
    body: `${leader?.name || 'A student'} created group "${body.name.trim()}" and is waiting for approval.`,
    link_view: 'groups',
    ref_id: id,
  });
  return c.json({ success: true, data: fullGroup, message: 'Group created! Awaiting coordinator approval.' }, 201);
});

// POST /api/groups/:id/members — leader adds a student member (max 4)
groupRoutes.post('/:id/members', async (c) => {
  const id = c.req.param('id');
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any> | null;
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);
  if (group.status !== 'pending') {
    return c.json({ success: false, error: 'Group membership is locked after coordinator approval' }, 403);
  }
  if (group.leader_id !== userId || userRole !== 'student') {
    return c.json({ success: false, error: 'Only the group leader can add members' }, 403);
  }

  const body = await c.req.json();
  const memberId = body.user_id || body.memberId;
  if (!memberId) return c.json({ success: false, error: 'Select a student to add' }, 400);

  const memberUser = await c.env.DB.prepare(
    "SELECT id, name, email FROM users WHERE id = ? AND role = 'student' AND (status = 'active' OR status IS NULL)"
  ).bind(memberId).first();
  if (!memberUser) return c.json({ success: false, error: 'Student not found or not active' }, 404);

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').bind(id).first();
  if (Number(count?.c || 0) >= Number(group.max_members || 4)) {
    return c.json({ success: false, error: `Group is full (max ${group.max_members} members)` }, 400);
  }

  const already = await c.env.DB.prepare(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(id, memberId).first();
  if (already) return c.json({ success: false, error: 'Student is already in this group' }, 409);

  const otherGroup = await c.env.DB.prepare(
    `SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ? AND g.status != 'rejected'`
  ).bind(memberId).first();
  if (otherGroup) return c.json({ success: false, error: 'Student is already part of another group' }, 409);

  await c.env.DB.prepare(
    `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
  ).bind(generateId(), id, memberId).run();

  return c.json({ success: true, message: `${memberUser.name} added to the group!` });
});

// DELETE /api/groups/:id/members/:memberId — leader removes a member (not the leader)
groupRoutes.delete('/:id/members/:memberId', async (c) => {
  const id = c.req.param('id');
  const memberId = c.req.param('memberId');
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any> | null;
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);
  if (group.leader_id === memberId) return c.json({ success: false, error: 'The leader cannot be removed' }, 400);
  if (group.leader_id !== userId || userRole !== 'student') {
    return c.json({ success: false, error: 'Only the group leader can remove members' }, 403);
  }
  if (group.status !== 'pending') {
    return c.json({ success: false, error: 'Group membership is locked after coordinator approval' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').bind(id, memberId).run();
  return c.json({ success: true, message: 'Member removed from the group.' });
});

// PUT /api/groups/:id/status — coordinator/supervisor approves or rejects a group
groupRoutes.put('/:id/status', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'coordinator' && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators and supervisors can approve groups' }, 403);
  }
  const id = c.req.param('id');
  const body = await c.req.json();
  const status = body.status;
  if (status !== 'approved' && status !== 'rejected') {
    return c.json({ success: false, error: 'Invalid group status' }, 400);
  }

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first();
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  await c.env.DB.prepare('UPDATE groups SET status = ? WHERE id = ?').bind(status, id).run();

  const members = await c.env.DB.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ?'
  ).bind(id).all();
  for (const m of members.results as { user_id: string }[]) {
    await createNotification(c.env.DB, m.user_id, {
      type: 'group',
      title: `Your group was ${status}`,
      body: `The group "${group.name}" was ${status} by the coordinator.`,
      link_view: 'groups',
      ref_id: id,
    });
  }
  return c.json({ success: true, message: `Group ${status}!` });
});

// PUT /api/groups/:id/leader — coordinator/supervisor changes the group leader
groupRoutes.put('/:id/leader', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (userRole !== 'coordinator' && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators and supervisors can change the group leader' }, 403);
  }
  const id = c.req.param('id');
  const body = await c.req.json();
  const newLeaderId = body.leader_id;
  if (!newLeaderId) return c.json({ success: false, error: 'Select a new leader' }, 400);

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first();
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  const member = await c.env.DB.prepare(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(id, newLeaderId).first();
  if (!member) return c.json({ success: false, error: 'The new leader must already be a member of the group' }, 400);

  await c.env.DB.prepare("UPDATE groups SET leader_id = ? WHERE id = ?").bind(newLeaderId, id).run();
  return c.json({ success: true, message: 'Group leader updated!' });
});

// DELETE /api/groups/:id — leader deletes a pending group, or coordinator deletes any group
groupRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any> | null;
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  if (userRole !== 'coordinator' && !(userRole === 'student' && group.leader_id === userId)) {
    return c.json({ success: false, error: 'Only the leader or coordinator can delete this group' }, 403);
  }

  try {
    await deleteGroupsCascade(c.env.DB, [id]);
  } catch (e) {
    return c.json({ success: false, error: 'Failed to delete group: ' + ((e as Error).message || 'unknown error') }, 500);
  }

  return c.json({ success: true, message: 'Group deleted.' });
});

export { groupRoutes };
