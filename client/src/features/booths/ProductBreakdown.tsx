import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import type { TopProductRow } from '../../lib/types';

interface ProductBreakdownProps {
  products: TopProductRow[];
  formatMoney: (minor: number) => string;
}

/** Server-aggregated per-product sales for one booth — backend §3.4/§3.7/§3.9 `productBreakdown`. */
export function ProductBreakdown({ products, formatMoney }: ProductBreakdownProps) {
  const max = Math.max(1, ...products.map((p) => p.revenueMinor));
  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="bar-chart-3" size={15} /> Sales by product
        </h2>
      </div>
      <div className="bb-bd">
        {products.length === 0 && <div className="bb-empty">No sales yet.</div>}
        {products.map((p) => (
          <div key={p.productId} className="bb-bd-row">
            <div className="bb-bd-name">{p.name}</div>
            <div className="bb-bd-bar">
              <div className="bb-bd-fill" style={{ width: `${(p.revenueMinor / max) * 100}%` }} />
            </div>
            <div className="bb-bd-units mono">{p.units}u</div>
            <div className="bb-bd-rev mono">{formatMoney(p.revenueMinor)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
