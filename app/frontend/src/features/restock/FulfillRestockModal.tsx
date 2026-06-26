import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useFulfillRestockRequest } from '../../lib/queries/useRestockRequests';
import { useToast } from '../../app/ToastContext';
import { ApiError } from '../../lib/apiClient';
import type { RestockRequestRow } from '../../lib/types';

interface FulfillRestockModalProps {
  request: RestockRequestRow;
  onClose: () => void;
}

/**
 * Reuses the existing Modal shell + bb-count-input stepper pattern, per
 * frontend-final.md §6 — no new modal pattern invented. On 409
 * insufficient_warehouse_stock, shows an inline error and stays open.
 */
export function FulfillRestockModal({ request, onClose }: FulfillRestockModalProps) {
  const [qty, setQty] = useState(request.requestedQty);
  const fulfill = useFulfillRestockRequest();
  const { toast } = useToast();

  const clamp = (n: number) => Math.max(1, n);

  const errorMessage =
    fulfill.error instanceof ApiError
      ? fulfill.error.code === 'insufficient_warehouse_stock'
        ? `Not enough warehouse stock to fulfill this request.`
        : fulfill.error.code === 'already_resolved'
          ? 'This request was already resolved.'
          : fulfill.error.message
      : null;

  const handleConfirm = async () => {
    const idempotencyKey = crypto.randomUUID();
    try {
      await fulfill.mutateAsync({ id: request.id, qty, idempotencyKey });
      toast(`Restock fulfilled · ${qty} units → ${request.boothCode}`, 'fulfilled');
      onClose();
    } catch {
      // inline error rendered below, modal stays open per §6
    }
  };

  return (
    <Modal
      title={`Fulfill restock — ${request.productName} → ${request.boothCode}`}
      onClose={onClose}
      width={420}
      footer={
        <div className="bb-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={fulfill.isPending}>
            Cancel
          </Button>
          <Button variant="solid" icon="check" onClick={handleConfirm} disabled={fulfill.isPending}>
            {fulfill.isPending ? 'Fulfilling…' : 'Confirm'}
          </Button>
        </div>
      }
    >
      <div className="bb-adjust-cur mono">
        Requested: <b>{request.requestedQty}</b> units
      </div>
      <div className="bb-count-input">
        <button onClick={() => setQty((q) => clamp(q - 1))} aria-label="Decrease">
          <Icon name="minus" size={15} />
        </button>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(clamp(Number(e.target.value) || 1))} />
        <button onClick={() => setQty((q) => clamp(q + 1))} aria-label="Increase">
          <Icon name="plus" size={15} />
        </button>
      </div>
      {errorMessage && (
        <div className="bb-set-row-error" role="alert">
          {errorMessage}
        </div>
      )}
    </Modal>
  );
}
