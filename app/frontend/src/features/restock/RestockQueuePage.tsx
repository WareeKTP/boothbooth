import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { useRestockRequests } from '../../lib/queries/useRestockRequests';
import { FulfillRestockModal } from './FulfillRestockModal';
import type { RestockRequestRow } from '../../lib/types';

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Owner-only minimal queue/inbox. One route, one table, one modal — no bulk
 * actions, no rejection flow UI in v1, per frontend-final.md §6.
 */
export function RestockQueuePage() {
  const { data, isLoading, isError } = useRestockRequests();
  const [showAll, setShowAll] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<RestockRequestRow | null>(null);

  const rows = useMemo(() => {
    const all = data ?? [];
    return showAll ? all : all.filter((r) => r.status === 'pending');
  }, [data, showAll]);

  const pendingCount = (data ?? []).filter((r) => r.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading restock requests…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load restock requests. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Restock requests</h1>
          <p className="bb-sub">{pendingCount} pending · fulfill moves stock from warehouse to a booth</p>
        </div>
        <div className="bb-segment">
          <button className={'bb-seg' + (!showAll ? ' on' : '')} onClick={() => setShowAll(false)}>
            Pending
          </button>
          <button className={'bb-seg' + (showAll ? ' on' : '')} onClick={() => setShowAll(true)}>
            All
          </button>
        </div>
      </div>

      <Card pad={false} className="bb-panel">
        <div className="bb-tablewrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Booth</th>
                <th>Product</th>
                <th className="bb-th-r">Qty requested</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono bb-dim">{timeOf(r.createdAt)}</td>
                  <td className="mono">{r.boothCode}</td>
                  <td>
                    <div className="bb-cell-name">{r.productName}</div>
                  </td>
                  <td className="bb-td-r mono">{r.requestedQty}</td>
                  <td>
                    <Badge status={r.status === 'pending' ? 'pending' : r.status === 'fulfilled' ? 'fulfilled' : 'out'}>
                      {r.status === 'pending' ? 'Pending' : r.status === 'fulfilled' ? 'Fulfilled' : 'Rejected'}
                    </Badge>
                  </td>
                  <td className="bb-td-r">
                    {r.status === 'pending' && (
                      <Button variant="ghost" icon="package-check" onClick={() => setFulfillTarget(r)}>
                        Fulfill
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="bb-empty">
                    <Icon name="check-circle" size={18} style={{ marginBottom: 6, color: 'var(--ok)' }} />
                    <div>{showAll ? 'No restock requests yet.' : 'No pending restock requests.'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {fulfillTarget && <FulfillRestockModal request={fulfillTarget} onClose={() => setFulfillTarget(null)} />}
    </div>
  );
}
