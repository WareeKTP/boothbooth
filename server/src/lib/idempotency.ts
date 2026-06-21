/**
 * Idempotency mechanism (backend-final.md §4.3). Header `Idempotency-Key` (UUID)
 * is REQUIRED on POST /api/sales and POST /api/warehouse/receive.
 *
 * Flow (inside the money-moving transaction):
 *   1. Look up (key, endpoint). If found -> replay stored status + snapshot.
 *   2. Otherwise do the work, INSERT the snapshot under PRIMARY KEY (key,endpoint),
 *      and if a concurrent request won the race (unique violation), re-read and
 *      replay theirs.
 * Keyed per account so one account's key can't replay another's response.
 */
import type pg from 'pg';
import { Errors } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate and return the Idempotency-Key header, or throw 422. */
export function requireIdempotencyKey(headers: Record<string, unknown>): string {
  const raw = headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw Errors.validation('Missing or invalid Idempotency-Key header (must be a UUID)', {
      header: 'Idempotency-Key',
    });
  }
  return value.toLowerCase();
}

export interface StoredResponse {
  status: number;
  snapshot: unknown;
}

/** Returns a stored response for (key, endpoint) if one exists. */
export async function findStoredResponse(
  client: pg.PoolClient,
  key: string,
  endpoint: string,
  accountId: string,
): Promise<StoredResponse | null> {
  const res = await client.query<{ response_status: number; response_snapshot: unknown; account_id: string }>(
    'SELECT response_status, response_snapshot, account_id FROM idempotency_keys WHERE key = $1 AND endpoint = $2',
    [key, endpoint],
  );
  const row = res.rows[0];
  if (!row) return null;
  // Scope to the account: a key replays only for the account that created it.
  if (row.account_id !== accountId) {
    throw Errors.validation('Idempotency-Key already used by a different account', {
      header: 'Idempotency-Key',
    });
  }
  return { status: row.response_status, snapshot: row.response_snapshot };
}

/**
 * Persist the response snapshot. Throws the underlying pg error on unique
 * conflict so the caller can decide to re-read (race) — callers generally check
 * findStoredResponse first, making a conflict here a rare concurrent-retry case.
 */
export async function storeResponse(
  client: pg.PoolClient,
  key: string,
  endpoint: string,
  accountId: string,
  status: number,
  snapshot: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO idempotency_keys (key, endpoint, account_id, response_status, response_snapshot)
     VALUES ($1, $2, $3, $4, $5)`,
    [key, endpoint, accountId, status, JSON.stringify(snapshot)],
  );
}

/** True if the error is a Postgres unique-violation (idempotency race). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
