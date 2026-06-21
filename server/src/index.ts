/**
 * Server entrypoint. Boots the Fastify app and binds the port. Compiled to
 * dist/index.js — infra's api service runs `node dist/index.js` (npm start).
 */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool } from './db/pool.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal boot error:', err);
  process.exit(1);
});
