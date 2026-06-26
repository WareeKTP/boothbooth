/**
 * Fastify app factory. Wires plugins, the uniform error envelope, validation
 * error mapping, and every route group. Exported separately from index.ts so it
 * can be constructed without binding a port (useful for future tests).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config.js';
import { AppError } from './lib/errors.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerBoothRoutes } from './routes/booths.js';
import { registerWarehouseRoutes } from './routes/warehouse.js';
import { registerPosRoutes } from './routes/pos.js';
import { registerRestockRoutes } from './routes/restock.js';
import { registerMeRoutes } from './routes/me.js';
import { registerSalesRoutes } from './routes/sales.js';

export async function buildApp(): Promise<FastifyInstance> {
  const cfg = loadConfig();

  const app = Fastify({
    logger: {
      level: cfg.isProd ? 'info' : 'debug',
      // Never log cookies/auth headers — avoid leaking the session token / PII.
      redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["idempotency-key"]'],
    },
    // We supply our own uniform validation error shape below.
    ajv: { customOptions: { allErrors: true, removeAdditional: false } },
    bodyLimit: 1 * 1024 * 1024, // 1 MiB — carts are tiny JSON
    trustProxy: true, // behind nginx; honor X-Forwarded-* for Secure cookie logic
  });

  // Signed cookies via SESSION_COOKIE_SECRET (we store opaque token; signing adds
  // tamper-evidence). Cookie options set per-response in the auth routes.
  await app.register(cookie, { secret: cfg.sessionCookieSecret });

  // Global loose per-IP limit; the login route adds a tighter limit (§4.5).
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Uniform error envelope on 429.
    errorResponseBuilder: () => ({
      error: { code: 'rate_limited', message: 'Too many requests, slow down' },
    }),
  });

  // ── Uniform error envelope ────────────────────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    // Fastify schema validation failures -> 422 validation_error with details.
    if (err.validation) {
      reply.status(422).send({
        error: {
          code: 'validation_error',
          message: 'Request validation failed',
          details: err.validation.map((v) => ({
            path: v.instancePath || v.schemaPath,
            message: v.message,
          })),
        },
      });
      return;
    }

    if (err instanceof AppError) {
      reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      });
      return;
    }

    if (err.statusCode === 429) {
      // rate-limit plugin already shaped the body via errorResponseBuilder.
      reply.send(err);
      return;
    }

    // Unknown error: log with request id, return generic 500 (no stack/SQL leak).
    req.log.error({ err, reqId: req.id }, 'unhandled error');
    reply.status(500).send({
      error: { code: 'internal_error', message: 'An unexpected error occurred' },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: 'not_found', message: 'Route not found' } });
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await registerHealthRoutes(app);          // GET /healthz (no /api, no auth)
  await app.register(async (api) => {
    await registerAuthRoutes(api);
    await registerDashboardRoutes(api);
    await registerBoothRoutes(api);
    await registerWarehouseRoutes(api);
    await registerPosRoutes(api);
    await registerRestockRoutes(api);
    await registerMeRoutes(api);
    await registerSalesRoutes(api);
  }, { prefix: '/api' });

  return app;
}
