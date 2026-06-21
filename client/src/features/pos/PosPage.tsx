import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePosCatalog } from '../../lib/queries/usePosCatalog';
import { useSession } from '../auth/useSession';
import { ProductGrid } from './ProductGrid';
import { CartSidebar } from './CartSidebar';

export function PosPage() {
  const { account } = useSession();
  const { data, isLoading, isError } = usePosCatalog();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [cat, setCat] = useState('All');

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
        <div className="bb-empty bb-empty-lg">Loading catalog…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load the catalog. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="bb-pos">
      <div className="bb-pos-main">
        <div className="bb-page-head">
          <div>
            <h1 className="bb-h1">Sell</h1>
            <p className="bb-sub">
              {account.booth?.name} · {account.booth?.location} · tap a product to add to the sale
            </p>
          </div>
        </div>

        <div className="bb-cat-row bb-pos-cats">
          {cats.map((c) => (
            <button key={c} className={'bb-pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <ProductGrid catalog={rows} currency={account.expo.currency} />
      </div>

      <CartSidebar catalog={data} currency={account.expo.currency} />
    </div>
  );
}
