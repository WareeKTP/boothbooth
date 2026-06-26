import type { DashboardDTO } from '../types';
import { queryKeys } from './keys';
import { useApiQuery } from './useApiQuery';

/**
 * One call backs the entire DashboardPage (KPIs + chart + top products +
 * recent sales + sales-by-booth) — backend-final.md §3.3, frontend-final.md §7.
 * Polls every ~10-15s for "live" data (no websockets, per locked decision #14
 * in backend-final.md's summary / DESIGN.md).
 */
export function useDashboard() {
  return useApiQuery<DashboardDTO>(queryKeys.dashboard, '/dashboard', 12_000);
}
