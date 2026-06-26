import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useBoothDetail } from '../../lib/queries/useBooths';
import { useSession } from '../auth/useSession';
import { formatMoney } from '../../lib/money';
import { BoothSummary } from './BoothSummary';
import { BoothTransactions } from './BoothTransactions';
import { ProductBreakdown } from './ProductBreakdown';
import { BoothInventoryTable } from './BoothInventoryTable';

/**
 * Owner-facing drill-in (and staff-own-booth fallback, guarded in router.tsx's
 * BoothDetailGuard). canRequest=false here — staff use /my-booth for the
 * request-restock affordance, per frontend-final.md §2/§6.
 */
export function BoothDetailPage() {
  const { boothId } = useParams();
  const { account } = useSession();
  const { data, isLoading, isError } = useBoothDetail(boothId);
  const navigate = useNavigate();

  if (!account) return null;
  const currency = account.expo.currency;
  const fmt = (minor: number) => formatMoney(minor, currency);

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading booth…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Booth not found.</div>
      </div>
    );
  }

  return (
    <div className="bb-screen">
      <button className="bb-back" onClick={() => navigate('/booths')}>
        <Icon name="arrow-left" size={14} /> All booths
      </button>
      <div className="bb-page-head">
        <div>
          <div className="bb-detail-cat mono">{data.booth.location.toUpperCase()}</div>
          <h1 className="bb-h1">{data.booth.name}</h1>
          <p className="bb-sub">Staffed by {data.booth.staffName}</p>
        </div>
      </div>
      <BoothSummary summary={data.summary} formatMoney={fmt} />
      <div className="bb-grid-2">
        <ProductBreakdown products={data.productBreakdown} formatMoney={fmt} />
        <BoothTransactions transactions={data.transactions} formatMoney={fmt} />
      </div>
      <BoothInventoryTable inventory={data.inventory} canRequest={false} />
    </div>
  );
}
