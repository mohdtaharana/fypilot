import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { deleteGroupsCascade } from '../../utils/cascade';
import { requireBulkDeleteRole } from '../../utils/bulk-guard';
import { createNotification, notifyRole } from '../notifications/notification.routes';
import { logAuditEvent } from '../audit/audit.routes';

const groupRoutes = new Hono<{ Bindings: Env }>();
const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

// DELETE /api/groups/bulk — remove EVERY group.
// Registered before `/:id` so the literal path is matched first.
groupRoutes.delete('/bulk', async (c) => {
  const actor = await requireBulkDeleteRole(c);
  if (!actor) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can delete all groups' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL GROUPS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const rows = await c.env.DB.prepare('SELECT id, name FROM groups').all();
    const groups = (rows.results || []) as Array<Record<string, any>>;
    if (groups.length === 0) {
      return c.json({ success: true, message: 'There are no groups to delete.', deleted: 0 });
    }

    await deleteGroupsCascade(c.env.DB, groups.map((g) => g.id));

    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'groups_deleted_all', {
      entityType: 'group',
      entityId: '*',
      details: `All ${groups.length} group(s) deleted`,
      metadata: { scope: 'all', deleted_count: groups.length, group_ids: groups.map((g) => g.id) },
    });

    return c.json({
      success: true,
      message: `All ${groups.length} group(s) and their linked proposals and projects were deleted.`,
      deleted: groups.length,
    });
  } catch (e: any) {
    console.error('Delete all groups error:', e);
    return c.json({ success: false, error: 'Failed to delete all groups: ' + (e?.message || 'unknown error') }, 500);
  }
});

async function upsertGroupMemberAccount(db: any, member: any, fallbackDepartment?: string | null) {
  const cleaned = member && typeof member === 'object' ? member : {};
  const explicitId = cleaned.user_id || cleaned.memberId || cleaned.id || null;
  const email = String(cleaned.email || cleaned.member_email || '').trim();
  const name = String(cleaned.name || cleaned.member_name || '').trim();
  const studentIdNum = String(cleaned.student_id_num || cleaned.studentIdNum || cleaned.student_id || '').trim();
  const password = String(cleaned.password || cleaned.member_password || 'student123').trim();

  if (!explicitId && !email && !studentIdNum && !name) {
    return null;
  }

  let user = null as any;
  if (explicitId) {
    user = await db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(explicitId).first();
  }

  if (!user && (email || studentIdNum)) {
    user = await db.prepare(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(student_id_num) = LOWER(?)'
    ).bind(email || '', studentIdNum || '').first();
  }

  if (user) {
    const updates: string[] = [];
    const values: any[] = [];

    if (name && user.name !== name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email && !user.email && user.email !== email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (email && user.email !== email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (studentIdNum && (!user.student_id_num || user.student_id_num !== studentIdNum)) {
      updates.push('student_id_num = ?');
      values.push(studentIdNum);
    }
    if (fallbackDepartment && (!user.department || user.department !== fallbackDepartment)) {
      updates.push('department = ?');
      values.push(fallbackDepartment);
    }
    if (cleaned.department && (!user.department || user.department !== cleaned.department)) {
      updates.push('department = ?');
      values.push(cleaned.department);
    }
    if (cleaned.program && (!user.program || user.program !== cleaned.program)) {
      updates.push('program = ?');
      values.push(cleaned.program);
    }
    if (cleaned.shift && (!user.shift || user.shift !== cleaned.shift)) {
      updates.push('shift = ?');
      values.push(cleaned.shift);
    }
    if (password && password.length >= 6 && user.password !== password) {
      updates.push('password = ?');
      values.push(password);
    }
    if (user.status !== 'active') {
      updates.push('status = ?');
      values.push('active');
    }
    if (user.role !== 'student') {
      updates.push('role = ?');
      values.push('student');
    }

    if (updates.length) {
      updates.push('updated_at = datetime(\'now\')');
      values.push(user.id);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    }

    return { user, created: false };
  }

  const generatedEmail = email || `${(studentIdNum || 'student').toLowerCase().replace(/[^a-z0-9]/g, '')}@stu.smiu.edu.pk`;
  const generatedName = name || `Student ${studentIdNum || 'Member'}`;
  const memberId = generateId();
  await db.prepare(
    `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status, password)
     VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active', ?)`
  ).bind(
    memberId,
    generatedEmail,
    generatedName,
    cleaned.department || fallbackDepartment || null,
    studentIdNum || null,
    cleaned.program || null,
    cleaned.shift || null,
    password.length >= 6 ? password : 'student123'
  ).run();

  return {
    user: await db.prepare('SELECT * FROM users WHERE id = ?').bind(memberId).first(),
    created: true
  };
}

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

  // `g.*` also carries evaluation_token, the unguessable secret behind the
  // public examiner form. Members must never see it, so it is stripped here.
  const { evaluation_token: _evaluationToken, ...safeGroup } = group as Record<string, unknown>;

  return c.json({ success: true, data: { ...safeGroup, members: members.results } });
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
  const rawMemberInputs = Array.isArray(body.memberIds) ? body.memberIds : Array.isArray(body.members) ? body.members : [];
  const leaderUser = await c.env.DB.prepare('SELECT department FROM users WHERE id = ?').bind(userId).first() as { department?: string | null } | null;
  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any>;
  for (const memberInput of rawMemberInputs) {
    const memberId = memberInput && typeof memberInput === 'object' ? (memberInput.user_id || memberInput.memberId || memberInput.id) : memberInput;
    if (memberId === userId) continue;
    const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').bind(id).first();
    if (Number(count?.c || 0) >= Number(group.max_members || 4)) break;

    if (memberInput && typeof memberInput === 'object') {
      const memberResult = await upsertGroupMemberAccount(c.env.DB, memberInput, leaderUser?.department || null);
      if (!memberResult?.user) continue;
      const memberUserId = memberResult.user.id as string;
      const otherGroup = await c.env.DB.prepare(
        `SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? AND g.status != 'rejected'`
      ).bind(memberUserId).first();
      if (otherGroup && otherGroup.id !== id) continue;
      const already = await c.env.DB.prepare(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?'
      ).bind(id, memberUserId).first();
      if (!already) {
        await c.env.DB.prepare(
          `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
        ).bind(generateId(), id, memberUserId).run();
      }
      continue;
    }

    const mid = String(memberId);
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
  await logAuditEvent(c.env.DB, userId, userRole, 'group_created', {
    entityType: 'group',
    entityId: String(id),
    details: `${leader?.name || 'Student'} created group ${body.name.trim()}`,
    metadata: { group_id: id, group_name: body.name.trim() }
  });
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
  const memberId = body.user_id || body.memberId || body.id || null;
  const memberData = body.member || body.student || body.memberData || null;

  if (!memberId && !memberData) {
    return c.json({ success: false, error: 'Select a student or provide member details to add' }, 400);
  }

  const leaderUser = await c.env.DB.prepare('SELECT department FROM users WHERE id = ?').bind(userId).first() as { department?: string | null } | null;
  const memberAccount = memberData ? await upsertGroupMemberAccount(c.env.DB, memberData, leaderUser?.department || null) : null;
  const resolvedMemberId = memberAccount?.user?.id || memberId;

  if (!resolvedMemberId) {
    return c.json({ success: false, error: 'Student not found or not active' }, 404);
  }

  const memberUser = await c.env.DB.prepare(
    "SELECT id, name, email FROM users WHERE id = ? AND role = 'student' AND (status = 'active' OR status IS NULL)"
  ).bind(resolvedMemberId).first() as { id: string; name: string; email: string } | null;
  if (!memberUser) return c.json({ success: false, error: 'Student not found or not active' }, 404);

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').bind(id).first();
  if (Number(count?.c || 0) >= Number(group.max_members || 4)) {
    return c.json({ success: false, error: `Group is full (max ${group.max_members} members)` }, 400);
  }

  const already = await c.env.DB.prepare(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(id, resolvedMemberId).first();
  if (already) return c.json({ success: false, error: 'Student is already in this group' }, 409);

  const otherGroup = await c.env.DB.prepare(
    `SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ? AND g.status != 'rejected'`
  ).bind(resolvedMemberId).first();
  if (otherGroup) return c.json({ success: false, error: 'Student is already part of another group' }, 409);

  await c.env.DB.prepare(
    `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
  ).bind(generateId(), id, resolvedMemberId).run();

  await logAuditEvent(c.env.DB, userId, userRole, 'group_member_added', {
    entityType: 'group',
    entityId: String(id),
    details: `${memberUser.name} added to group`,
    metadata: { group_id: id, member_id: resolvedMemberId, member_name: memberUser.name }
  });

  return c.json({
    success: true,
    data: { user: memberUser, password: memberData && (memberData.password || memberData.member_password || 'student123') },
    message: `${memberUser.name} added to the group! Their profile and login details have been created.`
  });
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
  await logAuditEvent(c.env.DB, userId, userRole, 'group_member_removed', {
    entityType: 'group',
    entityId: String(id),
    details: `Member ${memberId} removed from group`,
    metadata: { group_id: id, member_id: memberId }
  });
  return c.json({ success: true, message: 'Member removed from the group.' });
});

// PUT /api/groups/:id/status — coordinator/supervisor approves or rejects a group
groupRoutes.put('/:id/status', async (c) => {
  const userRole = c.req.header('X-User-Role') || 'student';
  if (!isExecutiveRole(userRole) && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean, and supervisors can approve groups' }, 403);
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
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'group_status_changed', {
    entityType: 'group',
    entityId: String(id),
    details: `Group approval status changed to ${status}`,
    metadata: { group_id: id, status }
  });

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
  if (!isExecutiveRole(userRole) && userRole !== 'supervisor') {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean, and supervisors can change the group leader' }, 403);
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
  await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'group_leader_changed', {
    entityType: 'group',
    entityId: String(id),
    details: `Group leader changed to ${newLeaderId}`,
    metadata: { group_id: id, new_leader_id: newLeaderId }
  });
  return c.json({ success: true, message: 'Group leader updated!' });
});

// DELETE /api/groups/:id — leader deletes a pending group, or coordinator deletes any group
groupRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const userRole = c.req.header('X-User-Role') || 'student';
  const userId = c.req.header('X-User-Id') || 'demo-user';

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first() as Record<string, any> | null;
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  if (!isExecutiveRole(userRole) && !(userRole === 'student' && group.leader_id === userId)) {
    return c.json({ success: false, error: 'Only the leader or executive roles can delete this group' }, 403);
  }

  try {
    await deleteGroupsCascade(c.env.DB, [id]);
    await logAuditEvent(c.env.DB, userId, userRole, 'group_deleted', {
      entityType: 'group',
      entityId: String(id),
      details: `Group ${group.name || id} deleted`,
      metadata: { group_id: id, deleted_by: userId, deleted_by_role: userRole }
    });
  } catch (e) {
    return c.json({ success: false, error: 'Failed to delete group: ' + ((e as Error).message || 'unknown error') }, 500);
  }

  return c.json({ success: true, message: 'Group deleted.' });
});

export { groupRoutes };
