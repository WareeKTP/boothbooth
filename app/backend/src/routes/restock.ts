/**
 * Restock routes (backend-final.md §3.8).
 *   POST /api/restock-requests              (staff; booth from session)
 *   GET  /api/restock-requests              (owner: all; staff: own booth)
 *   POST /api/restock-requests/:id/fulfill  (owner only; warehouse->booth transfer)
 */
import type { FastifyInstance } from 'fastify';
import { withTransaction } from '../db/pool.js';
import {
  createRestockRequest,
  fulfillRestockRequest,
  listRestockRequests,
} from '../domain/restock.js';
import { getAccount, getStaffBoothId, requireAuth, requireOwner, requireStaff } from '../plugins/auth.js';

const createSchema = {
  body: {
    type: 'object',
    required: ['productId', 'requestedQty'],
    additionalProperties: false,
    properties: {
      productId: { type: 'string', format: 'uuid' },
      requestedQty: { type: 'integer', minimum: 1 },
    },
  },
} as const;

const fulfillSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['qty'],
    additionalProperties: false,
    properties: { qty: { type: 'integer', minimum: 1 } },
  },
} as const;

export async function registerRestockRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { productId: string; requestedQty: number } }>(
    '/restock-requests',
    { schema: createSchema, preHandler: [requireAuth, requireStaff] },
    async (req, reply) => {
      const acct = getAccount(req);
      const boothId = getStaffBoothId(req);
      const data = await createRestockRequest({
        expoId: acct.expoId,
        boothId,
        accountId: acct.id,
        productId: req.body.productId,
        requestedQty: req.body.requestedQty,
      });
      reply.status(201).send({ data });
    },
  );

  app.get('/restock-requests', { preHandler: requireAuth }, async (req, reply) => {
    const acct = getAccount(req);
    // Owner sees all booths; staff scoped to own booth.
    const boothId = acct.role === 'staff' ? acct.boothId : null;
    const data = await listRestockRequests(acct.expoId, boothId);
    reply.send({ data });
  });

  app.post<{ Params: { id: string }; Body: { qty: number } }>(
    '/restock-requests/:id/fulfill',
    { schema: fulfillSchema, preHandler: [requireAuth, requireOwner] },
    async (req, reply) => {
      const acct = getAccount(req);
      const data = await withTransaction((client) =>
        fulfillRestockRequest(client, {
          expoId: acct.expoId,
          resolverAccountId: acct.id,
          requestId: req.params.id,
          qty: req.body.qty,
        }),
      );
      reply.status(200).send({ data });
    },
  );
}
