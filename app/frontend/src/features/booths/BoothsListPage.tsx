import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Dot } from '../../components/Dot';
import { useBooths } from '../../lib/queries/useBooths';
import { useSession } from '../auth/useSession';
import { formatMoney } from '../../lib/money';

export function BoothsListPage() {
  const { account } = useSession();
  const { data, isLoading, isError } = useBooths();
  const navigate = useNavigate();

  if (!account) return null;
  const currency = account.expo.currency;

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading booths…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load booths. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Booths</h1>
          <p className="bb-sub">{data.length} booths · tap to view sales and inventory</p>
        </div>
      </div>
      <div className="bb-booth-grid">
        {data.map((b) => (
          <Card key={b.id} className="bb-boothcard" style={{ cursor: 'pointer' }}>
            <button className="bb-boothcard-btn" onClick={() => navigate(`/booths/${b.id}`)}>
              <div className="bb-boothcard-head">
                <div className="bb-booth-tag mono">{b.code}</div>
                <div>
                  <div className="bb-boothcard-name">{b.name}</div>
                  <div className="bb-boothcard-loc mono">{b.location}</div>
                </div>
                <Icon name="chevron-right" size={18} className="bb-row-arrow" style={{ marginLeft: 'auto' }} />
              </div>
              <div className="bb-boothcard-rev mono">{formatMoney(b.revenueMinor, currency)}</div>
              <div className="bb-boothcard-stats mono">
                <span>{b.units} units</span>
                <span>·</span>
                <span>{b.txnCount} sales</span>
                {b.lowLineCount > 0 && (
                  <span className="bb-boothcard-low">
                    <Dot status="low" size={6} /> {b.lowLineCount} low
                  </span>
                )}
              </div>
              <div className="bb-boothcard-foot">
                <span className="bb-boothcard-staff">{b.staffName}</span>
                {b.topProductName && <span className="bb-boothcard-top mono">top: {b.topProductName}</span>}
              </div>
            </button>
          </Card>
        ))}
        {data.length === 0 && <div className="bb-empty bb-empty-lg">No booths set up yet.</div>}
      </div>
    </div>
  );
}
