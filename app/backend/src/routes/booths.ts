/**
 * Booth routes (backend-final.md §3.4).
 *   GET /api/booths            (owner)
 *   GET /api/booths/:boothId   (owner any booth; staff only own booth -> else 403)
 */
import type { FastifyInstance } from 'fastify';
import { getBoothDetail, getBoothList } from '../domain/booths.js';
import { Errors } from '../lib/errors.js';
import { getAccount, requireAuth, requireOwner } from '../plugins/auth.js';

const boothIdParams = {
  params: {
    type: 'object',
    required: ['boothId'],
    additionalProperties: false,
    properties: { boothId: { type: 'string', format: 'uuid' } },
  },
} as const;

export async function registerBoothRoutes(app: FastifyInstance): Promise<void> {
  app.get('/booths', { preHandler: [requireAuth, requireOwner] }, async (req, reply) => {
    const acct = getAccount(req);
    const data = await getBoothList(acct.expoId);
    reply.send({ data });
  });

  app.get<{ Params: { boothId: string } }>(
    '/booths/:boothId',
    { schema: boothIdParams, preHandler: requireAuth },
    async (req, reply) => {
      const acct = getAccount(req);
      const { boothId } = req.params;

      // Authz: owner may view any booth in their expo; staff only their own.
      if (acct.role === 'staff' && acct.boothId !== boothId) {
        throw Errors.forbidden('Staff may only view their own booth');
      }

      // Scope to the caller's expo (cross-expo defense in depth).
      const detail = await getBoothDetail(boothId, undefined, acct.expoId);
      if (!detail) throw Errors.notFound('Booth not found');

      reply.send({ data: detail });
    },
  );
}
