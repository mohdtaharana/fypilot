// Session cookie helpers.
//
// The API is normally called with X-User-Id / X-User-Role headers, but plain browser
// navigations (window.open downloads, direct links) cannot set headers. Login therefore
// also issues an opaque session token stored in D1 and sent as an HttpOnly cookie, so
// those requests can be authenticated and authorised server-side.

const SESSION_COOKIE = 'fy_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface MinimalD1 {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

let sessionTableChecked = false;

async function ensureSessionTable(db: MinimalD1): Promise<void> {
  if (sessionTableChecked) return;
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS user_sessions (
         token TEXT PRIMARY KEY,
         user_id TEXT NOT NULL,
         role TEXT NOT NULL,
         expires_at TEXT NOT NULL,
         created_at TEXT DEFAULT (datetime('now'))
       )`
    ).run();
    sessionTableChecked = true;
  } catch {
    // Table stays unavailable; session lookups simply fail closed.
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function readSessionToken(cookieHeader: string | null | undefined): string | null {
  return parseCookies(cookieHeader)[SESSION_COOKIE] || null;
}

export function sessionCookie(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function createSession(db: MinimalD1, userId: string, role: string): Promise<string> {
  await ensureSessionTable(db);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  try {
    await db.prepare(`DELETE FROM user_sessions WHERE expires_at < datetime('now')`).run();
  } catch {
    // Housekeeping only; failure must not block login.
  }
  await db.prepare(
    `INSERT INTO user_sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(token, userId, role, expiresAt).run();
  return token;
}

export async function destroySession(db: MinimalD1, token: string | null): Promise<void> {
  if (!token) return;
  await db.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
}

// Resolves the caller from the session cookie, re-checking the role against the users
// table so a role change (or a deleted user) takes effect immediately.
export async function resolveSessionRole(
  db: MinimalD1,
  cookieHeader: string | null | undefined
): Promise<{ userId: string; role: string } | null> {
  const token = readSessionToken(cookieHeader);
  if (!token) return null;

  await ensureSessionTable(db);

  let session: { user_id: string; role: string; expires_at: string; current_role: string; status: string } | null = null;
  try {
    session = await db.prepare(
      `SELECT s.user_id, s.role, s.expires_at, u.role as current_role, u.status
       FROM user_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    ).bind(token).first<{ user_id: string; role: string; expires_at: string; current_role: string; status: string }>();
  } catch {
    return null;
  }

  if (!session) return null;
  if (session.status === 'rejected' || session.status === 'pending') return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await destroySession(db, token);
    return null;
  }

  return { userId: session.user_id, role: session.current_role || session.role };
}
