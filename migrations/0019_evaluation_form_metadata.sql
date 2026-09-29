-- Evaluation form metadata block (official FYP evaluation document).
--
-- The printed form carries a header (department, degree, group members, project
-- title, supervisor, date of presentation) and a signature footer. Group
-- members / project title / supervisor are pre-filled from the group, so only
-- the examiner-supplied values need storing.

ALTER TABLE fyp_evaluations ADD COLUMN department TEXT;
ALTER TABLE fyp_evaluations ADD COLUMN degree_subject TEXT;
ALTER TABLE fyp_evaluations ADD COLUMN presentation_date TEXT;
ALTER TABLE fyp_evaluations ADD COLUMN signature_confirmed INTEGER NOT NULL DEFAULT 0;
