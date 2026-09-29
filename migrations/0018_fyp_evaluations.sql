-- FYP external evaluation module (rubric based, 100 marks)
--
-- Deliberately a SEPARATE table from the existing `evaluations` table: that one
-- stores per-student supervisor evaluations (student_id + supervisor_id NOT NULL
-- with foreign keys) and is used by the supervisor evaluation feature. This
-- table stores one group-level evaluation from an external examiner.

CREATE TABLE IF NOT EXISTS fyp_evaluations (
  id TEXT PRIMARY KEY,

  -- Public scan target. Random 32-char token, not the group id, so the
  -- evaluation URL cannot be enumerated or guessed.
  token TEXT NOT NULL UNIQUE,

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
  grade TEXT,

  comments TEXT,
  suggestions TEXT,
  examiner_name TEXT NOT NULL,
  examiner_id TEXT,
  examiner_designation TEXT,
  examiner_email TEXT,

  evaluation_date TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fyp_evals_group ON fyp_evaluations(group_id);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_project ON fyp_evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_token ON fyp_evaluations(token);
CREATE INDEX IF NOT EXISTS idx_fyp_evals_created ON fyp_evaluations(created_at);

-- Evaluation link token lives on the group so it stays stable across
-- re-issuance: regenerating must be an explicit admin action, otherwise a
-- previously printed QR code silently stops working.
ALTER TABLE groups ADD COLUMN evaluation_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_evaluation_token ON groups(evaluation_token)
  WHERE evaluation_token IS NOT NULL;
