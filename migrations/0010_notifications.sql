-- FYPilot Notifications Module

CREATE TABLE IF NOT EXISTS notifications (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,               -- recipient
  type TEXT NOT NULL,                  -- approval | proposal | project | group | chat | feedback | system
  title TEXT NOT NULL,
  body TEXT,
  link_view TEXT,                      -- which app view to open: dashboard | proposals | projects | groups | chats | people | profile
  ref_id TEXT,                         -- optional related record id (proposal id, project id, group id, chat id)
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
