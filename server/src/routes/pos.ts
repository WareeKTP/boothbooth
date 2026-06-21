/**
 * POS routes (backend-final.md §3.6).
 *   GET  /api/pos/catalog   (staff; own booth)
 *   POST /api/sales         (staff; Idempotency-Key required; booth from session)
 */
import type { FastifyInstance } from 'fastify';
import { withTransaction } from '../db/pool.js';
import { executeCheckout, getPosCatalog } from '../domain/pos.js';
import {
  findStoredResponse,
  isUniqueViolation,
  requireIdempotencyKey,
  storeResponse,
} from '../lib/idempotency.js';
import { getAccount, getStaffBoothId, requireAuth, requireStaff } from '../plugins/auth.js';

const ENDPOINT = 'POST /api/sales';

const checkoutSchema = {
  body: {
    type: 'object',
    required: ['items'],
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 200,
        items: {
          type: 'object',
          required: ['productId', 'qty'],
          additionalProperties: false,
          properties: {
            productId: { type: 'string', format: 'uuid' },
            qty: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
} as const;

export async function registerPosRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pos/catalog', { preHandler: [requireAuth, requireStaff] }, async (req, reply) => {
    const boothId = getStaffBoothId(req);
    const data = await getPosCatalog(boothId);
    reply.send({ data });
  });

  app.post<{ Body: { items: Array<{ productId: string; qty: number }> } }>(
    '/sales',
    { schema: checkoutSchema, preHandler: [requireAuth, requireStaff] },
    async (req, reply) => {
      const acct = getAccount(req);
      const boothId = getStaffBoothId(req); // booth from SESSION, never the body
      const key = requireIdempotencyKey(req.headers as Record<string, unknown>);

      const result = await withTransaction(async (client) => {
        const stored = await findStoredResponse(client, key, ENDPOINT, acct.id);
        if (stored) return stored;

        const sale = await executeCheckout(client, {
          expoId: acct.expoId,
          boothId,
          accountId: acct.id,
          items: req.body.items,
        });

        try {
          await storeResponse(client, key, ENDPOINT, acct.id, 201, sale);
        } catch (err) {
          if (isUniqueViolation(err)) {
            const winner = await findStoredResponse(client, key, ENDPOINT, acct.id);
            if (winner) return winner;
          }
          throw err;
        }
        return { status: 201, snapshot: sale };
      });

      reply.status(result.status).send({ data: result.snapshot });
    },
  );
}
