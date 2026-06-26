/**
 * Auth + authz preHandlers (backend-final.md §4.1, §4.2, §3 preamble).
 *
 * - `requireAuth`: validates the session cookie, loads the account context onto
 *   request.account, slides session expiry. 401 if missing/expired.
 * - `requireOwner` / `requireStaff`: role gates (403 on mismatch).
 *
 * Staff booth scoping is enforced by handlers reading request.account.boothId —
 * NEVER a client-supplied booth id (backend-final.md §3 preamble, §4.4).
 */
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { query } from '../db/pool.js';
import { Errors } from '../lib/errors.js';
import { resolveSession, SESSION_COOKIE_NAME } from '../lib/session.js';
import type { AuthAccount, Role } from '../types.js';

async function loadAccount(accountId: string, sessionToken: string): Promise<AuthAccount | null> {
  const res = await query<{ id: string; expo_id: string; role: Role; booth_id: string | null }>(
    'SELECT id, expo_id, role, booth_id FROM accounts WHERE id = $1 AND is_active = true',
    [accountId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    expoId: row.expo_id,
    role: row.role,
    boothId: row.booth_id,
    sessionToken,
  };
}

export const requireAuth: preHandlerHookHandler = async (req: FastifyRequest, _reply: FastifyReply) => {
  const raw = req.cookies?.[SESSION_COOKIE_NAME];
  if (!raw) throw Errors.unauthorized();

  // Cookie was set with { signed: true } — unsign to recover the opaque token.
  // A tampered/invalid signature yields valid:false; reject it.
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value === null) throw Errors.unauthorized();
  const token = unsigned.value;

  const session = await resolveSession(token);
  if (!session) throw Errors.unauthorized('Session expired');

  const account = await loadAccount(session.accountId, token);
  if (!account) throw Errors.unauthorized();

  req.account = account;
};

function requireRole(role: Role): preHandlerHookHandler {
  return async (req: FastifyRequest) => {
    // requireAuth must run first; guard defensively anyway.
    if (!req.account) throw Errors.unauthorized();
    if (req.account.role !== role) {
      throw Errors.forbidden(`This action requires the ${role} role`);
    }
  };
}

export const requireOwner = requireRole('owner');
export const requireStaff = requireRole('staff');

/** Convenience: assert and narrow the account on a request inside a handler. */
export function getAccount(req: FastifyRequest): AuthAccount {
  if (!req.account) throw Errors.unauthorized();
  return req.account;
}

/** Assert the staff account is bound to a booth and return it. */
export function getStaffBoothId(req: FastifyRequest): string {
  const acct = getAccount(req);
  if (acct.role !== 'staff' || !acct.boothId) {
    throw Errors.forbidden('Staff booth scope required');
  }
  return acct.boothId;
}
