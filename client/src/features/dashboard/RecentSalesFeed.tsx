import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Dot } from '../../components/Dot';
import type { RecentSaleRow } from '../../lib/types';

interface RecentSalesFeedProps {
  sales: RecentSaleRow[];
  formatMoney: (minor: number) => string;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function RecentSalesFeed({ sales, formatMoney }: RecentSalesFeedProps) {
  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="activity" size={15} /> Recent sales
        </h2>
      </div>
      <div className="bb-feed">
        {sales.length === 0 && <div className="bb-empty">No sales recorded yet today.</div>}
        {sales.map((s) => (
          <div key={s.id} className="bb-feed-row">
            <div className="bb-feed-rail">
              <Dot status="ok" size={7} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="bb-feed-text">
                <b className="mono">{s.boothCode}</b> sold {s.units} item{s.units > 1 ? 's' : ''} —{' '}
                {formatMoney(s.totalMinor)}
              </div>
              <div className="bb-feed-time mono">
                {timeOf(s.soldAt)} · {s.displayId}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
