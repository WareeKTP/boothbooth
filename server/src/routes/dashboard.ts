/**
 * Owner dashboard route (backend-final.md §3.3). One call -> KPIs + chart +
 * sales-by-booth + top products + recent sales. Polled by the client ~10-15s.
 */
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config.js';
import { getDashboard } from '../domain/dashboard.js';
import { getAccount, requireAuth, requireOwner } from '../plugins/auth.js';

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', { preHandler: [requireAuth, requireOwner] }, async (req, reply) => {
    const acct = getAccount(req);
    const cfg = loadConfig();
    const data = await getDashboard(acct.expoId, cfg.expoTz);
    reply.send({ data });
  });
}
