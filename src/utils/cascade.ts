// Minimal D1 type shims (avoids a hard dependency on @cloudflare/workers-types).
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
  first<T = Record<string, unknown>>(col?: string): Promise<T | null>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
// Shared DB cascade helpers for deleting projects/groups (and everything referencing them).

// Delete projects and all child records (weekly_updates, evaluations, feedback, media, links, meetings, members).
// projectIds must be unique; empty list is a no-op.
export async function deleteProjectsCascade(db: D1Database, projectIds: string[]) {
  if (!projectIds.length) return;
  const ids = JSON.stringify([...new Set(projectIds)]);
  await db.batch([
    db.prepare(`DELETE FROM weekly_updates WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM evaluations WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_feedback WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_media WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_links WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM meetings WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_members WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM feedback WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM projects WHERE id IN (SELECT value FROM json_each(?))`).bind(ids),
  ]);

  // Defense rows reference projects with no foreign key, so clear them here
  // rather than relying on each caller to remember.
  for (const table of ['defense_submissions', 'defense_slots']) {
    try {
      await db.prepare(`DELETE FROM ${table} WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids).run();
    } catch {
      // Table absent in this database.
    }
  }

  // Group-level evaluations survive a project delete; only the link is dropped.
  try {
    await db.prepare(
      `UPDATE fyp_evaluations SET project_id = NULL WHERE project_id IN (SELECT value FROM json_each(?))`
    ).bind(ids).run();
  } catch {
    // Table absent in this database.
  }
}

// Delete groups and everything underneath: their proposals, the projects of those proposals,
// and all child records. Also removes group memberships.
export async function deleteGroupsCascade(db: D1Database, groupIds: string[]) {
  if (!groupIds.length) return;
  const groupsJson = JSON.stringify([...new Set(groupIds)]);

  const proposalRows = await db.prepare(
    `SELECT id FROM proposals WHERE group_id IN (SELECT value FROM json_each(?))`
  ).bind(groupsJson).all();
  const proposalIds = proposalRows.results.map((r: any) => r.id);

  const projectRows = await db.prepare(
    `SELECT pr.id FROM projects pr JOIN proposals p ON pr.proposal_id = p.id WHERE p.group_id IN (SELECT value FROM json_each(?))`
  ).bind(groupsJson).all();
  const projectIds = projectRows.results.map((r: any) => r.id);

  if (projectIds.length) {
    await deleteProjectsCascade(db, projectIds);
  }

  const stmts: D1PreparedStatement[] = [];
  if (proposalIds.length) {
    stmts.push(
      db.prepare(`DELETE FROM feedback WHERE proposal_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(proposalIds)),
      db.prepare(`DELETE FROM proposals WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(proposalIds))
    );
  }
  stmts.push(
    db.prepare(`DELETE FROM group_members WHERE group_id IN (SELECT value FROM json_each(?))`).bind(groupsJson),
    db.prepare(`DELETE FROM groups WHERE id IN (SELECT value FROM json_each(?))`).bind(groupsJson),
  );
  await db.batch(stmts);

  // Defense rows are keyed by group, not by user, so they survive a student
  // delete that removed the group. Guarded individually: these tables are
  // optional in older databases and batch() aborts on the first failure.
  for (const table of ['defense_submissions', 'defense_slots']) {
    try {
      await db.prepare(`DELETE FROM ${table} WHERE group_id IN (SELECT value FROM json_each(?))`).bind(groupsJson).run();
    } catch {
      // Table absent in this database.
    }
  }

  // External examiner evaluations are keyed by group. The FK uses ON DELETE
  // CASCADE, but that only applies where foreign keys are actually enforced.
  try {
    await db.prepare(`DELETE FROM fyp_evaluations WHERE group_id IN (SELECT value FROM json_each(?))`).bind(groupsJson).run();
  } catch {
    // Table absent in this database.
  }
}

// Delete proposals and everything referencing them (their projects, plus feedback rows).
export async function deleteProposalsCascade(db: D1Database, proposalIds: string[]) {
  if (!proposalIds.length) return;
  const ids = JSON.stringify([...new Set(proposalIds)]);

  const projectRows = await db.prepare(
    `SELECT id FROM projects WHERE proposal_id IN (SELECT value FROM json_each(?))`
  ).bind(ids).all();
  const projectIds = projectRows.results.map((r: any) => r.id);
  if (projectIds.length) {
    await deleteProjectsCascade(db, projectIds);
  }

  await db.batch([
    db.prepare(`DELETE FROM feedback WHERE proposal_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM proposals WHERE id IN (SELECT value FROM json_each(?))`).bind(ids),
  ]);
}

/**
 * Clear every remaining reference to a set of users so the users themselves can
 * be deleted without tripping a foreign key constraint.
 *
 * Set-based version of the per-user cleanup in the single-user delete route, so
 * the two stay in sync. Each statement is guarded individually: some of these
 * tables are optional in older databases, and D1 `batch()` aborts the whole
 * batch on the first failure.
 */
export async function deleteUserReferences(db: D1Database, userIds: string[]) {
  if (!userIds.length) return;
  const idsJson = JSON.stringify([...new Set(userIds)]);

  const users = await db.prepare(
    `SELECT id, email, student_id_num FROM users WHERE id IN (SELECT value FROM json_each(?))`
  ).bind(idsJson).all();
  const rows = users.results as Array<Record<string, any>>;
  const emails = rows.map((r) => r.email).filter(Boolean);
  const studentIds = rows.map((r) => r.student_id_num).filter(Boolean);

  const safeDelete = async (sql: string, ...args: unknown[]) => {
    try {
      await db.prepare(sql).bind(...args).run();
    } catch {
      // Table absent in this database, or already cleaned up.
    }
  };

  const inIds = (col: string) => `${col} IN (SELECT value FROM json_each(?))`;

  await safeDelete(`DELETE FROM weekly_updates WHERE ${inIds('student_id')}`, idsJson);
  await safeDelete(`DELETE FROM meetings WHERE ${inIds('student_id')} OR ${inIds('supervisor_id')}`, idsJson, idsJson);
  await safeDelete(`DELETE FROM evaluations WHERE ${inIds('student_id')} OR ${inIds('supervisor_id')}`, idsJson, idsJson);
  await safeDelete(`DELETE FROM notifications WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM presence WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM group_members WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM project_members WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM project_media WHERE ${inIds('uploaded_by')}`, idsJson);
  await safeDelete(`DELETE FROM project_feedback WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM feedback WHERE ${inIds('from_user_id')} OR ${inIds('to_user_id')}`, idsJson, idsJson);
  await safeDelete(`DELETE FROM messages WHERE ${inIds('sender_id')}`, idsJson);
  await safeDelete(
    `DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE ${inIds('user_a')} OR ${inIds('user_b')})`,
    idsJson, idsJson
  );
  await safeDelete(`DELETE FROM chats WHERE ${inIds('user_a')} OR ${inIds('user_b')}`, idsJson, idsJson);
  await safeDelete(`DELETE FROM ai_audit_log WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM ai_rate_limits WHERE ${inIds('user_id')}`, idsJson);
  await safeDelete(`DELETE FROM defense_submissions WHERE ${inIds('uploaded_by')}`, idsJson);

  // Applications reference students by email/student ID, not by user id.
  for (const email of emails) {
    await safeDelete(`DELETE FROM student_applications WHERE email = ?`, email);
  }
  for (const sid of studentIds) {
    await safeDelete(`DELETE FROM student_applications WHERE student_id_num = ?`, sid);
  }
}

/**
 * Delete users outright, after removing everything that points at them.
 * Groups they lead and all their child records go with them.
 */
export async function deleteUsersCascade(db: D1Database, userIds: string[]) {
  if (!userIds.length) return;
  const idsJson = JSON.stringify([...new Set(userIds)]);

  const ledGroups = await db.prepare(
    `SELECT id FROM groups WHERE leader_id IN (SELECT value FROM json_each(?))`
  ).bind(idsJson).all();
  const ledGroupIds = (ledGroups.results as Array<Record<string, any>>).map((r) => r.id);
  if (ledGroupIds.length) {
    await deleteGroupsCascade(db, ledGroupIds);
  }

  // Proposals/projects owned by these users may survive the group cascade
  // (e.g. an ungrouped proposal), so clear them explicitly too.
  const proposalRows = await db.prepare(
    `SELECT id FROM proposals WHERE submitted_by IN (SELECT value FROM json_each(?)) OR supervisor_id IN (SELECT value FROM json_each(?))`
  ).bind(idsJson, idsJson).all();
  const proposalIds = (proposalRows.results as Array<Record<string, any>>).map((r) => r.id);
  if (proposalIds.length) {
    await deleteProposalsCascade(db, proposalIds);
  }

  await deleteUserReferences(db, userIds);

  // user_sessions has ON DELETE CASCADE, but only where foreign keys are enforced.
  try {
    await db.prepare(`DELETE FROM user_sessions WHERE user_id IN (SELECT value FROM json_each(?))`).bind(idsJson).run();
  } catch {
    // Table absent in this database.
  }

  await db.prepare(`DELETE FROM users WHERE id IN (SELECT value FROM json_each(?))`).bind(idsJson).run();
}
