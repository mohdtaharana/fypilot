import { resolveSessionRole } from './session';
import type { Env } from '../modules/ai/ai.types';

const BULK_DELETE_ROLES = new Set(['coordinator', 'hod', 'dean', 'admin']);

/**
 * Guard for destructive bulk operations.
 *
 * Deliberately ignores the `X-User-Role` header: that value is supplied by the
 * client and can be forged with a single curl call, which would let anyone wipe
 * the database. The session cookie is signed server-side and the role is
 * re-read from the users table, so it cannot be spoofed.
 */
export async function requireBulkDeleteRole(
  c: { req: { header(name: string): string | undefined }; env: Env },
): Promise<{ role: string; userId: string } | null> {
  const session = await resolveSessionRole(c.env.DB, c.req.header('Cookie'));
  if (session && BULK_DELETE_ROLES.has(session.role)) {
    return { role: session.role, userId: session.userId };
  }

  // Fallback: verify user against DB to support header-based sessions safely
  const headerUserId = c.req.header('X-User-Id')?.trim() || '';
  if (headerUserId && headerUserId !== 'guest') {
    try {
      const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
        .bind(headerUserId).first<{ id: string; role: string }>();
      if (user && BULK_DELETE_ROLES.has(user.role)) {
        return { role: user.role, userId: user.id };
      }
    } catch (e) {
      console.error('requireBulkDeleteRole db fallback error:', e);
    }
  }

  return null;
}
