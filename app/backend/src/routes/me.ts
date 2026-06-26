/**
 * "Me" routes — staff booth/daily-log + account settings for both roles.
 * backend-final.md §3.7, §3.9, §3.10.
 *
 *   GET   /api/me/booth       (staff; own booth — same shape as booth detail)
 *   GET   /api/me/daily-log   (staff; today only)
 *   PATCH /api/me/profile     (both)
 *   PATCH /api/me/password    (both; invalidates other sessions)
 *   PATCH /api/me/prefs       (both)
 */
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config.js';
import { getBoothDetail } from '../domain/booths.js';
import { getAccountDTO } from '../domain/accounts.js';
import { query, withTransaction } from '../db/pool.js';
import { Errors } from '../lib/errors.js';
import { hashPassword, isStrongEnough, verifyPassword } from '../lib/password.js';
import { destroyOtherSessions } from '../lib/session.js';
import { todayWindow } from '../lib/time.js';
import { getAccount, getStaffBoothId, requireAuth, requireStaff } from '../plugins/auth.js';

const profileSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 200 },
      email: { type: 'string', format: 'email', maxLength: 320 },
      phone: { type: 'string', maxLength: 40 },
    },
  },
} as const;

const passwordSchema = {
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    additionalProperties: false,
    properties: {
      currentPassword: { type: 'string', minLength: 1, maxLength: 1024 },
      newPassword: { type: 'string', minLength: 1, maxLength: 1024 },
    },
  },
} as const;

const prefsSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      notifyLowStock: { type: 'boolean' },
      notifyDailySummary: { type: 'boolean' },
    },
  },
} as const;

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  // ── Staff: my booth (same shape as GET /api/booths/:boothId) ───────────────
  app.get('/me/booth', { preHandler: [requireAuth, requireStaff] }, async (req, reply) => {
    const acct = getAccount(req);
    const boothId = getStaffBoothId(req);
    const detail = await getBoothDetail(boothId, undefined, acct.expoId);
    if (!detail) throw Errors.notFound('Booth not found');
    reply.send({ data: detail });
  });

  // ── Staff: daily log (today only) ──────────────────────────────────────────
  app.get('/me/daily-log', { preHandler: [requireAuth, requireStaff] }, async (req, reply) => {
    const acct = getAccount(req);
    const boothId = getStaffBoothId(req);
    const cfg = loadConfig();
    const { startUtc, endUtc } = todayWindow(cfg.expoTz);
    const detail = await getBoothDetail(boothId, { startUtc, endUtc }, acct.expoId);
    if (!detail) throw Errors.notFound('Booth not found');
    // Daily log DTO is the booth-detail minus booth/inventory.
    reply.send({
      data: {
        summary: detail.summary,
        productBreakdown: detail.productBreakdown,
        transactions: detail.transactions,
      },
    });
  });

  // ── Profile ────────────────────────────────────────────────────────────────
  app.patch<{ Body: { fullName?: string; email?: string; phone?: string } }>(
    '/me/profile',
    { schema: profileSchema, preHandler: requireAuth },
    async (req, reply) => {
      const acct = getAccount(req);
      const { fullName, email, phone } = req.body;

      // Build a dynamic SET clause for only the provided fields.
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (fullName !== undefined) { sets.push(`full_name = $${i++}`); params.push(fullName); }
      if (email !== undefined) { sets.push(`email = $${i++}`); params.push(email); }
      if (phone !== undefined) { sets.push(`phone = $${i++}`); params.push(phone); }
      params.push(acct.id);

      try {
        await query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${i}`, params);
      } catch (err) {
        // unique (expo_id, email) violation -> 409 email_taken.
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          throw Errors.emailTaken();
        }
        throw err;
      }

      const account = await getAccountDTO(acct.id);
      reply.send({ data: account });
    },
  );

  // ── Password ───────────────────────────────────────────────────────────────
  app.patch<{ Body: { currentPassword: string; newPassword: string } }>(
    '/me/password',
    { schema: passwordSchema, preHandler: requireAuth },
    async (req, reply) => {
      const acct = getAccount(req);
      const { currentPassword, newPassword } = req.body;

      const res = await query<{ password_hash: string }>(
        'SELECT password_hash FROM accounts WHERE id = $1',
        [acct.id],
      );
      const row = res.rows[0];
      if (!row) throw Errors.unauthorized();

      const ok = await verifyPassword(row.password_hash, currentPassword);
      if (!ok) throw Errors.wrongCurrentPassword();

      if (!isStrongEnough(newPassword)) throw Errors.weakPassword('Password must be at least 8 characters');

      const newHash = await hashPassword(newPassword);
      await withTransaction(async (client) => {
        await client.query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [newHash, acct.id]);
        // Invalidate all OTHER sessions; keep the current one.
        await destroyOtherSessions(acct.id, acct.sessionToken, client);
      });

      reply.status(204).send();
    },
  );

  // ── Prefs (two booleans) ───────────────────────────────────────────────────
  app.patch<{ Body: { notifyLowStock?: boolean; notifyDailySummary?: boolean } }>(
    '/me/prefs',
    { schema: prefsSchema, preHandler: requireAuth },
    async (req, reply) => {
      const acct = getAccount(req);
      const { notifyLowStock, notifyDailySummary } = req.body;

      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (notifyLowStock !== undefined) { sets.push(`notify_low_stock = $${i++}`); params.push(notifyLowStock); }
      if (notifyDailySummary !== undefined) { sets.push(`notify_daily_summary = $${i++}`); params.push(notifyDailySummary); }
      params.push(acct.id);

      const res = await query<{ notify_low_stock: boolean; notify_daily_summary: boolean }>(
        `UPDATE accounts SET ${sets.join(', ')} WHERE id = $${i}
         RETURNING notify_low_stock, notify_daily_summary`,
        params,
      );
      const row = res.rows[0]!;
      reply.send({
        data: {
          prefs: {
            notifyLowStock: row.notify_low_stock,
            notifyDailySummary: row.notify_daily_summary,
          },
        },
      });
    },
  );
}
