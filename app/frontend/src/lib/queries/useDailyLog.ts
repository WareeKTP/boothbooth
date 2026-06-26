import type { DailyLogDTO } from '../types';
import { queryKeys } from './keys';
import { useApiQuery } from './useApiQuery';

/** Today only for v1 — no `?date=` param, no date picker. See frontend-final.md §2. */
export function useDailyLog() {
  return useApiQuery<DailyLogDTO>(queryKeys.dailyLog, '/me/daily-log');
}
