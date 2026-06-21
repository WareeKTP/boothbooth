/**
 * Server-side session helpers (backend-final.md §4.1).
 *
 * - Cookie carries an opaque 256-bit random token; we store only its SHA-256 in
 *   sessions.token_hash. A DB leak yields no live sessions.
 * - ~12h expiry (one expo day) with sliding renewal on each authenticated use.
 */
import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { query } from '../db/pool.js';

export const SESSION_COOKIE_NAME = 'bb_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function generateToken(): string {
  return randomBytes(32).toString('base64url'); // 256-bit opaque token
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionRecord {
  accountId: string;
  expiresAt: Date;
}

/** Create a fresh session row for an account, returning the raw cookie token. */
export async function createSession(accountId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (account_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [accountId, tokenHash, expiresAt],
  );
  return token;
}

/**
 * Look up a live session by raw token. Returns null if missing/expired. On a hit
 * past the halfway mark, slide the expiry forward (cheap renewal).
 */
export async function resolveSession(token: string): Promise<SessionRecord | null> {
  const tokenHash = hashToken(token);
  const res = await query<{ id: string; account_id: string; expires_at: Date }>(
    'SELECT id, account_id, expires_at FROM sessions WHERE token_hash = $1',
    [tokenHash],
  );
  const row = res.rows[0];
  if (!row) return null;

  const now = Date.now();
  if (row.expires_at.getTime() <= now) {
    // Expired — clean it up opportunistically.
    await query('DELETE FROM sessions WHERE id = $1', [row.id]);
    return null;
  }

  // Sliding renewal: if more than half the TTL has elapsed, extend.
  const newExpiry = new Date(now + SESSION_TTL_MS);
  if (row.expires_at.getTime() - now < SESSION_TTL_MS / 2) {
    await query('UPDATE sessions SET expires_at = $1 WHERE id = $2', [newExpiry, row.id]);
  }

  return { accountId: row.account_id, expiresAt: newExpiry };
}

/** Delete the session for a raw token (logout). */
export async function destroySession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/**
 * Invalidate all sessions for an account EXCEPT the one with `keepTokenHash`.
 * Used after a password change (§3.10). Runs on the given client if inside a txn.
 */
export async function destroyOtherSessions(
  accountId: string,
  keepToken: string,
  client?: pg.PoolClient,
): Promise<void> {
  const sql =
    'DELETE FROM sessions WHERE account_id = $1 AND token_hash <> $2';
  const params = [accountId, hashToken(keepToken)];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}
