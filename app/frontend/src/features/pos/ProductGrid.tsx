import type { PosCatalogRow } from '../../lib/types';
import { useCart } from './useCart';
import { formatMoney } from '../../lib/money';

interface ProductGridProps {
  catalog: PosCatalogRow[];
  currency: string;
}

/**
 * Tap-to-add product grid. `remaining` is server-derived (allocated - sold);
 * the only client subtraction is remaining-minus-inCart, done inside useCart
 * per frontend-final.md §4 row 2 — this component never computes stock math.
 */
export function ProductGrid({ catalog, currency }: ProductGridProps) {
  const { lines, addToCart, remainingMinusCart } = useCart();

  if (catalog.length === 0) {
    return <div className="bb-empty bb-empty-lg">No products match.</div>;
  }

  return (
    <div className="bb-pos-grid">
      {catalog.map((p) => {
        const inCartLine = lines.find((l) => l.productId === p.productId);
        const remainingAfterCart = remainingMinusCart(p.productId, catalog);
        const out = p.remaining <= 0;
        const maxed = !out && remainingAfterCart <= 0;
        return (
          <button
            key={p.productId}
            className="bb-pcard"
            disabled={out || maxed}
            onClick={() => addToCart(p.productId, catalog)}
          >
            <div className="bb-pcard-cat mono">{p.category}</div>
            <div className="bb-pcard-name">{p.name}</div>
            <div className="bb-pcard-bot">
              <span className="bb-pcard-price mono">{formatMoney(p.priceMinor, currency)}</span>
              <span className={'bb-pcard-rem mono' + (p.remaining <= 5 ? ' low' : '')}>
                {out ? 'Sold out' : `${p.remaining} left`}
              </span>
            </div>
            {inCartLine && <span className="bb-pcard-badge mono">{inCartLine.qty}</span>}
          </button>
        );
      })}
    </div>
  );
}
