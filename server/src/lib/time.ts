/**
 * "Today" boundary math in EXPO_TZ (backend-final.md §3 preamble, decision 14).
 * All "today"-scoped queries compute the day window from now() in EXPO_TZ, then
 * match sold_at (stored UTC) against [dayStartUtc, dayEndUtc).
 *
 * Implemented with Intl (no date library / dependency). We derive the wall-clock
 * Y-M-D in the target tz, then find the UTC instant of local midnight by
 * computing that zone's offset at that moment.
 */

/** Returns the offset (minutes) of `tz` at the given UTC instant. */
function tzOffsetMinutes(date: Date, tz: string): number {
  // Format the same instant as wall-clock in tz, parse it back as if UTC, and
  // the difference from the real UTC instant is the zone offset.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  }
  // 'hour' can be 24 at midnight in some environments; normalize.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return (asUtc - date.getTime()) / 60000;
}

export interface DayWindow {
  /** Inclusive lower bound (UTC). */
  startUtc: Date;
  /** Exclusive upper bound (UTC). */
  endUtc: Date;
  /** YYYY-MM-DD wall-clock date in the expo timezone. */
  localDate: string;
}

/**
 * Compute the UTC window covering the current local day in `tz`. `now` is
 * injectable for testing.
 */
export function todayWindow(tz: string, now: Date = new Date()): DayWindow {
  // Wall-clock Y-M-D in tz.
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDate = dtf.format(now); // en-CA => YYYY-MM-DD
  const [y, m, d] = localDate.split('-').map((s) => parseInt(s, 10));

  // Local midnight expressed naively as if UTC, then shifted by the zone offset
  // at that wall time to get the true UTC instant.
  const naiveMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetAtMidnight = tzOffsetMinutes(new Date(naiveMidnight), tz);
  const startUtc = new Date(naiveMidnight - offsetAtMidnight * 60000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return { startUtc, endUtc, localDate };
}
