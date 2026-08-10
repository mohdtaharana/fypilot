import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { createNotification } from '../notifications/notification.routes';

const chatRoutes = new Hono<{ Bindings: Env }>();

type ChatUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  avatar: string | null;
};

// Role-based chat permission rules
function canChat(fromRole: string, toRole: string): boolean {
  if (!fromRole || !toRole) return false;
  if (fromRole === 'coordinator') return true;
  if (fromRole === 'supervisor') return toRole === 'student' || toRole === 'coordinator';
  if (fromRole === 'student') return toRole === 'supervisor' || toRole === 'coordinator';
  return false;
}

function chatKey(a: string, b: string): { id: string; userA: string; userB: string } {
  const [userA, userB] = a < b ? [a, b] : [b, a];
  return { id: `${userA}|${userB}`, userA, userB };
}

function serializeMessage(row: any): Record<string, unknown> {
  return {
    seq: row.seq,
    id: row.id,
    chat_id: row.chat_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_role: row.sender_role,
    sender_avatar: row.sender_avatar || null,
    type: row.type,
    content: row.content || '',
    media_data: row.media_data || null,
    media_mime: row.media_mime || null,
    media_duration: row.media_duration || null,
    reply_to_id: row.reply_to_id || null,
    reply: row.reply_to_id
      ? {
          sender_id: row.reply_sender_id,
          sender_name: row.reply_sender_name,
          sender_role: row.reply_sender_role,
          type: row.reply_type,
          content: row.reply_content,
          media_mime: row.reply_media_mime,
        }
      : null,
    is_pinned: !!row.is_pinned,
    is_edited: !!row.is_edited,
    read_at: row.read_at || null,
    created_at: row.created_at,
  };
}

// ===== Presence =====

const ONLINE_WINDOW_MS = 60 * 1000;   // user is online if active within the last 60s
const TYPING_WINDOW_MS = 6 * 1000;    // typing/recording signal is live for 6s

async function touchPresence(db: D1Database, userId: string): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO presence (user_id, last_active_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_active_at = excluded.last_active_at`
    ).bind(userId, new Date().toISOString()).run();
  } catch (e) {
    // presence must never break the underlying action
  }
}

function serializePresence(row: any, chatId: string | null, nowIso: string): Record<string, unknown> {
  if (!row) {
    return { online: false, last_seen: null, typing: false, recording: false };
  }
  const now = new Date(nowIso).getTime();
  const active = row.last_active_at ? new Date(row.last_active_at).getTime() : 0;
  const typingAt = row.typing_at ? new Date(row.typing_at).getTime() : 0;
  const recordingAt = row.recording_at ? new Date(row.recording_at).getTime() : 0;
  return {
    online: !!row.last_active_at && now - active < ONLINE_WINDOW_MS,
    last_seen: row.last_active_at || null,
    typing: !!chatId && row.typing_chat_id === chatId && typingAt > 0 && now - typingAt < TYPING_WINDOW_MS,
    recording: !!chatId && row.recording_chat_id === chatId && recordingAt > 0 && now - recordingAt < TYPING_WINDOW_MS,
  };
}

const MESSAGE_SELECT = `
  SELECT m.seq, m.id, m.chat_id, m.sender_id, m.type, m.content, m.media_data,
         m.media_mime, m.media_duration, m.reply_to_id, m.is_pinned, m.is_edited,
         m.read_at, m.created_at,
         u.name as sender_name, u.role as sender_role, u.avatar as sender_avatar,
         r.content as reply_content, r.type as reply_type, r.sender_id as reply_sender_id,
         r.media_mime as reply_media_mime,
         ru.name as reply_sender_name, ru.role as reply_sender_role
  FROM messages m
  JOIN users u ON u.id = m.sender_id
  LEFT JOIN messages r ON r.id = m.reply_to_id
  LEFT JOIN users ru ON ru.id = r.sender_id
`;

// GET /api/chats — list conversations for the current user
chatRoutes.get('/', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const result = await c.env.DB.prepare(
    `SELECT c.id as chat_id,
            CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END as peer_id,
            u.name as peer_name, u.role as peer_role, u.avatar as peer_avatar,
            u.department as peer_department,
            (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) as unread,
            (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.is_pinned = 1) as pinned_count,
            (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.seq DESC LIMIT 1) as last_content,
            (SELECT m.type FROM messages m WHERE m.chat_id = c.id ORDER BY m.seq DESC LIMIT 1) as last_type,
            (SELECT m.sender_id FROM messages m WHERE m.chat_id = c.id ORDER BY m.seq DESC LIMIT 1) as last_sender,
            (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.seq DESC LIMIT 1) as last_at
     FROM chats c
     JOIN users u ON u.id = (CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END)
     WHERE c.user_a = ? OR c.user_b = ?
     ORDER BY COALESCE(last_at, c.updated_at, c.created_at) DESC`
  ).bind(userId, userId, userId, userId, userId).all();

  const chats = (result.results as any[]).map((row) => ({
    id: row.chat_id,
    peer: {
      id: row.peer_id,
      name: row.peer_name,
      role: row.peer_role,
      avatar: row.peer_avatar,
      department: row.peer_department,
    },
    unread: row.unread,
    pinned_count: row.pinned_count,
    last_message: row.last_at
      ? {
          content: row.last_content,
          type: row.last_type,
          sender_id: row.last_sender,
          is_mine: row.last_sender === userId,
          created_at: row.last_at,
        }
      : null,
  }));

  const nowIso = new Date().toISOString();
  for (const chat of chats) {
    const pr = await c.env.DB.prepare('SELECT * FROM presence WHERE user_id = ?').bind(chat.peer.id).first();
    const p = serializePresence(pr as any, null, nowIso);
    (chat as any).peer.online = p.online;
    (chat as any).peer.last_seen = p.last_seen;
  }

  await touchPresence(c.env.DB, userId);

  return c.json({ success: true, data: chats });
});

// POST /api/chats — create or fetch an existing 1:1 chat
chatRoutes.post('/', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const userRole = c.req.header('X-User-Role') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const body = await c.req.json();
  const otherUserId = body.other_user_id;
  if (!otherUserId || typeof otherUserId !== 'string') {
    return c.json({ success: false, error: 'A valid user id is required' }, 400);
  }
  if (otherUserId === userId) {
    return c.json({ success: false, error: 'You cannot start a chat with yourself' }, 400);
  }

  const peer = await c.env.DB.prepare(
    `SELECT id, email, name, role, department, avatar FROM users
     WHERE id = ? AND (status = 'active' OR status IS NULL)`
  ).bind(otherUserId).first() as ChatUser | null;
  if (!peer) return c.json({ success: false, error: 'User not found' }, 404);

  if (!canChat(userRole, peer.role)) {
    return c.json({ success: false, error: 'You are not allowed to chat with this user' }, 403);
  }

  const key = chatKey(userId, otherUserId);
  let chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(key.id).first();

  if (!chat) {
    await c.env.DB.prepare(
      'INSERT INTO chats (id, user_a, user_b) VALUES (?, ?, ?)'
    ).bind(key.id, key.userA, key.userB).run();
    chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(key.id).first();
  }

  return c.json({
    success: true,
    data: {
      id: chat.id,
      peer: {
        id: peer.id,
        name: peer.name,
        role: peer.role,
        avatar: peer.avatar,
        department: peer.department,
      },
      unread: 0,
      pinned_count: 0,
      last_message: null,
    },
  });
});

// POST /api/presence — heartbeat + typing / recording signals
const presenceRoutes = new Hono<{ Bindings: Env }>();

presenceRoutes.post('/', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const typingChatId = typeof body.typing_chat_id === 'string' && body.typing_chat_id ? body.typing_chat_id : null;
  const recordingChatId = typeof body.recording_chat_id === 'string' && body.recording_chat_id ? body.recording_chat_id : null;
  const now = new Date().toISOString();

  if (typingChatId && !recordingChatId) {
    await c.env.DB.prepare(
      `INSERT INTO presence (user_id, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at)
       VALUES (?, ?, ?, ?, NULL, NULL)
       ON CONFLICT(user_id) DO UPDATE SET
         last_active_at = excluded.last_active_at,
         typing_chat_id = excluded.typing_chat_id,
         typing_at = excluded.typing_at,
         recording_chat_id = NULL,
         recording_at = NULL`
    ).bind(userId, now, typingChatId, now).run();
  } else if (recordingChatId) {
    await c.env.DB.prepare(
      `INSERT INTO presence (user_id, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at)
       VALUES (?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         last_active_at = excluded.last_active_at,
         typing_chat_id = NULL,
         typing_at = NULL,
         recording_chat_id = excluded.recording_chat_id,
         recording_at = excluded.recording_at`
    ).bind(userId, now, recordingChatId, now).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO presence (user_id, last_active_at, typing_chat_id, typing_at, recording_chat_id, recording_at)
       VALUES (?, ?, NULL, NULL, NULL, NULL)
       ON CONFLICT(user_id) DO UPDATE SET
         last_active_at = excluded.last_active_at,
         typing_chat_id = NULL,
         typing_at = NULL,
         recording_chat_id = NULL,
         recording_at = NULL`
    ).bind(userId, now).run();
  }

  return c.json({ success: true });
});

// GET /api/chats/:id/messages — fetch messages (+ mark peer messages read when opened)
chatRoutes.get('/:id/messages', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('id');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(chatId).first();
  if (!chat) return c.json({ success: false, error: 'Chat not found' }, 404);
  if (chat.user_a !== userId && chat.user_b !== userId) {
    return c.json({ success: false, error: 'You are not part of this chat' }, 403);
  }

  const after = parseInt(c.req.query('after') || '', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '60', 10), 200);

  let rows: any[];
  if (!isNaN(after) && after > 0) {
    const res = await c.env.DB.prepare(
      `${MESSAGE_SELECT} WHERE m.chat_id = ? AND m.seq > ? ORDER BY m.seq ASC`
    ).bind(chatId, after).all();
    rows = res.results as any[];
  } else {
    const last = await c.env.DB.prepare(
      'SELECT MAX(seq) as max_seq FROM messages WHERE chat_id = ?'
    ).bind(chatId).first() as { max_seq: number | null } | null;
    const maxSeq = last?.max_seq ?? 0;
    const res = await c.env.DB.prepare(
      `${MESSAGE_SELECT} WHERE m.chat_id = ? AND m.seq <= ? ORDER BY m.seq DESC LIMIT ?`
    ).bind(chatId, maxSeq, limit).all();
    rows = (res.results as any[]).reverse();
  }

  // Mark peer messages as read when the chat is actually open
  if (c.req.query('mark_read') === '1') {
    await c.env.DB.prepare(
      `UPDATE messages SET read_at = datetime('now')
       WHERE chat_id = ? AND sender_id != ? AND read_at IS NULL`
    ).bind(chatId, userId).run();
  }

  await touchPresence(c.env.DB, userId);

  const peerId = chat.user_a === userId ? chat.user_b : chat.user_a;
  const peerPresence = await c.env.DB.prepare('SELECT * FROM presence WHERE user_id = ?').bind(peerId).first();

  return c.json({
    success: true,
    data: rows.map(serializeMessage),
    peer: serializePresence(peerPresence as any, chatId, new Date().toISOString()),
  });
});

// POST /api/chats/:id/messages — send a message (text / image / voice / file)
chatRoutes.post('/:id/messages', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const userRole = c.req.header('X-User-Role') || '';
  const chatId = c.req.param('id');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(chatId).first();
  if (!chat) return c.json({ success: false, error: 'Chat not found' }, 404);
  if (chat.user_a !== userId && chat.user_b !== userId) {
    return c.json({ success: false, error: 'You are not part of this chat' }, 403);
  }

  const body = await c.req.json();
  const type = body.type || 'text';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const mediaData = typeof body.media_data === 'string' ? body.media_data : '';
  const mediaMime = typeof body.media_mime === 'string' ? body.media_mime : null;
  const mediaDuration = body.media_duration ? Math.max(1, Math.min(300, parseInt(body.media_duration, 10) || 0)) : null;
  const replyToId = typeof body.reply_to_id === 'string' && body.reply_to_id ? body.reply_to_id : null;

  if (!['text', 'image', 'voice', 'file'].includes(type)) {
    return c.json({ success: false, error: 'Unsupported message type' }, 400);
  }

  if (type === 'text') {
    if (!content) return c.json({ success: false, error: 'Message cannot be empty' }, 400);
  } else {
    if (!mediaData.startsWith('data:')) {
      return c.json({ success: false, error: 'Invalid media payload' }, 400);
    }
    const approxBytes = Math.floor(mediaData.length * 3 / 4);
    const maxBytes = type === 'file' ? 1.5 * 1024 * 1024 : 1.2 * 1024 * 1024;
    if (approxBytes > maxBytes) {
      return c.json({ success: false, error: 'Media is too large (max 1.2MB). Please use a smaller file.' }, 400);
    }
  }
  if (content.length > 4000) return c.json({ success: false, error: 'Message is too long' }, 400);

  if (replyToId) {
    const replyMsg = await c.env.DB.prepare(
      'SELECT id FROM messages WHERE id = ? AND chat_id = ?'
    ).bind(replyToId, chatId).first();
    if (!replyMsg) return c.json({ success: false, error: 'Message to reply to was not found' }, 404);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, chat_id, sender_id, type, content, media_data, media_mime, media_duration, reply_to_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, chatId, userId, type, content || null, mediaData || null, mediaMime, mediaDuration, replyToId).run();

  await c.env.DB.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").bind(chatId).run();

  const peerId = chat.user_a === userId ? chat.user_b : chat.user_a;
  const preview = type === 'text' ? (content || '').slice(0, 80) : type === 'image' ? '📷 Photo' : type === 'voice' ? '🎤 Voice message' : '📎 File';
  const sender = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first();
  await createNotification(c.env.DB, peerId, {
    type: 'chat',
    title: `New message from ${sender?.name || 'someone'}`,
    body: preview || 'New message',
    link_view: 'chats',
    ref_id: chatId,
  });

  const row = await c.env.DB.prepare(
    `${MESSAGE_SELECT} WHERE m.id = ?`
  ).bind(id).first();

  await touchPresence(c.env.DB, userId);

  return c.json({ success: true, data: serializeMessage(row), message: 'Message sent' }, 201);
});

// POST /api/chats/:id/read — mark all peer messages as read
chatRoutes.post('/:id/read', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('id');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(chatId).first();
  if (!chat) return c.json({ success: false, error: 'Chat not found' }, 404);
  if (chat.user_a !== userId && chat.user_b !== userId) {
    return c.json({ success: false, error: 'You are not part of this chat' }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE messages SET read_at = datetime('now')
     WHERE chat_id = ? AND sender_id != ? AND read_at IS NULL`
  ).bind(chatId, userId).run();

  return c.json({ success: true, message: 'Chat marked as read' });
});

// POST /api/messages/:id/pin — pin a message (both participants can pin)
chatRoutes.post('/:chatId/messages/:messageId/pin', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('chatId');
  const messageId = c.req.param('messageId');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(chatId).first();
  if (!chat) return c.json({ success: false, error: 'Chat not found' }, 404);
  if (chat.user_a !== userId && chat.user_b !== userId) {
    return c.json({ success: false, error: 'You are not part of this chat' }, 403);
  }
  await c.env.DB.prepare(
    "UPDATE messages SET is_pinned = 1 WHERE id = ? AND chat_id = ?"
  ).bind(messageId, chatId).run();
  return c.json({ success: true, message: 'Message pinned' });
});

// POST /api/messages/:id/unpin — unpin a message
chatRoutes.post('/:chatId/messages/:messageId/unpin', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('chatId');
  const messageId = c.req.param('messageId');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const chat = await c.env.DB.prepare('SELECT * FROM chats WHERE id = ?').bind(chatId).first();
  if (!chat) return c.json({ success: false, error: 'Chat not found' }, 404);
  if (chat.user_a !== userId && chat.user_b !== userId) {
    return c.json({ success: false, error: 'You are not part of this chat' }, 403);
  }
  await c.env.DB.prepare(
    "UPDATE messages SET is_pinned = 0 WHERE id = ? AND chat_id = ?"
  ).bind(messageId, chatId).run();
  return c.json({ success: true, message: 'Message unpinned' });
});

// POST /api/messages/:id/edit — edit an own text message
chatRoutes.post('/:chatId/messages/:messageId/edit', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('chatId');
  const messageId = c.req.param('messageId');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const body = await c.req.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return c.json({ success: false, error: 'Message cannot be empty' }, 400);
  if (content.length > 4000) return c.json({ success: false, error: 'Message is too long' }, 400);

  const msg = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE id = ? AND chat_id = ?'
  ).bind(messageId, chatId).first();
  if (!msg) return c.json({ success: false, error: 'Message not found' }, 404);
  if (msg.sender_id !== userId) return c.json({ success: false, error: 'You can only edit your own messages' }, 403);
  if (msg.type !== 'text') return c.json({ success: false, error: 'Only text messages can be edited' }, 400);

  await c.env.DB.prepare(
    "UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?"
  ).bind(content, messageId).run();

  const row = await c.env.DB.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).bind(messageId).first();
  return c.json({ success: true, data: serializeMessage(row), message: 'Message updated' });
});

// DELETE /api/messages/:id — delete an own message (hard delete for everyone)
chatRoutes.delete('/:chatId/messages/:messageId', async (c) => {
  const userId = c.req.header('X-User-Id') || '';
  const chatId = c.req.param('chatId');
  const messageId = c.req.param('messageId');
  if (!userId) return c.json({ success: false, error: 'Not authenticated' }, 401);

  const msg = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE id = ? AND chat_id = ?'
  ).bind(messageId, chatId).first();
  if (!msg) return c.json({ success: false, error: 'Message not found' }, 404);
  if (msg.sender_id !== userId) return c.json({ success: false, error: 'You can only delete your own messages' }, 403);

  // Detach replies pointing at this message first, then delete.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE messages SET reply_to_id = NULL WHERE reply_to_id = ?').bind(messageId),
    c.env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(messageId),
  ]);

  return c.json({ success: true, message: 'Message deleted' });
});

export { chatRoutes, presenceRoutes };
