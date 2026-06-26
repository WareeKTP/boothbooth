import type { DotStatus } from './Dot';
import { STATUS_COLOR } from './Dot';

interface StatProps {
  value: string | number;
  label: string;
  delta?: string;
  status?: DotStatus;
}

export function Stat({ value, label, delta, status }: StatProps) {
  return (
    <div className="bb-stat">
      <div className="bb-stat-top">
        <span className="bb-stat-val mono">{value}</span>
        {delta != null && (
          <span className="bb-stat-delta" style={{ color: status ? STATUS_COLOR[status] : 'var(--muted)' }}>
            {delta}
          </span>
        )}
      </div>
      <div className="bb-stat-label">{label}</div>
    </div>
  );
}
