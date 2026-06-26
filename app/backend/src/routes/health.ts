/**
 * GET /healthz (backend-final.md §3.1, infra-final.md §2.1 api healthcheck).
 * NOT under /api, no auth. 200 only after a successful `SELECT 1`; 503 otherwise.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_req, reply) => {
    try {
      await query('SELECT 1');
      reply.status(200).send({ status: 'ok' });
    } catch {
      reply.status(503).send({ status: 'degraded' });
    }
  });
}
