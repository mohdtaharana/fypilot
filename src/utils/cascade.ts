// Shared DB cascade helpers for deleting projects/groups (and everything referencing them).

// Delete projects and all child records (feedback, media, links, meetings, members).
// projectIds must be unique; empty list is a no-op.
export async function deleteProjectsCascade(db: D1Database, projectIds: string[]) {
  if (!projectIds.length) return;
  const ids = JSON.stringify([...new Set(projectIds)]);
  await db.batch([
    db.prepare(`DELETE FROM project_feedback WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_media WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_links WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM meetings WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM project_members WHERE project_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare(`DELETE FROM projects WHERE id IN (SELECT value FROM json_each(?))`).bind(ids),
  ]);
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

  const stmts: D1PreparedStatement[] = [];
  if (projectIds.length) {
    stmts.push(
      db.prepare(`DELETE FROM project_feedback WHERE project_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
      db.prepare(`DELETE FROM project_media WHERE project_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
      db.prepare(`DELETE FROM project_links WHERE project_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
      db.prepare(`DELETE FROM meetings WHERE project_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
      db.prepare(`DELETE FROM project_members WHERE project_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
      db.prepare(`DELETE FROM projects WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(projectIds)),
    );
  }
  if (proposalIds.length) {
    stmts.push(db.prepare(`DELETE FROM proposals WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(proposalIds)));
  }
  stmts.push(
    db.prepare(`DELETE FROM group_members WHERE group_id IN (SELECT value FROM json_each(?))`).bind(groupsJson),
    db.prepare(`DELETE FROM groups WHERE id IN (SELECT value FROM json_each(?))`).bind(groupsJson),
  );
  await db.batch(stmts);
}
