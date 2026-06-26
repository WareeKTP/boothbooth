/**
 * Central stock-status thresholds. Single source of truth so warehouse rows,
 * booth inventory rows, and the dashboard low-count all agree (backend-final.md
 * §3.5). Pure functions — unit-testable without a DB.
 *
 * Thresholds (server-computed):
 *   out:   qty <= 0
 *   low:   qty <= reorderPoint
 *   watch: qty <= round(reorderPoint * 1.4)
 *   ok:    otherwise
 */
export type StockStatus = 'out' | 'low' | 'watch' | 'ok';

export function stockStatus(qty: number, reorderPoint: number): StockStatus {
  if (qty <= 0) return 'out';
  if (qty <= reorderPoint) return 'low';
  if (qty <= Math.round(reorderPoint * 1.4)) return 'watch';
  return 'ok';
}

/** Warehouse status keys on warehouse_qty vs reorder_point. */
export function warehouseStatus(warehouseQty: number, reorderPoint: number): StockStatus {
  return stockStatus(warehouseQty, reorderPoint);
}

/**
 * Booth-inventory status keys on `remaining` (allocated − sold). The frontend
 * leaves this row's `status` as an optional field; we populate it for
 * consistency with the warehouse table. We key off allocatedQty as the
 * "reorder-ish" reference is unavailable per booth, so we treat any positive
 * remaining as at least 'low' relative to its allocation: use a proportion of
 * the allocated quantity as the watch/low band.
 */
export function boothInventoryStatus(remaining: number, allocatedQty: number): StockStatus {
  if (remaining <= 0) return 'out';
  // A booth "low" line is one running down toward empty. Use 20% of the
  // original allocation as the low band, 40% as watch — proportional, no
  // hardcoded magic constant, and stable across product sizes.
  const low = Math.max(1, Math.round(allocatedQty * 0.2));
  const watch = Math.max(low, Math.round(allocatedQty * 0.4));
  if (remaining <= low) return 'low';
  if (remaining <= watch) return 'watch';
  return 'ok';
}
