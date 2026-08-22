-- Migration 0012: Student Applications, Weekly Updates, Meeting Verification & Student Evaluations

CREATE TABLE IF NOT EXISTS student_applications (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  student_id_num TEXT UNIQUE NOT NULL,
  student_name TEXT NOT NULL,
  program TEXT NOT NULL CHECK(program IN ('BS', 'MS')),
  shift TEXT NOT NULL CHECK(shift IN ('Morning', 'Evening')),
  department TEXT NOT NULL,
  internship_certificate TEXT NOT NULL,
  internship_filename TEXT,
  group_name TEXT NOT NULL,
  project_title TEXT NOT NULL,
  group_members TEXT NOT NULL,
  supervisor_preference_1 TEXT NOT NULL,
  supervisor_preference_2 TEXT,
  supervisor_preference_3 TEXT,
  supervisor_priority TEXT NOT NULL DEFAULT 'Normal' CHECK(supervisor_priority IN ('Normal', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'rejected', 'revision_requested')),
  admin_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN student_id_num TEXT;
ALTER TABLE users ADD COLUMN program TEXT;
ALTER TABLE users ADD COLUMN shift TEXT;

CREATE TABLE IF NOT EXISTS weekly_updates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  work_done TEXT NOT NULL,
  progress_pct INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  planned_work TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  supervisor_feedback TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

ALTER TABLE meetings ADD COLUMN student_id TEXT REFERENCES users(id);
ALTER TABLE meetings ADD COLUMN supervisor_id TEXT REFERENCES users(id);
ALTER TABLE meetings ADD COLUMN meeting_date TEXT;
ALTER TABLE meetings ADD COLUMN discussion TEXT;
ALTER TABLE meetings ADD COLUMN work_discussed TEXT;
ALTER TABLE meetings ADD COLUMN action_items TEXT;
ALTER TABLE meetings ADD COLUMN next_meeting_plan TEXT;
ALTER TABLE meetings ADD COLUMN verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected', 'revision_requested'));
ALTER TABLE meetings ADD COLUMN supervisor_feedback TEXT;
ALTER TABLE meetings ADD COLUMN verified_at TEXT;

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  supervisor_id TEXT NOT NULL,
  grade TEXT,
  score INTEGER,
  comments TEXT NOT NULL,
  evaluation_date TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_apps_email ON student_applications(email);
CREATE INDEX IF NOT EXISTS idx_student_apps_status ON student_applications(status);
CREATE INDEX IF NOT EXISTS idx_weekly_updates_project ON weekly_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_updates_student ON weekly_updates(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_verification ON meetings(verification_status);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_project ON evaluations(project_id);
