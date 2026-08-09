-- FYPilot Chat Module - WhatsApp-style 1:1 messaging

-- Chats (1:1 conversations between two participants)
CREATE TABLE IF NOT EXISTS chats (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,             -- 'minUserId|maxUserId'
  user_a TEXT NOT NULL,                -- lexicographically smaller user id
  user_b TEXT NOT NULL,                -- lexicographically larger user id
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_a, user_b),
  FOREIGN KEY (user_a) REFERENCES users(id),
  FOREIGN KEY (user_b) REFERENCES users(id)
);

-- Messages (text, image with caption, voice, file)
CREATE TABLE IF NOT EXISTS messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'voice', 'file')),
  content TEXT,                        -- text body or media caption
  media_data TEXT,                     -- base64 data URL (image / voice / file)
  media_mime TEXT,
  media_duration INTEGER,              -- voice duration in seconds
  reply_to_id TEXT,                    -- message this one replies to
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_edited INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,                        -- set when the peer opens the chat
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (reply_to_id) REFERENCES messages(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_a ON chats(user_a);
CREATE INDEX IF NOT EXISTS idx_chats_user_b ON chats(user_b);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, seq);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(chat_id, is_pinned);
