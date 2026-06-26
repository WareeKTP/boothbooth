import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useMyBooth } from '../../lib/queries/useBooths';
import { useSession } from '../auth/useSession';
import { formatMoney } from '../../lib/money';
import { BoothSummary } from '../booths/BoothSummary';
import { BoothInventoryTable } from '../booths/BoothInventoryTable';

/** GET /api/me/booth — same DTO shape as GET /api/booths/:boothId, staff-scoped (backend-final.md §3.7). */
export function MyBoothPage() {
  const { account } = useSession();
  const { data, isLoading, isError } = useMyBooth();
  const navigate = useNavigate();

  if (!account) return null;
  const fmt = (minor: number) => formatMoney(minor, account.expo.currency);

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading your booth…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load your booth. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">My Booth</h1>
          <p className="bb-sub">
            {data.booth.name} · {data.booth.location} · stock you're carrying today
          </p>
        </div>
        <Button variant="ghost" icon="warehouse" onClick={() => navigate('/warehouse')}>
          View warehouse
        </Button>
      </div>
      <BoothSummary summary={data.summary} formatMoney={fmt} />
      <BoothInventoryTable inventory={data.inventory} canRequest />
    </div>
  );
}
