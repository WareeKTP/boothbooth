/**
 * Dashboard recent-sales feed (backend-final.md §3.11).
 *   GET /api/sales/recent?limit=10   (owner) — cross-booth, most-recent-first.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { getAccount, requireAuth, requireOwner } from '../plugins/auth.js';

const recentSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // Clamped to [1,50] in the handler; default 10.
      limit: { type: 'integer', minimum: 1, maximum: 50 },
    },
  },
} as const;

export async function registerSalesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: number } }>(
    '/sales/recent',
    { schema: recentSchema, preHandler: [requireAuth, requireOwner] },
    async (req, reply) => {
      const acct = getAccount(req);
      const limit = Math.min(50, Math.max(1, req.query.limit ?? 10));

      const res = await query<{
        id: string;
        display_id: string;
        booth_id: string;
        booth_code: string;
        units: string | number;
        total_minor: number;
        sold_at: Date;
      }>(
        `SELECT s.id, s.display_id, s.booth_id, b.code AS booth_code,
                COALESCE((SELECT SUM(si.qty) FROM sale_items si WHERE si.sale_id = s.id),0) AS units,
                s.total_minor, s.sold_at
         FROM sales s JOIN booths b ON b.id = s.booth_id
         WHERE s.expo_id = $1
         ORDER BY s.sold_at DESC
         LIMIT $2`,
        [acct.expoId, limit],
      );

      const data = res.rows.map((r) => ({
        id: r.id,
        displayId: r.display_id,
        boothId: r.booth_id,
        boothCode: r.booth_code,
        units: Number(r.units),
        totalMinor: r.total_minor,
        soldAt: r.sold_at.toISOString(),
      }));
      reply.send({ data });
    },
  );
}
