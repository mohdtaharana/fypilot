-- Migration 0015: repair the foreign keys that point at the orphaned "users_old" table.
--
-- The users table was previously rebuilt by hand (ALTER TABLE users RENAME TO users_old
-- plus a new users table). SQLite rewrites every REFERENCES clause when a table is
-- renamed, so all 17 child tables ended up validating user ids against "users_old".
-- Any insert that referenced a user created in the new users table - approving a student
-- application creates a user, a group, a group member, a proposal, a project and a
-- project member - then failed with SQLITE_CONSTRAINT_FOREIGNKEY.
--
-- This migration points every foreign key back at "users", keeps all existing rows and
-- drops the leftover "users_old" table. It is also safe on a healthy database: the
-- rebuild then only rewrites identical schemas.
--
-- Foreign key checks are deferred so the table swaps below cannot trip over each other;
-- the rows are copied back before the migration commits.

-- 0. Stand-in so the statements below stay valid on a database that never had a
-- "users_old" table. It is dropped again in step 6.
CREATE TABLE IF NOT EXISTS users_old (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'supervisor', 'coordinator', 'hod', 'dean', 'admin')),
  department TEXT,
  expertise TEXT,
  research_areas TEXT,
  max_students INTEGER DEFAULT 8,
  avatar_url TEXT,
  created_at TEXT,
  updated_at TEXT,
  status TEXT,
  password TEXT,
  avatar TEXT,
  student_id_num TEXT,
  program TEXT,
  shift TEXT
);


-- 1. Snapshot every affected table (plus project_links, which references projects) so no
--    row is lost while the tables are dropped and recreated.

DROP TABLE IF EXISTS _fkfix_users;
CREATE TABLE _fkfix_users AS SELECT * FROM users;

DROP TABLE IF EXISTS _fkfix_feedback;
CREATE TABLE _fkfix_feedback AS SELECT * FROM feedback;

DROP TABLE IF EXISTS _fkfix_project_feedback;
CREATE TABLE _fkfix_project_feedback AS SELECT * FROM project_feedback;

DROP TABLE IF EXISTS _fkfix_project_links;
CREATE TABLE _fkfix_project_links AS SELECT * FROM project_links;

DROP TABLE IF EXISTS _fkfix_project_media;
CREATE TABLE _fkfix_project_media AS SELECT * FROM project_media;

DROP TABLE IF EXISTS _fkfix_project_members;
CREATE TABLE _fkfix_project_members AS SELECT * FROM project_members;

DROP TABLE IF EXISTS _fkfix_weekly_updates;
CREATE TABLE _fkfix_weekly_updates AS SELECT * FROM weekly_updates;

DROP TABLE IF EXISTS _fkfix_evaluations;
CREATE TABLE _fkfix_evaluations AS SELECT * FROM evaluations;

DROP TABLE IF EXISTS _fkfix_meetings;
CREATE TABLE _fkfix_meetings AS SELECT * FROM meetings;

DROP TABLE IF EXISTS _fkfix_projects;
CREATE TABLE _fkfix_projects AS SELECT * FROM projects;

DROP TABLE IF EXISTS _fkfix_proposals;
CREATE TABLE _fkfix_proposals AS SELECT * FROM proposals;

DROP TABLE IF EXISTS _fkfix_group_members;
CREATE TABLE _fkfix_group_members AS SELECT * FROM group_members;

DROP TABLE IF EXISTS _fkfix_groups;
CREATE TABLE _fkfix_groups AS SELECT * FROM groups;

DROP TABLE IF EXISTS _fkfix_messages;
CREATE TABLE _fkfix_messages AS SELECT * FROM messages;

DROP TABLE IF EXISTS _fkfix_chats;
CREATE TABLE _fkfix_chats AS SELECT * FROM chats;

DROP TABLE IF EXISTS _fkfix_notifications;
CREATE TABLE _fkfix_notifications AS SELECT * FROM notifications;

DROP TABLE IF EXISTS _fkfix_presence;
CREATE TABLE _fkfix_presence AS SELECT * FROM presence;

DROP TABLE IF EXISTS _fkfix_ai_audit_log;
CREATE TABLE _fkfix_ai_audit_log AS SELECT * FROM ai_audit_log;

DROP TABLE IF EXISTS _fkfix_ai_rate_limits;
CREATE TABLE _fkfix_ai_rate_limits AS SELECT * FROM ai_rate_limits;


-- 2. Drop them, children before parents, because DROP TABLE runs an implicit DELETE FROM
--    that would otherwise break a foreign key in a table that is still around.

DROP TABLE feedback;

DROP TABLE project_feedback;

DROP TABLE project_links;

DROP TABLE project_media;

DROP TABLE project_members;

DROP TABLE weekly_updates;

DROP TABLE evaluations;

DROP TABLE meetings;

DROP TABLE projects;

DROP TABLE proposals;

DROP TABLE group_members;

DROP TABLE groups;

DROP TABLE messages;

DROP TABLE chats;

DROP TABLE notifications;

DROP TABLE presence;

DROP TABLE ai_audit_log;

DROP TABLE ai_rate_limits;


-- 2b. Rebuild users itself. The role CHECK constraint cannot be altered in place, and
--     D1 refuses both PRAGMA foreign_keys = OFF and PRAGMA writable_schema, so the table
--     has to be dropped and recreated. That is only safe now, because every table that
--     references users has already been dropped in step 2 and still holds its rows in the
--     _fkfix_ snapshots. The expanded CHECK adds the hod and dean roles.

DROP TABLE users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'supervisor', 'coordinator', 'hod', 'dean', 'admin')),
  department TEXT,
  expertise TEXT,
  research_areas TEXT,
  max_students INTEGER DEFAULT 8,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending', 'rejected')),
  password TEXT,
  avatar TEXT,
  student_id_num TEXT,
  program TEXT,
  shift TEXT
);

INSERT INTO users (
  id, email, name, role, department, expertise, research_areas, max_students,
  avatar_url, created_at, updated_at, status, password, avatar, student_id_num, program, shift
)
SELECT
  id, email, name, role, department, expertise, research_areas, max_students,
  avatar_url, created_at, updated_at, status, password, avatar, student_id_num, program, shift
FROM _fkfix_users;

DROP TABLE _fkfix_users;


-- 3. Recreate each table with its foreign keys pointing at users again, and restore the
--    rows from the snapshots.

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  max_members INTEGER DEFAULT 4,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (leader_id) REFERENCES users(id)
);
INSERT INTO groups (id, name, leader_id, status, max_members, created_at) SELECT id, name, leader_id, status, max_members, created_at FROM _fkfix_groups;
DROP TABLE _fkfix_groups;

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT,
  problem_statement TEXT,
  objectives TEXT, 
  methodology TEXT,
  expected_outcomes TEXT,
  technologies TEXT, 
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested')),
  submitted_by TEXT NOT NULL,
  supervisor_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), group_id TEXT REFERENCES groups(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);
INSERT INTO proposals (id, title, abstract, problem_statement, objectives, methodology, expected_outcomes, technologies, scope, status, submitted_by, supervisor_id, created_at, updated_at, group_id) SELECT id, title, abstract, problem_statement, objectives, methodology, expected_outcomes, technologies, scope, status, submitted_by, supervisor_id, created_at, updated_at, group_id FROM _fkfix_proposals;
DROP TABLE _fkfix_proposals;

CREATE TABLE projects (
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
INSERT INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department, start_date, end_date, created_at, updated_at) SELECT id, title, description, proposal_id, status, health, progress, supervisor_id, department, start_date, end_date, created_at, updated_at FROM _fkfix_projects;
DROP TABLE _fkfix_projects;

CREATE TABLE project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
INSERT INTO project_links (id, project_id, label, url, created_at) SELECT id, project_id, label, url, created_at FROM _fkfix_project_links;
DROP TABLE _fkfix_project_links;

CREATE TABLE feedback (
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
INSERT INTO feedback (id, proposal_id, project_id, from_user_id, to_user_id, content, type, ai_assisted, created_at) SELECT id, proposal_id, project_id, from_user_id, to_user_id, content, type, ai_assisted, created_at FROM _fkfix_feedback;
DROP TABLE _fkfix_feedback;

CREATE TABLE project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  uploaded_by TEXT,
  caption TEXT,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
INSERT INTO project_media (id, project_id, uploaded_by, caption, data, created_at) SELECT id, project_id, uploaded_by, caption, data, created_at FROM _fkfix_project_media;
DROP TABLE _fkfix_project_media;

CREATE TABLE project_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  media_id TEXT,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (media_id) REFERENCES project_media(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO project_feedback (id, project_id, media_id, user_id, message, created_at) SELECT id, project_id, media_id, user_id, message, created_at FROM _fkfix_project_feedback;
DROP TABLE _fkfix_project_feedback;

CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO project_members (id, project_id, user_id, role, joined_at) SELECT id, project_id, user_id, role, joined_at FROM _fkfix_project_members;
DROP TABLE _fkfix_project_members;

CREATE TABLE group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')), group_status TEXT DEFAULT 'pending',
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO group_members (id, group_id, user_id, joined_at, group_status) SELECT id, group_id, user_id, joined_at, group_status FROM _fkfix_group_members;
DROP TABLE _fkfix_group_members;

CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT,
  scheduled_at TEXT,
  completed_at TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  created_at TEXT DEFAULT (datetime('now')), student_id TEXT REFERENCES users(id), supervisor_id TEXT REFERENCES users(id), meeting_date TEXT, discussion TEXT, work_discussed TEXT, action_items TEXT, next_meeting_plan TEXT, verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected', 'revision_requested')), supervisor_feedback TEXT, verified_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
INSERT INTO meetings (id, project_id, title, scheduled_at, completed_at, notes, status, created_at, student_id, supervisor_id, meeting_date, discussion, work_discussed, action_items, next_meeting_plan, verification_status, supervisor_feedback, verified_at) SELECT id, project_id, title, scheduled_at, completed_at, notes, status, created_at, student_id, supervisor_id, meeting_date, discussion, work_discussed, action_items, next_meeting_plan, verification_status, supervisor_feedback, verified_at FROM _fkfix_meetings;
DROP TABLE _fkfix_meetings;

CREATE TABLE weekly_updates (
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
INSERT INTO weekly_updates (id, project_id, student_id, week_number, work_done, progress_pct, description, planned_work, lifecycle_stage, supervisor_feedback, created_at, updated_at) SELECT id, project_id, student_id, week_number, work_done, progress_pct, description, planned_work, lifecycle_stage, supervisor_feedback, created_at, updated_at FROM _fkfix_weekly_updates;
DROP TABLE _fkfix_weekly_updates;

CREATE TABLE evaluations (
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
INSERT INTO evaluations (id, project_id, student_id, supervisor_id, grade, score, comments, evaluation_date, created_at) SELECT id, project_id, student_id, supervisor_id, grade, score, comments, evaluation_date, created_at FROM _fkfix_evaluations;
DROP TABLE _fkfix_evaluations;

CREATE TABLE notifications (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,               
  type TEXT NOT NULL,                  
  title TEXT NOT NULL,
  body TEXT,
  link_view TEXT,                      
  ref_id TEXT,                         
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO notifications (seq, id, user_id, type, title, body, link_view, ref_id, is_read, created_at) SELECT seq, id, user_id, type, title, body, link_view, ref_id, is_read, created_at FROM _fkfix_notifications;
DROP TABLE _fkfix_notifications;

CREATE TABLE presence (
  user_id TEXT PRIMARY KEY,
  last_active_at TEXT,             
  typing_chat_id TEXT,             
  typing_at TEXT,                  
  recording_chat_id TEXT,          
  recording_at TEXT,               
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO presence (user_id, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at) SELECT user_id, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at FROM _fkfix_presence;
DROP TABLE _fkfix_presence;

CREATE TABLE chats (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,             
  user_a TEXT NOT NULL,                
  user_b TEXT NOT NULL,                
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_a, user_b),
  FOREIGN KEY (user_a) REFERENCES users(id),
  FOREIGN KEY (user_b) REFERENCES users(id)
);
INSERT INTO chats (seq, id, user_a, user_b, created_at, updated_at) SELECT seq, id, user_a, user_b, created_at, updated_at FROM _fkfix_chats;
DROP TABLE _fkfix_chats;

CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'voice', 'file')),
  content TEXT,                        
  media_data TEXT,                     
  media_mime TEXT,
  media_duration INTEGER,              
  reply_to_id TEXT,                    
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_edited INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,                        
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (reply_to_id) REFERENCES messages(id)
);
INSERT INTO messages (seq, id, chat_id, sender_id, type, content, media_data, media_mime, media_duration, reply_to_id, is_pinned, is_edited, read_at, created_at) SELECT seq, id, chat_id, sender_id, type, content, media_data, media_mime, media_duration, reply_to_id, is_pinned, is_edited, read_at, created_at FROM _fkfix_messages;
DROP TABLE _fkfix_messages;

CREATE TABLE ai_audit_log (
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
INSERT INTO ai_audit_log (id, user_id, user_role, action, entity_type, entity_id, model, prompt_version, input_summary, output_summary, duration_ms, success, error_message, created_at) SELECT id, user_id, user_role, action, entity_type, entity_id, model, prompt_version, input_summary, output_summary, duration_ms, success, error_message, created_at FROM _fkfix_ai_audit_log;
DROP TABLE _fkfix_ai_audit_log;

CREATE TABLE ai_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO ai_rate_limits (id, user_id, action, request_count, window_start) SELECT id, user_id, action, request_count, window_start FROM _fkfix_ai_rate_limits;
DROP TABLE _fkfix_ai_rate_limits;


-- 4. Recreate the indexes that were dropped along with their table.

CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_rate_user ON ai_rate_limits(user_id, action);

CREATE INDEX IF NOT EXISTS idx_chats_user_a ON chats(user_a);

CREATE INDEX IF NOT EXISTS idx_chats_user_b ON chats(user_b);

CREATE INDEX IF NOT EXISTS idx_evaluations_project ON evaluations(project_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gm_one_group_per_user
ON group_members(user_id)
WHERE group_status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id);

CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);

CREATE INDEX IF NOT EXISTS idx_meetings_verification ON meetings(verification_status);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, seq);

CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(chat_id, is_pinned);

CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pf_media ON project_feedback(media_id);

CREATE INDEX IF NOT EXISTS idx_pf_project ON project_feedback(project_id);

CREATE INDEX IF NOT EXISTS idx_pl_project ON project_links(project_id);

CREATE INDEX IF NOT EXISTS idx_pm_project ON project_media(project_id);

CREATE INDEX IF NOT EXISTS idx_presence_recording ON presence(recording_chat_id);

CREATE INDEX IF NOT EXISTS idx_presence_typing ON presence(typing_chat_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(health);

CREATE INDEX IF NOT EXISTS idx_projects_supervisor ON projects(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_proposals_group ON proposals(group_id);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

CREATE INDEX IF NOT EXISTS idx_proposals_submitted_by ON proposals(submitted_by);

CREATE INDEX IF NOT EXISTS idx_weekly_updates_project ON weekly_updates(project_id);

CREATE INDEX IF NOT EXISTS idx_weekly_updates_student ON weekly_updates(student_id);


-- 5. Recreate the triggers that kept group_members.group_status in sync.

CREATE TRIGGER IF NOT EXISTS trg_gm_group_status_ins
AFTER INSERT ON group_members
BEGIN
  UPDATE group_members SET group_status = (SELECT status FROM groups WHERE groups.id = NEW.group_id)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_gm_group_status_upd
AFTER UPDATE OF status ON groups
BEGIN
  UPDATE group_members SET group_status = NEW.status WHERE group_id = NEW.id;
END;


-- 6. Recover any user row that only exists in the orphaned table, then drop it.

INSERT OR IGNORE INTO users (id, email, name, role, department, expertise, research_areas, max_students, avatar_url, created_at, updated_at, status, password, avatar, student_id_num, program, shift)
SELECT id, email, name, role, department, expertise, research_areas, max_students, avatar_url, created_at, updated_at, status, password, avatar, student_id_num, program, shift FROM users_old;

DROP TABLE users_old;


-- 7. Recreate the users indexes (they moved to users_old with the old table).

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

