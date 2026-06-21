/**
 * Booth read models (backend-final.md §3.3, §3.4, §3.7).
 *
 * Derive-don't-store: sold = SUM(sale_items.qty) over that booth/product;
 * remaining = allocated_qty − sold. Revenue/units/txn come straight off the
 * sales ledger. All computed in SQL with the indexes from §2.
 */
import { query } from '../db/pool.js';
import { boothInventoryStatus, type StockStatus } from '../lib/stock.js';

export interface BoothListRow {
  id: string;
  code: string;
  name: string;
  location: string;
  staffName: string;
  revenueMinor: number;
  units: number;
  txnCount: number;
  topProductName: string | null;
  lowLineCount: number;
}

export interface SaleLineItem {
  productId: string;
  name: string;
  qty: number;
  unitPriceMinor: number;
}

export interface TransactionRow {
  id: string;
  displayId: string;
  soldAt: string;
  items: SaleLineItem[];
  totalMinor: number;
}

export interface BoothInventoryRow {
  productId: string;
  name: string;
  sku: string;
  allocatedQty: number;
  soldQty: number;
  remaining: number;
  status: StockStatus;
}

export interface BoothDetailDTO {
  booth: { id: string; code: string; name: string; location: string; staffName: string };
  summary: { revenueMinor: number; txnCount: number; units: number; avgSaleMinor: number };
  productBreakdown: Array<{ productId: string; name: string; units: number; revenueMinor: number }>;
  transactions: TransactionRow[];
  inventory: BoothInventoryRow[];
}

/** Owner booth list with per-booth aggregates (backend-final.md §3.4). */
export async function getBoothList(expoId: string): Promise<BoothListRow[]> {
  const res = await query<{
    id: string;
    code: string;
    name: string;
    location: string;
    staff_name: string | null;
    revenue_minor: string | number;
    units: string | number;
    txn_count: string | number;
    top_product_name: string | null;
    low_line_count: string | number;
  }>(
    `
    WITH booth_rev AS (
      -- Revenue + txn count straight off the sales rows (no item fan-out).
      SELECT s.booth_id,
             COALESCE(SUM(s.total_minor), 0) AS revenue_minor,
             COUNT(*)                        AS txn_count
      FROM sales s
      WHERE s.expo_id = $1
      GROUP BY s.booth_id
    ),
    booth_units AS (
      -- Units summed from items (separate to avoid multiplying total_minor).
      SELECT s.booth_id, COALESCE(SUM(si.qty), 0) AS units
      FROM sales s JOIN sale_items si ON si.sale_id = s.id
      WHERE s.expo_id = $1
      GROUP BY s.booth_id
    ),
    top_prod AS (
      SELECT DISTINCT ON (s.booth_id) s.booth_id, p.name
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE s.expo_id = $1
      GROUP BY s.booth_id, p.id, p.name
      ORDER BY s.booth_id, SUM(si.qty) DESC
    ),
    sold AS (
      SELECT s.booth_id, si.product_id, SUM(si.qty) AS sold_qty
      FROM sales s JOIN sale_items si ON si.sale_id = s.id
      WHERE s.expo_id = $1
      GROUP BY s.booth_id, si.product_id
    ),
    low_lines AS (
      SELECT a.booth_id,
             COUNT(*) FILTER (
               WHERE (a.allocated_qty - COALESCE(sold.sold_qty, 0)) <= GREATEST(1, round(a.allocated_qty * 0.2))
             ) AS low_line_count
      FROM allocations a
      LEFT JOIN sold ON sold.booth_id = a.booth_id AND sold.product_id = a.product_id
      WHERE a.allocated_qty > 0
      GROUP BY a.booth_id
    )
    SELECT b.id, b.code, b.name, b.location,
           acc.full_name AS staff_name,
           COALESCE(br.revenue_minor, 0) AS revenue_minor,
           COALESCE(bu.units, 0)         AS units,
           COALESCE(br.txn_count, 0)     AS txn_count,
           tp.name                       AS top_product_name,
           COALESCE(ll.low_line_count, 0) AS low_line_count
    FROM booths b
    LEFT JOIN accounts acc ON acc.booth_id = b.id AND acc.role = 'staff' AND acc.is_active = true
    LEFT JOIN booth_rev br ON br.booth_id = b.id
    LEFT JOIN booth_units bu ON bu.booth_id = b.id
    LEFT JOIN top_prod tp ON tp.booth_id = b.id
    LEFT JOIN low_lines ll ON ll.booth_id = b.id
    WHERE b.expo_id = $1
    ORDER BY b.code
    `,
    [expoId],
  );

  return res.rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    location: r.location,
    staffName: r.staff_name ?? '',
    revenueMinor: Number(r.revenue_minor),
    units: Number(r.units),
    txnCount: Number(r.txn_count),
    topProductName: r.top_product_name,
    lowLineCount: Number(r.low_line_count),
  }));
}

/**
 * Full booth detail for owner (any booth) or staff (own booth). Optionally
 * windowed by sold_at for the daily-log path; when no window is given it returns
 * the full expo-to-date history (unpaginated, per §3.4).
 */
export async function getBoothDetail(
  boothId: string,
  window?: { startUtc: Date; endUtc: Date },
  expoId?: string,
): Promise<BoothDetailDTO | null> {
  // Optional expo scoping: rejects a booth id from another expo (defense in
  // depth for the multi-expo-capable model, harmless in the single-expo v1).
  const boothParams: unknown[] = [boothId];
  let expoFilter = '';
  if (expoId) {
    boothParams.push(expoId);
    expoFilter = ' AND b.expo_id = $2';
  }
  const boothRes = await query<{
    id: string;
    code: string;
    name: string;
    location: string;
    staff_name: string | null;
  }>(
    `SELECT b.id, b.code, b.name, b.location, acc.full_name AS staff_name
     FROM booths b
     LEFT JOIN accounts acc ON acc.booth_id = b.id AND acc.role = 'staff' AND acc.is_active = true
     WHERE b.id = $1${expoFilter}`,
    boothParams,
  );
  const booth = boothRes.rows[0];
  if (!booth) return null;

  const params: unknown[] = [boothId];
  let saleWindow = '';
  if (window) {
    params.push(window.startUtc, window.endUtc);
    saleWindow = ' AND s.sold_at >= $2 AND s.sold_at < $3';
  }

  // Summary + transactions are scoped to the optional window; inventory (derived
  // stock) always reflects all-time sales since that's the physical position.
  const summaryRes = await query<{
    revenue_minor: string | number;
    txn_count: string | number;
    units: string | number;
  }>(
    `SELECT COALESCE(SUM(s.total_minor),0) AS revenue_minor,
            COUNT(DISTINCT s.id)           AS txn_count,
            COALESCE(SUM(si.qty),0)        AS units
     FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
     WHERE s.booth_id = $1${saleWindow}`,
    params,
  );
  const sm = summaryRes.rows[0]!;
  const revenueMinor = Number(sm.revenue_minor);
  const txnCount = Number(sm.txn_count);
  const units = Number(sm.units);

  const breakdownRes = await query<{
    product_id: string;
    name: string;
    units: string | number;
    revenue_minor: string | number;
  }>(
    `SELECT si.product_id, p.name,
            SUM(si.qty) AS units,
            SUM(si.qty * si.unit_price_minor) AS revenue_minor
     FROM sales s JOIN sale_items si ON si.sale_id = s.id
     JOIN products p ON p.id = si.product_id
     WHERE s.booth_id = $1${saleWindow}
     GROUP BY si.product_id, p.name
     ORDER BY units DESC`,
    params,
  );

  const txnRes = await query<{
    id: string;
    display_id: string;
    sold_at: Date;
    total_minor: number;
    items: SaleLineItem[];
  }>(
    `SELECT s.id, s.display_id, s.sold_at, s.total_minor,
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', si.product_id,
                  'name', p.name,
                  'qty', si.qty,
                  'unitPriceMinor', si.unit_price_minor
                ) ORDER BY p.name
              ) FILTER (WHERE si.id IS NOT NULL), '[]'
            ) AS items
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE s.booth_id = $1${saleWindow}
     GROUP BY s.id
     ORDER BY s.sold_at DESC`,
    params,
  );

  const invRes = await query<{
    product_id: string;
    name: string;
    sku: string;
    allocated_qty: number;
    sold_qty: string | number;
  }>(
    `SELECT a.product_id, p.name, p.sku, a.allocated_qty,
            COALESCE((
              SELECT SUM(si.qty) FROM sale_items si
              JOIN sales s2 ON s2.id = si.sale_id
              WHERE s2.booth_id = a.booth_id AND si.product_id = a.product_id
            ), 0) AS sold_qty
     FROM allocations a
     JOIN products p ON p.id = a.product_id
     WHERE a.booth_id = $1 AND a.allocated_qty > 0
     ORDER BY p.name`,
    [boothId],
  );

  return {
    booth: {
      id: booth.id,
      code: booth.code,
      name: booth.name,
      location: booth.location,
      staffName: booth.staff_name ?? '',
    },
    summary: {
      revenueMinor,
      txnCount,
      units,
      avgSaleMinor: txnCount > 0 ? Math.round(revenueMinor / txnCount) : 0,
    },
    productBreakdown: breakdownRes.rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      units: Number(r.units),
      revenueMinor: Number(r.revenue_minor),
    })),
    transactions: txnRes.rows.map((r) => ({
      id: r.id,
      displayId: r.display_id,
      soldAt: r.sold_at.toISOString(),
      items: r.items,
      totalMinor: r.total_minor,
    })),
    inventory: invRes.rows.map((r) => {
      const soldQty = Number(r.sold_qty);
      const remaining = r.allocated_qty - soldQty;
      return {
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        allocatedQty: r.allocated_qty,
        soldQty,
        remaining,
        status: boothInventoryStatus(remaining, r.allocated_qty),
      };
    }),
  };
}
