import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { useWarehouse } from '../../lib/queries/useWarehouse';
import { useSession } from '../auth/useSession';
import { STATUS_LABEL } from '../../lib/derive';
import { ReceiveStockModal } from './ReceiveStockModal';
import type { WarehouseRow } from '../../lib/types';

/** Owner: manage (receive stock). Staff: read-only view, per frontend-final.md §2. */
export function WarehousePage() {
  const { account } = useSession();
  const { data, isLoading, isError } = useWarehouse();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [cat, setCat] = useState('All');
  const [receiveTarget, setReceiveTarget] = useState<WarehouseRow | null>(null);

  const isOwner = account?.role === 'owner';

  const cats = useMemo(() => ['All', ...Array.from(new Set((data ?? []).map((p) => p.category)))], [data]);

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((p) => cat === 'All' || p.category === cat)
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    [data, cat, q],
  );

  if (!account) return null;

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading warehouse…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load the warehouse. Try refreshing.</div>
      </div>
    );
  }

  const lowCount = data.filter((p) => p.status === 'out' || p.status === 'low').length;

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Warehouse</h1>
          <p className="bb-sub">
            {isOwner ? "Central stock — what's left to allocate to booths" : 'Available to request to your booth'} ·{' '}
            {lowCount} below reorder
          </p>
        </div>
        {isOwner && data.length > 0 && (
          <Button variant="solid" icon="package-plus" onClick={() => setReceiveTarget(data[0])}>
            Receive stock
          </Button>
        )}
      </div>

      <div className="bb-cat-row">
        {cats.map((c) => (
          <button key={c} className={'bb-pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <Card pad={false} className="bb-panel">
        <div className="bb-tablewrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Warehouse stock</th>
                <th className="bb-th-r">At booths</th>
                <th className="bb-th-r">Sold</th>
                <th className="bb-th-r">Status</th>
                {isOwner && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const whColor =
                  p.status === 'ok' ? 'var(--text)' : p.status === 'watch' ? 'var(--warn-text)' : 'var(--crit-text)';
                return (
                  <tr key={p.productId}>
                    <td>
                      <div className="bb-cell-name">{p.name}</div>
                      <div className="bb-cell-sku mono">{p.sku}</div>
                    </td>
                    <td>
                      <span className="bb-cat-tag">{p.category}</span>
                    </td>
                    <td>
                      <span className="mono bb-wh-q" style={{ color: whColor }}>
                        {p.warehouseQty}
                      </span>
                    </td>
                    <td className="bb-td-r mono bb-dim">{p.allocatedTotal}</td>
                    <td className="bb-td-r mono bb-dim">{p.soldTotal}</td>
                    <td className="bb-td-r">
                      <Badge status={p.status}>{STATUS_LABEL[p.status]}</Badge>
                    </td>
                    {isOwner && (
                      <td className="bb-td-r">
                        <button
                          className="bb-iconbtn"
                          onClick={() => setReceiveTarget(p)}
                          title="Receive / adjust"
                        >
                          <Icon name="pencil" size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 7 : 6} className="bb-empty">
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {receiveTarget && <ReceiveStockModal product={receiveTarget} onClose={() => setReceiveTarget(null)} />}
    </div>
  );
}
