/**
 * Auth routes (backend-final.md §3.2, §4.1, §4.5).
 *   POST /api/auth/login   (rate-limited; generic 401; fresh single-account session)
 *   POST /api/auth/logout  (204; deletes session row + clears cookie)
 *   GET  /api/auth/me      (bootstraps the SPA)
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { loadConfig } from '../config.js';
import { getAccountDTO } from '../domain/accounts.js';
import { query } from '../db/pool.js';
import { Errors } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import {
  createSession,
  destroySession,
  SESSION_COOKIE_NAME,
} from '../lib/session.js';
import { requireAuth, getAccount } from '../plugins/auth.js';

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', maxLength: 320 },
      password: { type: 'string', minLength: 1, maxLength: 1024 },
    },
  },
} as const;

function setSessionCookie(reply: FastifyReply, token: string): void {
  const cfg = loadConfig();
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'strict',
    path: '/',
    signed: true,
    maxAge: 12 * 60 * 60, // 12h, matches session TTL
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  const cfg = loadConfig();
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'strict',
    path: '/',
    signed: true,
  });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    {
      schema: loginSchema,
      // Tighter per-IP limit on login to blunt credential stuffing (§4.5).
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;

      const res = await query<{ id: string; password_hash: string }>(
        'SELECT id, password_hash FROM accounts WHERE email = $1 AND is_active = true',
        [email],
      );
      const row = res.rows[0];

      // Generic failure — no user enumeration. Always run a verify to keep timing
      // roughly constant even when the account doesn't exist.
      const dummyHash =
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$3+0p3wYwYwYwYwYwYwYwYwYwYwYwYwYwYwYwYwYwYwY';
      const ok = await verifyPassword(row?.password_hash ?? dummyHash, password);
      if (!row || !ok) {
        throw Errors.invalidCredentials();
      }

      // Fresh single-account session: replace any prior session for this account.
      await query('DELETE FROM sessions WHERE account_id = $1', [row.id]);
      const token = await createSession(row.id);
      setSessionCookie(reply, token);

      const account = await getAccountDTO(row.id);
      reply.status(200).send({ data: { account } });
    },
  );

  app.post('/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    const acct = getAccount(req);
    await destroySession(acct.sessionToken);
    clearSessionCookie(reply);
    reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const acct = getAccount(req);
    const account = await getAccountDTO(acct.id);
    if (!account) throw Errors.unauthorized();
    reply.status(200).send({ data: { account } });
  });
}
