/**
 * Thin `pg` Pool wrapper — no ORM (backend-final.md §1). The api process runs as
 * the least-privilege bb_app runtime role (DATABASE_URL). max ~10 per §5.
 */
import pg from 'pg';
import { loadConfig } from '../config.js';

const { Pool } = pg;

// Postgres returns BIGINT (int8, oid 20) as a string to avoid JS precision loss.
// sale_sequences.next_seq is BIGINT but always well within Number.MAX_SAFE_INTEGER
// at this scale, so parse it to a JS number for ergonomic use.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const cfg = loadConfig();
    pool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
  }
  return pool;
}

/** Convenience query against the shared pool. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

/**
 * Run `fn` inside a single transaction with BEGIN/COMMIT/ROLLBACK. The callback
 * receives a dedicated client so multiple statements share the same connection
 * (required for FOR UPDATE row locks to be meaningful across statements).
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure; original error is what matters */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
