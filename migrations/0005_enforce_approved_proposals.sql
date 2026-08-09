-- Enforce: projects may only exist when linked to an approved proposal
-- Clean up any existing projects not backed by an approved proposal
-- (children must be deleted before parents due to no ON DELETE CASCADE)

DELETE FROM meetings WHERE project_id IN (
  SELECT p.id FROM projects p
  LEFT JOIN proposals pr ON p.proposal_id = pr.id
  WHERE p.proposal_id IS NULL OR pr.id IS NULL OR pr.status != 'approved'
);

DELETE FROM project_members WHERE project_id IN (
  SELECT p.id FROM projects p
  LEFT JOIN proposals pr ON p.proposal_id = pr.id
  WHERE p.proposal_id IS NULL OR pr.id IS NULL OR pr.status != 'approved'
);

DELETE FROM projects WHERE id IN (
  SELECT p.id FROM projects p
  LEFT JOIN proposals pr ON p.proposal_id = pr.id
  WHERE p.proposal_id IS NULL OR pr.id IS NULL OR pr.status != 'approved'
);
