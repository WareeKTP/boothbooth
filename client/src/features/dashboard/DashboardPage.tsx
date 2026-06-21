import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Dot } from '../../components/Dot';
import { Stat } from '../../components/Stat';
import { useDashboard } from '../../lib/queries/useDashboard';
import { useSession } from '../auth/useSession';
import { formatMoney, formatMoneyCompact } from '../../lib/money';
import { ChartBoothSales, type ChartSeries } from './ChartBoothSales';
import { TopProductsPanel } from './TopProductsPanel';
import { RecentSalesFeed } from './RecentSalesFeed';

/**
 * "Updated Xs ago", ticking once a second. PRODUCT.md principle 5: "Honest
 * about real-time" — a LIVE indicator must reflect the actual refresh
 * cadence, not just a cosmetic clock. useDashboard polls every 12s
 * (backend-final.md §3.3), so this tells the owner how stale the numbers
 * on screen actually are right now, not just that polling exists somewhere.
 */
function useElapsedSince(timestamp: number): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

// Fallback palette keyed by booth order, used when backend omits
// boothSeries.booths[].color (marked optional in backend-final.md §3.3).
// frontend-final.md §5/§11 item 3.
const PALETTE = ['var(--accent)', '#10b981', '#a855f7', '#f59e0b'];
function paletteFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function DashboardPage() {
  const { account } = useSession();
  const { data, isLoading, isError, dataUpdatedAt } = useDashboard();
  const elapsed = useElapsedSince(dataUpdatedAt);
  const navigate = useNavigate();

  if (!account) return null;
  const currency = account.expo.currency;
  const fmt = (minor: number) => formatMoney(minor, currency);
  const fmtCompact = (minor: number) => formatMoneyCompact(minor, currency);

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading dashboard…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load the dashboard. Try refreshing.</div>
      </div>
    );
  }

  const series: ChartSeries[] = data.boothSeries.booths.map((b, i) => ({
    label: b.code,
    color: b.color ?? paletteFor(i),
    points: data.boothSeries.points.map((p) => ({ x: p.saleSeq, y: p.cumulativeByBooth[b.boothId] ?? 0 })),
  }));

  const maxBoothRevenue = Math.max(1, ...data.salesByBooth.map((b) => b.revenueMinor));

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Expo Dashboard</h1>
          <p className="bb-sub">{account.expo.name} · all booths combined</p>
        </div>
        <div className="bb-live" title="Refreshes automatically every ~12 seconds">
          <Dot status="ok" size={7} pulse />
          <span className="mono">LIVE</span>
          <span className="bb-live-time mono">{elapsed}</span>
        </div>
      </div>

      <div className="bb-kpis">
        <Card className="bb-kpi">
          <div className="bb-kpi-ic" style={{ color: 'var(--ok)' }}>
            <Icon name="banknote" size={18} />
          </div>
          <Stat value={fmt(data.kpis.revenueTodayMinor)} label="Sales today (all booths)" />
        </Card>
        <Card className="bb-kpi">
          <div className="bb-kpi-ic">
            <Icon name="package" size={18} />
          </div>
          <Stat value={data.kpis.unitsSoldToday} label="Units sold" />
        </Card>
        <Card className="bb-kpi">
          <div className="bb-kpi-ic">
            <Icon name="store" size={18} />
          </div>
          <Stat value={data.kpis.activeBooths} label="Active booths" />
        </Card>
        <Card className="bb-kpi" style={{ cursor: 'pointer' }}>
          <button className="bb-kpi-link" onClick={() => navigate('/warehouse')}>
            <div className="bb-kpi-ic" style={{ color: data.kpis.warehouseLowCount ? 'var(--warn)' : 'var(--text-2)' }}>
              <Icon name="warehouse" size={18} />
            </div>
            <Stat value={data.kpis.warehouseLowCount} label="Warehouse SKUs low" />
          </button>
        </Card>
      </div>

      <ChartBoothSales series={series} formatValue={fmtCompact} />

      <div className="bb-grid-2">
        <Card pad={false} className="bb-panel">
          <div className="bb-panel-head">
            <h2 className="bb-h2">
              <Icon name="store" size={15} /> Sales by booth
            </h2>
            <button className="bb-link" onClick={() => navigate('/booths')}>
              All booths <Icon name="arrow-right" size={13} />
            </button>
          </div>
          <div className="bb-bd bb-bd-booth">
            {data.salesByBooth.map((b) => (
              <button
                key={b.boothId}
                type="button"
                className="bb-bd-row bb-booth-row"
                onClick={() => navigate(`/booths/${b.boothId}`)}
              >
                <div className="bb-bd-name">
                  <b>{b.name}</b>
                  <span className="bb-bd-sub mono">{b.staffName}</span>
                </div>
                <div className="bb-bd-bar">
                  <div className="bb-bd-fill" style={{ width: `${(b.revenueMinor / maxBoothRevenue) * 100}%` }} />
                </div>
                <div className="bb-bd-units mono">
                  {b.units}u · {b.txnCount} sales
                </div>
                <div className="bb-bd-rev mono">{fmt(b.revenueMinor)}</div>
              </button>
            ))}
          </div>
        </Card>

        <div className="bb-col">
          <TopProductsPanel products={data.topProducts} formatMoney={fmt} />
          <RecentSalesFeed sales={data.recentSales} formatMoney={fmt} />
        </div>
      </div>
    </div>
  );
}
