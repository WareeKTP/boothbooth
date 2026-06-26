/**
 * POS read model + checkout (backend-final.md §3.6, §4.4).
 *
 * Checkout is the critical-correctness path: one transaction that re-derives
 * `remaining` under FOR UPDATE on the relevant allocations rows and rejects any
 * line exceeding remaining (no overselling). Prices are re-read from products
 * (client price ignored). display_id is assigned from sale_sequences under the
 * same lock.
 */
import type pg from 'pg';
import { query } from '../db/pool.js';
import { Errors } from '../lib/errors.js';

export interface PosCatalogRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  priceMinor: number;
  remaining: number;
}

/** Products allocated (allocated_qty > 0) to a booth, with derived remaining. */
export async function getPosCatalog(boothId: string): Promise<PosCatalogRow[]> {
  const res = await query<{
    product_id: string;
    name: string;
    sku: string;
    category: string;
    price_minor: number;
    allocated_qty: number;
    sold_qty: string | number;
  }>(
    `
    SELECT p.id AS product_id, p.name, p.sku, p.category, p.price_minor,
           a.allocated_qty,
           COALESCE((
             SELECT SUM(si.qty) FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE s.booth_id = a.booth_id AND si.product_id = a.product_id
           ), 0) AS sold_qty
    FROM allocations a
    JOIN products p ON p.id = a.product_id
    WHERE a.booth_id = $1 AND a.allocated_qty > 0 AND p.is_active = true
    ORDER BY p.name
    `,
    [boothId],
  );

  return res.rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    category: r.category,
    priceMinor: r.price_minor,
    remaining: r.allocated_qty - Number(r.sold_qty),
  }));
}

export interface CheckoutItem {
  productId: string;
  qty: number;
}

export interface CheckoutResult {
  id: string;
  displayId: string;
  boothId: string;
  totalMinor: number;
  soldAt: string;
  items: Array<{ productId: string; name: string; qty: number; unitPriceMinor: number }>;
}

/**
 * Execute a sale inside an existing transaction. Caller owns BEGIN/COMMIT and
 * the idempotency bookkeeping. Throws typed errors (422/409) on bad input or
 * insufficient stock.
 */
export async function executeCheckout(
  client: pg.PoolClient,
  args: { expoId: string; boothId: string; accountId: string; items: CheckoutItem[] },
): Promise<CheckoutResult> {
  const { expoId, boothId, accountId, items } = args;

  if (items.length === 0) {
    throw Errors.validation('Cart is empty');
  }

  // Reject duplicate productIds (schema-level UNIQUE(sale_id, product_id) would
  // also catch it, but a clean 422 is friendlier than a 500).
  const seen = new Set<string>();
  for (const it of items) {
    if (it.qty <= 0) throw Errors.validation('Quantity must be positive', { productId: it.productId });
    if (seen.has(it.productId)) {
      throw Errors.validation('Duplicate product in cart', { productId: it.productId });
    }
    seen.add(it.productId);
  }

  const productIds = items.map((i) => i.productId);

  // Lock the allocations rows for this booth+products. FOR UPDATE serializes
  // concurrent checkouts on the same lines so the remaining re-derivation below
  // is race-free (backend-final.md §4.4).
  const allocRes = await client.query<{
    product_id: string;
    allocated_qty: number;
    name: string;
    price_minor: number;
  }>(
    `SELECT a.product_id, a.allocated_qty, p.name, p.price_minor
     FROM allocations a
     JOIN products p ON p.id = a.product_id
     WHERE a.booth_id = $1 AND a.product_id = ANY($2::uuid[])
       AND p.is_active = true AND p.expo_id = $3
     FOR UPDATE OF a`,
    [boothId, productIds, expoId],
  );

  const allocByProduct = new Map(allocRes.rows.map((r) => [r.product_id, r]));

  // Every requested product must be allocated to this booth.
  for (const it of items) {
    if (!allocByProduct.has(it.productId)) {
      throw Errors.validation('Product not allocated to this booth', { productId: it.productId });
    }
  }

  // Re-derive sold-per-product for this booth (within the locked snapshot).
  const soldRes = await client.query<{ product_id: string; sold_qty: string | number }>(
    `SELECT si.product_id, COALESCE(SUM(si.qty),0) AS sold_qty
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.booth_id = $1 AND si.product_id = ANY($2::uuid[])
     GROUP BY si.product_id`,
    [boothId, productIds],
  );
  const soldByProduct = new Map(soldRes.rows.map((r) => [r.product_id, Number(r.sold_qty)]));

  // Validate every line against remaining; collect all shortfalls for one 409.
  const shortfalls: Array<{ productId: string; requested: number; remaining: number }> = [];
  for (const it of items) {
    const alloc = allocByProduct.get(it.productId)!;
    const sold = soldByProduct.get(it.productId) ?? 0;
    const remaining = alloc.allocated_qty - sold;
    if (it.qty > remaining) {
      shortfalls.push({ productId: it.productId, requested: it.qty, remaining });
    }
  }
  if (shortfalls.length > 0) {
    throw Errors.insufficientStock(shortfalls);
  }

  // Assign next display_id from the per-expo sequence (locked row).
  const seqRes = await client.query<{ next_seq: number }>(
    'UPDATE sale_sequences SET next_seq = next_seq + 1 WHERE expo_id = $1 RETURNING next_seq - 1 AS next_seq',
    [expoId],
  );
  if (!seqRes.rows[0]) {
    // No sequence row for this expo — a seed/setup invariant violation.
    throw Errors.validation('Sale sequence not initialized for expo');
  }
  const displayId = `S-${seqRes.rows[0].next_seq}`;

  // Compute total from server-side prices.
  const lineItems = items.map((it) => {
    const alloc = allocByProduct.get(it.productId)!;
    return {
      productId: it.productId,
      name: alloc.name,
      qty: it.qty,
      unitPriceMinor: alloc.price_minor,
    };
  });
  const totalMinor = lineItems.reduce((sum, li) => sum + li.qty * li.unitPriceMinor, 0);

  // Insert the sale + items.
  const saleRes = await client.query<{ id: string; sold_at: Date }>(
    `INSERT INTO sales (expo_id, display_id, booth_id, account_id, total_minor)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, sold_at`,
    [expoId, displayId, boothId, accountId, totalMinor],
  );
  const sale = saleRes.rows[0]!;

  for (const li of lineItems) {
    await client.query(
      `INSERT INTO sale_items (sale_id, product_id, qty, unit_price_minor)
       VALUES ($1, $2, $3, $4)`,
      [sale.id, li.productId, li.qty, li.unitPriceMinor],
    );
  }

  return {
    id: sale.id,
    displayId,
    boothId,
    totalMinor,
    soldAt: sale.sold_at.toISOString(),
    items: lineItems,
  };
}
