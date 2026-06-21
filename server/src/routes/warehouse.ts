/**
 * Warehouse routes (backend-final.md §3.5).
 *   GET  /api/warehouse           (owner + staff; staff read-only)
 *   POST /api/warehouse/receive   (owner only; Idempotency-Key required)
 */
import type { FastifyInstance } from 'fastify';
import { withTransaction } from '../db/pool.js';
import { getWarehouse } from '../domain/warehouse.js';
import { Errors } from '../lib/errors.js';
import {
  findStoredResponse,
  isUniqueViolation,
  requireIdempotencyKey,
  storeResponse,
} from '../lib/idempotency.js';
import { getAccount, requireAuth, requireOwner } from '../plugins/auth.js';

const ENDPOINT = 'POST /api/warehouse/receive';

const receiveSchema = {
  body: {
    type: 'object',
    required: ['productId', 'units'],
    additionalProperties: false,
    properties: {
      productId: { type: 'string', format: 'uuid' },
      units: { type: 'integer', minimum: 1 },
    },
  },
} as const;

export async function registerWarehouseRoutes(app: FastifyInstance): Promise<void> {
  // Both roles can read the warehouse list.
  app.get('/warehouse', { preHandler: requireAuth }, async (req, reply) => {
    const acct = getAccount(req);
    const data = await getWarehouse(acct.expoId);
    reply.send({ data });
  });

  app.post<{ Body: { productId: string; units: number } }>(
    '/warehouse/receive',
    { schema: receiveSchema, preHandler: [requireAuth, requireOwner] },
    async (req, reply) => {
      const acct = getAccount(req);
      const key = requireIdempotencyKey(req.headers as Record<string, unknown>);
      const { productId, units } = req.body;

      const result = await withTransaction(async (client) => {
        // Replay if this key was already used by this account.
        const stored = await findStoredResponse(client, key, ENDPOINT, acct.id);
        if (stored) return stored;

        // Lock the product row, verify it belongs to the caller's expo, add units.
        const prodRes = await client.query<{ id: string; warehouse_qty: number }>(
          `SELECT id, warehouse_qty FROM products
           WHERE id = $1 AND expo_id = $2 AND is_active = true FOR UPDATE`,
          [productId, acct.expoId],
        );
        const prod = prodRes.rows[0];
        if (!prod) {
          throw Errors.validation('Unknown product', { productId });
        }

        const updated = await client.query<{ warehouse_qty: number }>(
          'UPDATE products SET warehouse_qty = warehouse_qty + $1 WHERE id = $2 RETURNING warehouse_qty',
          [units, productId],
        );
        const snapshot = { productId, warehouseQty: updated.rows[0]!.warehouse_qty };

        try {
          await storeResponse(client, key, ENDPOINT, acct.id, 200, snapshot);
        } catch (err) {
          if (isUniqueViolation(err)) {
            // Concurrent retry won the race; replay theirs.
            const winner = await findStoredResponse(client, key, ENDPOINT, acct.id);
            if (winner) return winner;
          }
          throw err;
        }
        return { status: 200, snapshot };
      });

      reply.status(result.status).send({ data: result.snapshot });
    },
  );
}
