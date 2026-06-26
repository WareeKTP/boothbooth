import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { PosCatalogRow } from '../../lib/types';

export interface CartLine {
  productId: string;
  qty: number;
}

type CartAction =
  | { type: 'add'; productId: string; maxQty: number }
  | { type: 'setQty'; productId: string; qty: number; maxQty: number }
  | { type: 'clear' };

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      if (action.maxQty <= 0) return state;
      const existing = state.find((l) => l.productId === action.productId);
      if (existing) {
        if (existing.qty >= action.maxQty) return state;
        return state.map((l) => (l.productId === action.productId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...state, { productId: action.productId, qty: 1 }];
    }
    case 'setQty': {
      const clamped = Math.max(0, Math.min(action.qty, action.maxQty));
      if (clamped <= 0) return state.filter((l) => l.productId !== action.productId);
      const existing = state.find((l) => l.productId === action.productId);
      if (!existing) return clamped > 0 ? [...state, { productId: action.productId, qty: clamped }] : state;
      return state.map((l) => (l.productId === action.productId ? { ...l, qty: clamped } : l));
    }
    case 'clear':
      return [];
    default:
      return state;
  }
}

interface CartContextValue {
  lines: CartLine[];
  unitCount: number;
  addToCart: (productId: string, catalog: PosCatalogRow[]) => void;
  setCartQty: (productId: string, qty: number, catalog: PosCatalogRow[]) => void;
  clearCart: () => void;
  /** Display-only optimism: remaining minus what's already sitting in cart.
   *  Not authoritative — checkout re-validates server-side regardless.
   *  See frontend-final.md §4 row 2. */
  remainingMinusCart: (productId: string, catalog: PosCatalogRow[]) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart is client-only, scoped to the staff session, cleared on checkout
 * success or logout. No draft-order endpoint exists. frontend-final.md §7.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, []);

  const maxQtyFor = (productId: string, catalog: PosCatalogRow[]) =>
    catalog.find((p) => p.productId === productId)?.remaining ?? 0;

  const addToCart = useCallback((productId: string, catalog: PosCatalogRow[]) => {
    dispatch({ type: 'add', productId, maxQty: maxQtyFor(productId, catalog) });
  }, []);

  const setCartQty = useCallback((productId: string, qty: number, catalog: PosCatalogRow[]) => {
    dispatch({ type: 'setQty', productId, qty, maxQty: maxQtyFor(productId, catalog) });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: 'clear' }), []);

  const remainingMinusCart = useCallback(
    (productId: string, catalog: PosCatalogRow[]) => {
      const remaining = catalog.find((p) => p.productId === productId)?.remaining ?? 0;
      const inCart = lines.find((l) => l.productId === productId)?.qty ?? 0;
      return remaining - inCart;
    },
    [lines],
  );

  const unitCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({ lines, unitCount, addToCart, setCartQty, clearCart, remainingMinusCart }),
    [lines, unitCount, addToCart, setCartQty, clearCart, remainingMinusCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
