import { Button } from '../../components/Button';
import { useDailyLog } from '../../lib/queries/useDailyLog';
import { useSession } from '../auth/useSession';
import { useToast } from '../../app/ToastContext';
import { formatMoney } from '../../lib/money';
import { downloadCsv, rowsToCsv } from '../../lib/exportCsv';
import { BoothSummary } from '../booths/BoothSummary';
import { ProductBreakdown } from '../booths/ProductBreakdown';
import { BoothTransactions } from '../booths/BoothTransactions';
import type { DailyLogDTO } from '../../lib/types';

function exportDailyLogCsv(data: DailyLogDTO, boothName: string | undefined, currency: string) {
  const fmt = (minor: number) => formatMoney(minor, currency);
  const today = new Date().toISOString().slice(0, 10);
  const rows = data.transactions.flatMap((txn) =>
    txn.items.map((item) => [
      txn.displayId,
      new Date(txn.soldAt).toLocaleTimeString(),
      item.name,
      item.qty,
      fmt(item.unitPriceMinor),
      fmt(item.qty * item.unitPriceMinor),
    ]),
  );
  const csv = rowsToCsv(['Receipt', 'Time', 'Product', 'Qty', 'Unit price', 'Line total'], rows);
  downloadCsv(`daily-log-${boothName ?? 'booth'}-${today}.csv`.replace(/\s+/g, '-'), csv);
}

/** Today only for v1 — no date param/picker, per frontend-final.md §2. */
export function DailyLogPage() {
  const { account } = useSession();
  const { data, isLoading, isError } = useDailyLog();
  const { toast } = useToast();

  if (!account) return null;
  const fmt = (minor: number) => formatMoney(minor, account.expo.currency);

  if (isLoading) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Loading daily log…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bb-screen">
        <div className="bb-empty bb-empty-lg">Couldn't load today's log. Try refreshing.</div>
      </div>
    );
  }

  return (
    <div className="bb-screen">
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Daily Log</h1>
          <p className="bb-sub">{account.booth?.name} · today</p>
        </div>
        <Button
          variant="ghost"
          icon="download"
          disabled={data.transactions.length === 0}
          onClick={() => {
            exportDailyLogCsv(data, account.booth?.name, account.expo.currency);
            toast('Daily log downloaded as CSV', 'ok');
          }}
        >
          Export day
        </Button>
      </div>
      <BoothSummary summary={data.summary} formatMoney={fmt} />
      <div className="bb-grid-2">
        <ProductBreakdown products={data.productBreakdown} formatMoney={fmt} />
        <BoothTransactions transactions={data.transactions} formatMoney={fmt} />
      </div>
    </div>
  );
}
