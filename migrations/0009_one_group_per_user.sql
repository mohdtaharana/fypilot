-- Enforce: a student cannot belong to more than one active (pending/approved) group.
-- (Rejected groups are excluded so a student can start over after rejection.)

-- Keep a synced copy of the parent group's status on each group_members row.
ALTER TABLE group_members ADD COLUMN group_status TEXT DEFAULT 'pending';

UPDATE group_members SET group_status = (SELECT status FROM groups WHERE groups.id = group_members.group_id);

-- Sync it on new memberships.
CREATE TRIGGER IF NOT EXISTS trg_gm_group_status_ins
AFTER INSERT ON group_members
BEGIN
  UPDATE group_members SET group_status = (SELECT status FROM groups WHERE groups.id = NEW.group_id)
  WHERE id = NEW.id;
END;

-- Sync it whenever a group's status changes (approve/reject).
CREATE TRIGGER IF NOT EXISTS trg_gm_group_status_upd
AFTER UPDATE OF status ON groups
BEGIN
  UPDATE group_members SET group_status = NEW.status WHERE group_id = NEW.id;
END;

-- Unique: one active group per student.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gm_one_group_per_user
ON group_members(user_id)
WHERE group_status IN ('pending', 'approved');
