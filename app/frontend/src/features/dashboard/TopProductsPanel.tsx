import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import type { TopProductRow } from '../../lib/types';

interface TopProductsPanelProps {
  products: TopProductRow[];
  formatMoney: (minor: number) => string;
}

export function TopProductsPanel({ products, formatMoney }: TopProductsPanelProps) {
  const max = Math.max(1, ...products.map((p) => p.revenueMinor));
  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="trophy" size={15} /> Top products
        </h2>
      </div>
      <div className="bb-bd">
        {products.length === 0 && <div className="bb-empty">No sales yet.</div>}
        {products.map((p, i) => (
          <div key={p.productId} className="bb-bd-row">
            <div className="bb-bd-rank mono">{i + 1}</div>
            <div className="bb-bd-name">{p.name}</div>
            <div className="bb-bd-bar">
              <div className="bb-bd-fill" style={{ width: `${(p.revenueMinor / max) * 100}%` }} />
            </div>
            <div className="bb-bd-rev mono">{formatMoney(p.revenueMinor)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
