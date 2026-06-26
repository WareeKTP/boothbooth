import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import type { TransactionRow } from '../../lib/types';

interface BoothTransactionsProps {
  transactions: TransactionRow[];
  formatMoney: (minor: number) => string;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Unpaginated per frontend-final.md §1/§7 — backend returns the full day/expo list. */
export function BoothTransactions({ transactions, formatMoney }: BoothTransactionsProps) {
  const sorted = [...transactions].sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="receipt" size={15} /> Transactions
        </h2>
        <span className="bb-count mono">{sorted.length}</span>
      </div>
      <div className="bb-txns">
        {sorted.length === 0 && <div className="bb-empty">No sales recorded yet today.</div>}
        {sorted.map((s) => (
          <div key={s.id} className="bb-txn">
            <div className="bb-txn-time mono">{timeOf(s.soldAt)}</div>
            <div className="bb-txn-mid">
              <div className="bb-txn-id mono">{s.displayId}</div>
              <div className="bb-txn-items">
                {s.items.map((it) => `${it.name} ×${it.qty}`).join(' · ')}
              </div>
            </div>
            <div className="bb-txn-tot mono">{formatMoney(s.totalMinor)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
