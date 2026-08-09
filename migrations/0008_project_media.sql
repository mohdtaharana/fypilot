-- Project deliverable links (GitHub, demo, docs, etc.)
CREATE TABLE IF NOT EXISTS project_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Project screenshots / images uploaded by student members (base64 data URL)
CREATE TABLE IF NOT EXISTS project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  uploaded_by TEXT,
  caption TEXT,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Feedback by coordinators/supervisors. media_id NULL => overall project feedback.
CREATE TABLE IF NOT EXISTS project_feedback (
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

CREATE INDEX IF NOT EXISTS idx_pl_project ON project_links(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_pf_project ON project_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_pf_media ON project_feedback(media_id);
