/**
 * Migration runner (infra-final.md §2.1). Plain numbered SQL files, no framework.
 *
 * - Connects as the DDL role (DATABASE_URL_MIGRATE).
 * - Takes a Postgres advisory lock around the apply loop so concurrent migrate
 *   runs (e.g. two api replicas) can't race — cheap permanent correctness.
 * - Tracks applied versions in `schema_migrations` so re-runs are no-ops.
 * - Applies each pending file in its own transaction, in filename order.
 *
 * Run via `npm run migrate` (compiled) or `npm run migrate:dev` (tsx).
 */
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Client } = pg;

// Lock key: any stable arbitrary 64-bit int. Same value every run => same lock.
const ADVISORY_LOCK_KEY = 4023985711;

const __dirname = dirname(fileURLToPath(import.meta.url));
// At runtime this resolves to <pkg>/dist/db; migrations live at <pkg>/db/migrations.
// __dirname/../../db/migrations works from both dist/db and src/db.
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'db', 'migrations');

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_MIGRATE;
  if (!connectionString) {
    throw new Error('Missing required env var: DATABASE_URL_MIGRATE');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    try {
      const applied = new Set(
        (await client.query<{ version: string }>('SELECT version FROM schema_migrations'))
          .rows.map((r) => r.version),
      );

      const files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      let count = 0;
      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`[migrate] applied ${file}`);
          count++;
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`[migrate] failed on ${file}: ${(err as Error).message}`);
        }
      }
      console.log(count === 0 ? '[migrate] up to date, nothing to apply' : `[migrate] done, ${count} applied`);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
