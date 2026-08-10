-- FYPilot Presence Module - online / last seen / typing / recording indicators

CREATE TABLE IF NOT EXISTS presence (
  user_id TEXT PRIMARY KEY,
  last_active_at TEXT,             -- ISO timestamp of the last heartbeat / request
  typing_chat_id TEXT,             -- chat id the user is currently typing in (null = not typing)
  typing_at TEXT,                  -- ISO timestamp of the last typing signal
  recording_chat_id TEXT,          -- chat id the user is currently recording a voice note in
  recording_at TEXT,               -- ISO timestamp of the last recording signal
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_presence_typing ON presence(typing_chat_id);
CREATE INDEX IF NOT EXISTS idx_presence_recording ON presence(recording_chat_id);
