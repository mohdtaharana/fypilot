-- Allow more than one evaluation per QR link.
--
-- fyp_evaluations.token was declared UNIQUE, so a group could only ever be
-- evaluated once for the lifetime of its QR code: the second submission failed
-- with SQLITE_CONSTRAINT_UNIQUE. A group is legitimately evaluated more than
-- once (an external examiner plus the internal supervisor, re-submissions after
-- a correction), and several examiners may share one printed code.
--
-- The token is a group-level public secret, not a per-row identifier, so it only
-- needs a lookup index - which idx_fyp_evals_token already provides. Uniqueness
-- belongs on groups.evaluation_token, where idx_groups_evaluation_token already
-- enforces exactly one live link per group.
--
-- SQLite cannot drop a column constraint, so the table is rebuilt: new table,
-- copy rows, drop old, rename. The new definition is column-for-column identical
-- apart from the removed UNIQUE on token, and the indexes are recreated.

PRAGMA foreign_keys = OFF;

CREATE TABLE fyp_evaluations_new (
  id TEXT PRIMARY KEY,

  -- Public scan target. Random 32-char token, not the group id, so the
  -- evaluation URL cannot be enumerated or guessed. Not unique: many
  -- evaluations may share one group's link.
  token TEXT NOT NULL,

  group_id TEXT NOT NULL,
  project_id TEXT,

  -- Content (max 25)
  objectives INTEGER NOT NULL DEFAULT 0,
  literature INTEGER NOT NULL DEFAULT 0,
  methodology INTEGER NOT NULL DEFAULT 0,
  results_analysis INTEGER NOT NULL DEFAULT 0,
  innovation INTEGER NOT NULL DEFAULT 0,

  -- Technical proficiency (max 15)
  coding_skills INTEGER NOT NULL DEFAULT 0,
  tools_used INTEGER NOT NULL DEFAULT 0,
  complexity INTEGER NOT NULL DEFAULT 0,

  -- Presentation (max 10)
  clarity INTEGER NOT NULL DEFAULT 0,
  explanation INTEGER NOT NULL DEFAULT 0,
  qa_handling INTEGER NOT NULL DEFAULT 0,

  -- Report quality (max 10)
  structure INTEGER NOT NULL DEFAULT 0,
  conciseness INTEGER NOT NULL DEFAULT 0,
  citations INTEGER NOT NULL DEFAULT 0,

  -- Teamwork (max 5)
  contribution INTEGER NOT NULL DEFAULT 0,

  -- Overall impact (max 20)
  real_world_app INTEGER NOT NULL DEFAULT 0,
  project_complexity INTEGER NOT NULL DEFAULT 0,

  -- Server-calculated totals (never trusted from the client)
  content_total INTEGER NOT NULL DEFAULT 0,
  technical_total INTEGER NOT NULL DEFAULT 0,
  presentation_total INTEGER NOT NULL DEFAULT 0,
  report_total INTEGER NOT NULL DEFAULT 0,
  teamwork_total INTEGER NOT NULL DEFAULT 0,
  impact_total INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  raw_score INTEGER,
  grade TEXT,

  comments TEXT,
  suggestions TEXT,
  examiner_name TEXT NOT NULL,
  examiner_id TEXT,
  examiner_designation TEXT,
  examiner_email TEXT,

  department TEXT,
  degree_subject TEXT,
  presentation_date TEXT,
  signature_confirmed INTEGER,

  evaluation_date TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

INSERT INTO fyp_evaluations_new (
  id, token, group_id, project_id,
  objectives, literature, methodology, results_analysis, innovation,
  coding_skills, tools_used, complexity,
  clarity, explanation, qa_handling,
  structure, conciseness, citations,
  contribution,
  real_world_app, project_complexity,
  content_total, technical_total, presentation_total,
  report_total, teamwork_total, impact_total,
  total_score, raw_score, grade, comments, suggestions,
  examiner_name, examiner_id, examiner_designation, examiner_email,
  department, degree_subject, presentation_date, signature_confirmed,
  evaluation_date, created_at
)
SELECT
  id, token, group_id, project_id,
  objectives, literature, methodology, results_analysis, innovation,
  coding_skills, tools_used, complexity,
  clarity, explanation, qa_handling,
  structure, conciseness, citations,
  contribution,
  real_world_app, project_complexity,
  content_total, technical_total, presentation_total,
  report_total, teamwork_total, impact_total,
  total_score, raw_score, grade, comments, suggestions,
  examiner_name, examiner_id, examiner_designation, examiner_email,
  department, degree_subject, presentation_date, signature_confirmed,
  evaluation_date, created_at
FROM fyp_evaluations;

DROP TABLE fyp_evaluations;
ALTER TABLE fyp_evaluations_new RENAME TO fyp_evaluations;

CREATE INDEX IF NOT EXISTS idx_fyp_evals_group ON fyp_evaluations(group_id);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_project ON fyp_evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_token ON fyp_evaluations(token);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_created ON fyp_evaluations(created_at);

PRAGMA foreign_keys = ON;
