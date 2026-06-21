/**
 * Restock workflow (backend-final.md §3.8). Staff create requests; owner fulfills
 * them as a real warehouse->booth transfer (one txn, FOR UPDATE on the product
 * row, backstopped by CHECK (warehouse_qty >= 0)).
 */
import type pg from 'pg';
import { query } from '../db/pool.js';
import { Errors } from '../lib/errors.js';

export interface RestockRequestRow {
  id: string;
  boothCode: string;
  productName: string;
  requestedQty: number;
  status: 'pending' | 'fulfilled' | 'rejected';
  createdAt: string;
  resolvedQty: number | null;
  resolvedAt: string | null;
}

/** List requests. Owner: all booths in expo. Staff: own booth only. */
export async function listRestockRequests(
  expoId: string,
  boothId: string | null,
): Promise<RestockRequestRow[]> {
  const params: unknown[] = [expoId];
  let boothFilter = '';
  if (boothId) {
    params.push(boothId);
    boothFilter = ' AND rr.booth_id = $2';
  }
  const res = await query<{
    id: string;
    booth_code: string;
    product_name: string;
    requested_qty: number;
    status: 'pending' | 'fulfilled' | 'rejected';
    created_at: Date;
    resolved_qty: number | null;
    resolved_at: Date | null;
  }>(
    `SELECT rr.id, b.code AS booth_code, p.name AS product_name,
            rr.requested_qty, rr.status, rr.created_at,
            rr.resolved_qty, rr.resolved_at
     FROM restock_requests rr
     JOIN booths b ON b.id = rr.booth_id
     JOIN products p ON p.id = rr.product_id
     WHERE b.expo_id = $1${boothFilter}
     ORDER BY rr.created_at DESC`,
    params,
  );
  return res.rows.map((r) => ({
    id: r.id,
    boothCode: r.booth_code,
    productName: r.product_name,
    requestedQty: r.requested_qty,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    resolvedQty: r.resolved_qty,
    resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
  }));
}

export interface CreateRestockResult {
  id: string;
  productId: string;
  boothId: string;
  requestedQty: number;
  status: 'pending';
  createdAt: string;
}

/** Staff create a restock request for a product allocated to their booth. */
export async function createRestockRequest(args: {
  expoId: string;
  boothId: string;
  accountId: string;
  productId: string;
  requestedQty: number;
}): Promise<CreateRestockResult> {
  const { expoId, boothId, accountId, productId, requestedQty } = args;

  // Product must exist in expo and be allocated to this booth.
  const allocRes = await query<{ product_id: string }>(
    `SELECT a.product_id
     FROM allocations a
     JOIN products p ON p.id = a.product_id
     WHERE a.booth_id = $1 AND a.product_id = $2 AND p.expo_id = $3 AND p.is_active = true`,
    [boothId, productId, expoId],
  );
  if (!allocRes.rows[0]) {
    throw Errors.validation('Product not allocated to this booth', { productId });
  }

  const res = await query<{ id: string; created_at: Date }>(
    `INSERT INTO restock_requests (booth_id, product_id, requested_by, requested_qty)
     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
    [boothId, productId, accountId, requestedQty],
  );
  const row = res.rows[0]!;
  return {
    id: row.id,
    productId,
    boothId,
    requestedQty,
    status: 'pending',
    createdAt: row.created_at.toISOString(),
  };
}

export interface FulfillResult {
  id: string;
  status: 'fulfilled';
  resolvedQty: number;
}

/**
 * Owner fulfills a pending request: warehouse_qty -= qty, allocations += qty.
 * One transaction, FOR UPDATE on the product row. Rejects if not pending or if
 * insufficient warehouse stock. Caller provides the transaction client.
 */
export async function fulfillRestockRequest(
  client: pg.PoolClient,
  args: { expoId: string; resolverAccountId: string; requestId: string; qty: number },
): Promise<FulfillResult> {
  const { expoId, resolverAccountId, requestId, qty } = args;

  // Load + lock the request (and confirm it's in this expo).
  const reqRes = await client.query<{
    id: string;
    booth_id: string;
    product_id: string;
    status: string;
  }>(
    `SELECT rr.id, rr.booth_id, rr.product_id, rr.status
     FROM restock_requests rr
     JOIN booths b ON b.id = rr.booth_id
     WHERE rr.id = $1 AND b.expo_id = $2
     FOR UPDATE OF rr`,
    [requestId, expoId],
  );
  const request = reqRes.rows[0];
  if (!request) throw Errors.notFound('Restock request not found');
  if (request.status !== 'pending') throw Errors.alreadyResolved();

  // Lock the product row and check warehouse stock.
  const prodRes = await client.query<{ warehouse_qty: number }>(
    'SELECT warehouse_qty FROM products WHERE id = $1 FOR UPDATE',
    [request.product_id],
  );
  const prod = prodRes.rows[0];
  if (!prod) throw Errors.notFound('Product not found');
  if (prod.warehouse_qty < qty) {
    throw Errors.insufficientWarehouseStock(prod.warehouse_qty);
  }

  // Move stock: warehouse down, allocation up. The CHECK (warehouse_qty >= 0)
  // is the DB backstop; the app check above gives a clean 409.
  await client.query(
    'UPDATE products SET warehouse_qty = warehouse_qty - $1 WHERE id = $2',
    [qty, request.product_id],
  );
  await client.query(
    `INSERT INTO allocations (booth_id, product_id, allocated_qty)
     VALUES ($1, $2, $3)
     ON CONFLICT (booth_id, product_id)
     DO UPDATE SET allocated_qty = allocations.allocated_qty + EXCLUDED.allocated_qty,
                   updated_at = now()`,
    [request.booth_id, request.product_id, qty],
  );

  await client.query(
    `UPDATE restock_requests
     SET status = 'fulfilled', resolved_by = $1, resolved_qty = $2, resolved_at = now()
     WHERE id = $3`,
    [resolverAccountId, qty, requestId],
  );

  return { id: requestId, status: 'fulfilled', resolvedQty: qty };
}
