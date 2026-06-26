import { Icon } from '../../components/Icon';
import { Card } from '../../components/Card';

export interface ChartSeriesPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  label: string;
  color: string;
  points: ChartSeriesPoint[];
}

interface ChartBoothSalesProps {
  series: ChartSeries[];
  formatValue: (minor: number) => string;
}

const W = 760;
const H = 300;
const PAD_L = 60;
const PAD_R = 92;
const PAD_T = 18;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Hand-rolled SVG line chart — no charting library, per frontend-final.md §5.
 * Pinned contract: caller passes `points` as plain {x,y} pairs already
 * reshaped from boothSeries (DashboardPage does the adapter, this component
 * does zero data derivation).
 */
export function ChartBoothSales({ series, formatValue }: ChartBoothSalesProps) {
  const maxX = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.x)));
  const maxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));

  const xAt = (x: number) => PAD_L + (x / maxX) * PLOT_W;
  const yAt = (y: number) => PAD_T + PLOT_H - (y / maxY) * PLOT_H;

  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="line-chart" size={15} /> Booth sales comparison
        </h2>
        <div className="bb-chart-legend">
          {series.map((s) => {
            const last = s.points.at(-1);
            return (
              <span key={s.label} className="bb-legend-item">
                <span className="bb-legend-dot" style={{ background: s.color }} />
                {s.label} <b className="mono">{formatValue(last?.y ?? 0)}</b>
              </span>
            );
          })}
        </div>
      </div>
      <div className="bb-chart-wrap">
        <svg
          className="bb-chart"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Cumulative sales by booth"
        >
          {TICKS.map((t) => {
            const y = PAD_T + PLOT_H - t * PLOT_H;
            return (
              <g key={t}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
                <text x={PAD_L - 10} y={y + 4} textAnchor="end" className="bb-chart-tick">
                  {formatValue(Math.round(maxY * t))}
                </text>
              </g>
            );
          })}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="var(--line)" strokeWidth="1" />
          {series.map((s) => {
            const points = s.points.map((p) => `${xAt(p.x)},${yAt(p.y)}`).join(' ');
            const last = s.points.at(-1);
            return (
              <g key={s.label}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {last && (
                  <>
                    <circle cx={xAt(last.x)} cy={yAt(last.y)} r="3.5" fill={s.color} />
                    <text x={xAt(last.x) + 9} y={yAt(last.y) + 4} className="bb-chart-end" style={{ fill: s.color }}>
                      {s.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <text x={PAD_L} y={H - 8} className="bb-chart-axis">
            Start of day
          </text>
          <text x={W - PAD_R} y={H - 8} textAnchor="end" className="bb-chart-axis">
            Now →
          </text>
        </svg>
      </div>
    </Card>
  );
}
