-- Migration 0014: Defense deadlines, submissions, and scheduling

CREATE TABLE IF NOT EXISTS defense_deadlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Final Defense',
  submission_deadline TEXT,
  presentation_start TEXT NOT NULL DEFAULT '09:00',
  presentation_end TEXT NOT NULL DEFAULT '17:00',
  default_duration_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS defense_submissions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  project_id TEXT,
  group_name TEXT,
  pptx_file TEXT,
  pptx_pdf_file TEXT,
  docx_file TEXT,
  docx_pdf_file TEXT,
  notes TEXT,
  uploaded_by TEXT,
  uploaded_at TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS defense_slots (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE,
  project_id TEXT,
  group_name TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_defense_deadlines_created ON defense_deadlines(created_at);
CREATE INDEX IF NOT EXISTS idx_defense_submissions_group ON defense_submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_defense_submissions_status ON defense_submissions(status);
CREATE INDEX IF NOT EXISTS idx_defense_slots_group ON defense_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_defense_slots_status ON defense_slots(status);
