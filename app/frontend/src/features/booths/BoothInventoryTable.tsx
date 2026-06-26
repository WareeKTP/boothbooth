import { useState } from 'react';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import type { BoothInventoryRow } from '../../lib/types';
import { useCreateRestockRequest } from '../../lib/queries/useRestockRequests';
import { useToast } from '../../app/ToastContext';

interface BoothInventoryTableProps {
  inventory: BoothInventoryRow[];
  /** Staff "Request restock" button on low/out rows — owner views never pass this. frontend-final.md §6. */
  canRequest?: boolean;
}

/**
 * Shared by My Booth and Booth Detail (frontend-final.md §10). Status is
 * always server-computed (boothInventoryStatus, proportional to
 * allocatedQty) — no client-side fallback, per lib/derive.ts.
 */
export function BoothInventoryTable({ inventory, canRequest = false }: BoothInventoryTableProps) {
  const createRestock = useCreateRestockRequest();
  const { toast } = useToast();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const handleRequest = async (row: BoothInventoryRow) => {
    // Suggested default qty per frontend-final.md §11 item 2: no server-suggested
    // default exists yet, so we use a fixed step (+10) matching the mockup's
    // receive-stock stepper feel — simplest sane default with no extra modal.
    const requestedQty = 10;
    setPendingProductId(row.productId);
    try {
      await createRestock.mutateAsync({ productId: row.productId, requestedQty });
      toast(`Restock requested · ${requestedQty} units of ${row.name}`, 'ok');
    } catch {
      toast(`Couldn't request restock for ${row.name}`, 'out');
    } finally {
      setPendingProductId(null);
    }
  };

  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="boxes" size={15} /> Booth inventory
        </h2>
      </div>
      <div className="bb-tablewrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="bb-th-r">Allocated</th>
              <th className="bb-th-r">Sold</th>
              <th>Remaining</th>
              <th className="bb-th-r">Sell-through</th>
              {canRequest && <th></th>}
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => {
              const status = row.status;
              const pct = row.allocatedQty ? Math.round((row.soldQty / row.allocatedQty) * 100) : 0;
              const remColor =
                status === 'out' ? 'var(--crit-text)' : status === 'low' ? 'var(--warn-text)' : 'var(--text)';
              const needsRestock = status === 'out' || status === 'low';
              return (
                <tr key={row.productId}>
                  <td>
                    <div className="bb-cell-name">{row.name}</div>
                    <div className="bb-cell-sku mono">{row.sku}</div>
                  </td>
                  <td className="bb-td-r mono bb-dim">{row.allocatedQty}</td>
                  <td className="bb-td-r mono">{row.soldQty}</td>
                  <td>
                    <span className="mono bb-wh-q" style={{ color: remColor }}>
                      {row.remaining}
                    </span>
                  </td>
                  <td className="bb-td-r mono bb-dim">{pct}%</td>
                  {canRequest && (
                    <td className="bb-td-r">
                      {needsRestock ? (
                        <Button
                          variant="ghost"
                          icon="package-plus"
                          disabled={pendingProductId === row.productId}
                          onClick={() => handleRequest(row)}
                        >
                          Request
                        </Button>
                      ) : (
                        <span className="bb-ok-tick">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={canRequest ? 6 : 5} className="bb-empty">
                  No products allocated to this booth.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
