/**
 * Warehouse read model (backend-final.md §3.5). warehouseQty is a mutable
 * counter; allocatedTotal/soldTotal are derived in SQL. status is computed
 * centrally via warehouseStatus().
 */
import { query } from '../db/pool.js';
import { warehouseStatus, type StockStatus } from '../lib/stock.js';

export interface WarehouseRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  warehouseQty: number;
  allocatedTotal: number;
  soldTotal: number;
  reorderPoint: number;
  status: StockStatus;
}

export async function getWarehouse(expoId: string): Promise<WarehouseRow[]> {
  const res = await query<{
    product_id: string;
    name: string;
    sku: string;
    category: string;
    warehouse_qty: number;
    reorder_point: number;
    allocated_total: string | number;
    sold_total: string | number;
  }>(
    `
    SELECT p.id AS product_id, p.name, p.sku, p.category,
           p.warehouse_qty, p.reorder_point,
           COALESCE((SELECT SUM(a.allocated_qty) FROM allocations a WHERE a.product_id = p.id), 0) AS allocated_total,
           COALESCE((
             SELECT SUM(si.qty) FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE si.product_id = p.id
           ), 0) AS sold_total
    FROM products p
    WHERE p.expo_id = $1 AND p.is_active = true
    ORDER BY p.name
    `,
    [expoId],
  );

  return res.rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    category: r.category,
    warehouseQty: r.warehouse_qty,
    allocatedTotal: Number(r.allocated_total),
    soldTotal: Number(r.sold_total),
    reorderPoint: r.reorder_point,
    status: warehouseStatus(r.warehouse_qty, r.reorder_point),
  }));
}

/** Count of products whose warehouse status is out/low — dashboard KPI (§3.3). */
export async function getWarehouseLowCount(expoId: string): Promise<number> {
  const rows = await getWarehouse(expoId);
  return rows.filter((r) => r.status === 'out' || r.status === 'low').length;
}
