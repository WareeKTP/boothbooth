/**
 * Owner dashboard aggregate (backend-final.md §3.3). Everything the dashboard
 * needs in ONE call. revenueToday/unitsSoldToday/boothSeries scoped to the
 * expo's current day in EXPO_TZ; salesByBooth/topProducts/recentSales are
 * to-date for the expo.
 */
import { query } from '../db/pool.js';
import { todayWindow } from '../lib/time.js';
import { getWarehouseLowCount } from './warehouse.js';

export interface DashboardDTO {
  kpis: {
    revenueTodayMinor: number;
    unitsSoldToday: number;
    activeBooths: number;
    warehouseLowCount: number;
  };
  boothSeries: {
    booths: Array<{ boothId: string; code: string }>;
    points: Array<{ saleSeq: number; cumulativeByBooth: Record<string, number> }>;
  };
  salesByBooth: Array<{
    boothId: string;
    code: string;
    name: string;
    staffName: string;
    revenueMinor: number;
    units: number;
    txnCount: number;
  }>;
  topProducts: Array<{ productId: string; name: string; units: number; revenueMinor: number }>;
  recentSales: Array<{
    id: string;
    displayId: string;
    boothId: string;
    boothCode: string;
    units: number;
    totalMinor: number;
    soldAt: string;
  }>;
}

export async function getDashboard(expoId: string, tz: string): Promise<DashboardDTO> {
  const { startUtc, endUtc } = todayWindow(tz);

  // ── KPIs: today revenue + units ────────────────────────────────────────────
  const todayRes = await query<{ revenue_minor: string | number; units: string | number }>(
    `SELECT COALESCE(SUM(s.total_minor),0) AS revenue_minor,
            COALESCE((
              SELECT SUM(si.qty) FROM sale_items si
              JOIN sales s2 ON s2.id = si.sale_id
              WHERE s2.expo_id = $1 AND s2.sold_at >= $2 AND s2.sold_at < $3
            ),0) AS units
     FROM sales s
     WHERE s.expo_id = $1 AND s.sold_at >= $2 AND s.sold_at < $3`,
    [expoId, startUtc, endUtc],
  );

  const boothCountRes = await query<{ n: string | number }>(
    'SELECT COUNT(*) AS n FROM booths WHERE expo_id = $1',
    [expoId],
  );

  const warehouseLowCount = await getWarehouseLowCount(expoId);

  // ── salesByBooth (to-date) ─────────────────────────────────────────────────
  const byBoothRes = await query<{
    booth_id: string;
    code: string;
    name: string;
    staff_name: string | null;
    revenue_minor: string | number;
    units: string | number;
    txn_count: string | number;
  }>(
    `SELECT b.id AS booth_id, b.code, b.name, acc.full_name AS staff_name,
            COALESCE(SUM(s.total_minor),0) AS revenue_minor,
            COALESCE(SUM(si_units.units),0) AS units,
            COUNT(s.id) AS txn_count
     FROM booths b
     LEFT JOIN accounts acc ON acc.booth_id = b.id AND acc.role = 'staff' AND acc.is_active = true
     LEFT JOIN sales s ON s.booth_id = b.id
     LEFT JOIN LATERAL (
       SELECT SUM(si.qty) AS units FROM sale_items si WHERE si.sale_id = s.id
     ) si_units ON true
     WHERE b.expo_id = $1
     GROUP BY b.id, b.code, b.name, acc.full_name
     ORDER BY b.code`,
    [expoId],
  );

  // ── topProducts (top 5, to-date) ───────────────────────────────────────────
  const topRes = await query<{
    product_id: string;
    name: string;
    units: string | number;
    revenue_minor: string | number;
  }>(
    `SELECT si.product_id, p.name,
            SUM(si.qty) AS units,
            SUM(si.qty * si.unit_price_minor) AS revenue_minor
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.expo_id = $1
     GROUP BY si.product_id, p.name
     ORDER BY units DESC
     LIMIT 5`,
    [expoId],
  );

  // ── recentSales (last 7, to-date) ──────────────────────────────────────────
  const recentRes = await query<{
    id: string;
    display_id: string;
    booth_id: string;
    booth_code: string;
    units: string | number;
    total_minor: number;
    sold_at: Date;
  }>(
    `SELECT s.id, s.display_id, s.booth_id, b.code AS booth_code,
            COALESCE((SELECT SUM(si.qty) FROM sale_items si WHERE si.sale_id = s.id),0) AS units,
            s.total_minor, s.sold_at
     FROM sales s JOIN booths b ON b.id = s.booth_id
     WHERE s.expo_id = $1
     ORDER BY s.sold_at DESC
     LIMIT 7`,
    [expoId],
  );

  // ── boothSeries: cumulative revenue per booth, ordered by sale time ─────────
  // Scoped to today's sales (the dashboard chart is the live day view).
  const seriesRes = await query<{
    id: string;
    booth_id: string;
    total_minor: number;
    sold_at: Date;
  }>(
    `SELECT s.id, s.booth_id, s.total_minor, s.sold_at
     FROM sales s
     WHERE s.expo_id = $1 AND s.sold_at >= $2 AND s.sold_at < $3
     ORDER BY s.sold_at ASC`,
    [expoId, startUtc, endUtc],
  );

  const seriesBooths = byBoothRes.rows.map((r) => ({ boothId: r.booth_id, code: r.code }));
  const running: Record<string, number> = {};
  for (const b of seriesBooths) running[b.boothId] = 0;
  const points = seriesRes.rows.map((row, idx) => {
    running[row.booth_id] = (running[row.booth_id] ?? 0) + row.total_minor;
    return { saleSeq: idx + 1, cumulativeByBooth: { ...running } };
  });

  return {
    kpis: {
      revenueTodayMinor: Number(todayRes.rows[0]!.revenue_minor),
      unitsSoldToday: Number(todayRes.rows[0]!.units),
      activeBooths: Number(boothCountRes.rows[0]!.n),
      warehouseLowCount,
    },
    boothSeries: { booths: seriesBooths, points },
    salesByBooth: byBoothRes.rows.map((r) => ({
      boothId: r.booth_id,
      code: r.code,
      name: r.name,
      staffName: r.staff_name ?? '',
      revenueMinor: Number(r.revenue_minor),
      units: Number(r.units),
      txnCount: Number(r.txn_count),
    })),
    topProducts: topRes.rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      units: Number(r.units),
      revenueMinor: Number(r.revenue_minor),
    })),
    recentSales: recentRes.rows.map((r) => ({
      id: r.id,
      displayId: r.display_id,
      boothId: r.booth_id,
      boothCode: r.booth_code,
      units: Number(r.units),
      totalMinor: r.total_minor,
      soldAt: r.sold_at.toISOString(),
    })),
  };
}
