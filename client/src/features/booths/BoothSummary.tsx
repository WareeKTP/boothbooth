import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Stat } from '../../components/Stat';
import type { BoothSummary as BoothSummaryDTO } from '../../lib/types';

interface BoothSummaryProps {
  summary: BoothSummaryDTO;
  formatMoney: (minor: number) => string;
}

/**
 * Shared KPI strip used by My Booth / Daily Log / Booth Detail — same shape
 * as the mockup's BoothSummary, but reads server-computed summary fields
 * (revenueMinor, txnCount, units, avgSaleMinor) instead of deriving them
 * from raw products/sales arrays. backend-final.md §3.4/§3.7/§3.9.
 */
export function BoothSummary({ summary, formatMoney }: BoothSummaryProps) {
  return (
    <div className="bb-kpis">
      <Card className="bb-kpi">
        <div className="bb-kpi-ic" style={{ color: 'var(--ok)' }}>
          <Icon name="banknote" size={18} />
        </div>
        <Stat value={formatMoney(summary.revenueMinor)} label="Revenue today" />
      </Card>
      <Card className="bb-kpi">
        <div className="bb-kpi-ic">
          <Icon name="receipt" size={18} />
        </div>
        <Stat value={summary.txnCount} label="Sales" />
      </Card>
      <Card className="bb-kpi">
        <div className="bb-kpi-ic">
          <Icon name="package" size={18} />
        </div>
        <Stat value={summary.units} label="Units sold" />
      </Card>
      <Card className="bb-kpi">
        <div className="bb-kpi-ic">
          <Icon name="trending-up" size={18} />
        </div>
        <Stat value={formatMoney(summary.avgSaleMinor)} label="Avg sale" />
      </Card>
    </div>
  );
}
