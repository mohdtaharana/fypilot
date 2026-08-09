-- Synapse FYP Management Platform - Initial Schema

-- Users table (students, supervisors, coordinators)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'supervisor', 'coordinator', 'admin')),
  department TEXT,
  expertise TEXT, -- JSON array for supervisors
  research_areas TEXT, -- JSON array for supervisors
  max_students INTEGER DEFAULT 8,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT,
  problem_statement TEXT,
  objectives TEXT, -- JSON array
  methodology TEXT,
  expected_outcomes TEXT,
  technologies TEXT, -- JSON array
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested')),
  submitted_by TEXT NOT NULL,
  supervisor_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  proposal_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
  health TEXT DEFAULT 'healthy' CHECK(health IN ('healthy', 'at_risk', 'critical')),
  progress INTEGER DEFAULT 0,
  supervisor_id TEXT,
  department TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);

-- Project members (students in a project)
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT,
  scheduled_at TEXT,
  completed_at TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- AI Analysis Cache
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'proposal', 'project', 'supervisor_match'
  entity_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL, -- 'quality', 'similarity', 'risk', 'recommendation', 'insights', 'summary'
  result TEXT NOT NULL, -- JSON result
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL, -- hash of input data for cache invalidation
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

-- AI Audit Log
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  model TEXT,
  prompt_version TEXT,
  input_summary TEXT,
  output_summary TEXT,
  duration_ms INTEGER,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AI Rate Limiting
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Feedback records
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  proposal_id TEXT,
  project_id TEXT,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK(type IN ('general', 'proposal_review', 'progress_review')),
  ai_assisted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_submitted_by ON proposals(submitted_by);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_projects_supervisor ON projects(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(health);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entity ON ai_analysis_cache(entity_type, entity_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_analysis_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_rate_user ON ai_rate_limits(user_id, action);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
