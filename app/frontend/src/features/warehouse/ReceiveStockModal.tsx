import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useReceiveStock } from '../../lib/queries/useWarehouse';
import { useToast } from '../../app/ToastContext';
import type { WarehouseRow } from '../../lib/types';

interface ReceiveStockModalProps {
  product: WarehouseRow;
  onClose: () => void;
}

/**
 * Owner-only. POST /api/warehouse/receive ADDS `units` to warehouse_qty
 * (backend-final.md §3.5) — this is a delta input, not an absolute-value
 * editor, so the preview shows "current -> current + units".
 */
export function ReceiveStockModal({ product, onClose }: ReceiveStockModalProps) {
  const [units, setUnits] = useState(10);
  const receiveStock = useReceiveStock();
  const { toast } = useToast();

  const clamp = (n: number) => Math.max(1, n);
  const newQty = product.warehouseQty + units;

  const handleConfirm = async () => {
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await receiveStock.mutateAsync({ productId: product.productId, units, idempotencyKey });
      toast(`Received ${units} units of ${product.name} · warehouse now ${res.warehouseQty}`, 'ok');
      onClose();
    } catch {
      // error surfaced inline below, modal stays open
    }
  };

  return (
    <Modal
      title={`Receive stock — ${product.name}`}
      onClose={onClose}
      width={420}
      footer={
        <div className="bb-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={receiveStock.isPending}>
            Cancel
          </Button>
          <Button variant="solid" icon="check" onClick={handleConfirm} disabled={receiveStock.isPending}>
            {receiveStock.isPending ? 'Receiving…' : 'Confirm'}
          </Button>
        </div>
      }
    >
      <div className="bb-adjust-cur mono">
        Current warehouse stock: <b>{product.warehouseQty}</b>
      </div>
      <div className="bb-count-input">
        <button onClick={() => setUnits((u) => clamp(u - 1))} aria-label="Decrease">
          <Icon name="minus" size={15} />
        </button>
        <input
          type="number"
          min={1}
          value={units}
          onChange={(e) => setUnits(clamp(Number(e.target.value) || 1))}
        />
        <button onClick={() => setUnits((u) => clamp(u + 1))} aria-label="Increase">
          <Icon name="plus" size={15} />
        </button>
      </div>
      <div className="bb-adjust-preview mono">
        {product.warehouseQty} + {units} → {newQty}
      </div>
      {receiveStock.isError && (
        <div className="bb-set-row-error" role="alert">
          Couldn't receive stock. Try again.
        </div>
      )}
    </Modal>
  );
}
