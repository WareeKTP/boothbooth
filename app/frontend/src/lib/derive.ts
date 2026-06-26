import type { StockStatus } from './types';

/**
 * Backend returns status enums/numbers; this file renders, never recomputes
 * business rules. Per frontend-final.md §4, this is intentionally small —
 * round 1's threshold math (whStatus/alloc-sold-inCart clamping) was deleted
 * because the server now does that derivation everywhere, including booth
 * inventory rows (server/src/domain/booths.ts -> boothInventoryStatus). The
 * client no longer carries a parallel threshold fallback for that row shape —
 * it previously did (frontend-final.md §11 open item #1), but the backend
 * has since closed that gap by always populating `status`, so a client-side
 * guess would only risk drifting from the server's proportional bands.
 */

export const STATUS_LABEL: Record<StockStatus, string> = {
  out: 'Out',
  low: 'Low',
  watch: 'Watch',
  ok: 'In stock',
};
