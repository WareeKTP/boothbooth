import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { useCart } from './useCart';
import { useCheckout } from './useCheckout';
import { useToast } from '../../app/ToastContext';
import { formatMoney } from '../../lib/money';
import { ApiError } from '../../lib/apiClient';
import type { PosCatalogRow } from '../../lib/types';

interface CartSidebarProps {
  catalog: PosCatalogRow[];
  currency: string;
}

/**
 * Client-only cart, cleared on checkout success (frontend-final.md §7).
 * Idempotency-Key is generated once here, at the moment Confirm is clicked,
 * not inside the mutation function — so React Query retries of this same
 * attempt reuse it (frontend-final.md §9).
 */
export function CartSidebar({ catalog, currency }: CartSidebarProps) {
  const { lines, unitCount, setCartQty, clearCart } = useCart();
  const checkout = useCheckout();
  const { toast } = useToast();

  const cartLines = lines
    .map((l) => ({ ...l, product: catalog.find((p) => p.productId === l.productId) }))
    .filter((l) => l.product);
  const subtotal = cartLines.reduce((sum, l) => sum + (l.product?.priceMinor ?? 0) * l.qty, 0);

  const handleCheckout = async () => {
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await checkout.mutateAsync({
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        idempotencyKey,
      });
      toast(`Sale complete · ${res.displayId} · ${formatMoney(res.totalMinor, currency)}`, 'ok');
      clearCart();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'insufficient_stock') {
        toast('Some items changed stock — refresh and try again.', 'out');
      } else {
        toast("Couldn't complete the sale. Try again.", 'out');
      }
    }
  };

  return (
    <aside className="bb-cart">
      <div className="bb-cart-head">
        <h2 className="bb-h2">
          <Icon name="shopping-cart" size={16} /> Current sale
        </h2>
        {lines.length > 0 && (
          <button className="bb-link" onClick={clearCart}>
            Clear
          </button>
        )}
      </div>

      <div className="bb-cart-body">
        {cartLines.length === 0 && (
          <div className="bb-cart-empty">
            <Icon name="scan-line" size={26} />
            <span>No items yet</span>
            <small>Tap products to build the sale</small>
          </div>
        )}
        {cartLines.map((l) => (
          <div key={l.productId} className="bb-cart-line">
            <div className="bb-cart-line-info">
              <div className="bb-cart-line-name">{l.product?.name}</div>
              <div className="bb-cart-line-price mono">
                {formatMoney(l.product?.priceMinor ?? 0, currency)} × {l.qty}
              </div>
            </div>
            <div className="bb-cart-line-right">
              <div className="bb-stepper">
                <button onClick={() => setCartQty(l.productId, l.qty - 1, catalog)} aria-label="Decrease">
                  <Icon name="minus" size={13} />
                </button>
                <span className="bb-stepper-q mono">{l.qty}</span>
                <button onClick={() => setCartQty(l.productId, l.qty + 1, catalog)} aria-label="Increase">
                  <Icon name="plus" size={13} />
                </button>
              </div>
              <span className="bb-cart-line-tot mono">
                {formatMoney((l.product?.priceMinor ?? 0) * l.qty, currency)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bb-cart-foot">
        <div className="bb-cart-row">
          <span>Items</span>
          <span className="mono">{unitCount}</span>
        </div>
        <div className="bb-cart-row bb-cart-total">
          <span>Total</span>
          <span className="mono">{formatMoney(subtotal, currency)}</span>
        </div>
        <Button
          variant="solid"
          icon="check-circle"
          disabled={lines.length === 0 || checkout.isPending}
          onClick={handleCheckout}
          style={{ width: '100%', height: 48, justifyContent: 'center', fontSize: '0.95rem' }}
        >
          {checkout.isPending ? 'Completing sale…' : 'Complete sale'}
        </Button>
      </div>
    </aside>
  );
}
