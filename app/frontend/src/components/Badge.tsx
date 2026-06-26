import type { ReactNode } from 'react';
import { Dot, STATUS_COLOR, STATUS_TEXT_COLOR, type DotStatus } from './Dot';

interface BadgeProps {
  status: DotStatus;
  children: ReactNode;
  subtle?: boolean;
}

/**
 * Text/border use STATUS_TEXT_COLOR (darker in light theme — see tokens.css's
 * Glare Margin Rule note) since they sit on the badge's own pale tint. The
 * tint itself and the Dot stay on the unmodified STATUS_COLOR so the hue
 * family reads the same; only the foreground text needed the extra margin.
 */
export function Badge({ status, children, subtle = false }: BadgeProps) {
  const tintBase = STATUS_COLOR[status] ?? 'var(--muted)';
  const textColor = STATUS_TEXT_COLOR[status] ?? 'var(--muted)';
  return (
    <span
      className="bb-badge"
      style={{
        color: textColor,
        background: subtle ? 'transparent' : `color-mix(in oklch, ${tintBase} 14%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tintBase} 32%, transparent)`,
      }}
    >
      <Dot status={status} size={6} />
      {children}
    </span>
  );
}
