export type DotStatus = 'ok' | 'watch' | 'low' | 'out' | 'pending' | 'fulfilled';

/**
 * `watch` was `var(--accent)` (Expo Sky) here — DESIGN.md's One Accent Rule
 * is explicit that Expo Sky marks "active, primary, or live" only, never a
 * routine stock-level tier. `watch` is the same "below reorder point, headed
 * toward low" family as `low`/`pending` (DESIGN.md §2's Low-Stock Amber
 * description groups them), just an earlier/calmer step in it — so it stays
 * in the warn family rather than borrowing the brand accent. The "Watch" vs
 * "Low" label text already carries the severity distinction.
 */
export const STATUS_COLOR: Record<DotStatus, string> = {
  ok: 'var(--ok)',
  watch: 'var(--warn)',
  low: 'var(--warn)',
  out: 'var(--crit)',
  pending: 'var(--warn)',
  fulfilled: 'var(--ok)',
};

/**
 * Text-on-own-tint variant for Badge specifically (see tokens.css for the
 * Glare Margin Rule measurements behind --ok-text/--warn-text/--crit-text).
 * Dots/bars/chart lines keep using STATUS_COLOR — only badge text needs the
 * darker light-theme variant, since only badge text sits on its own 14%
 * tinted background rather than a neutral surface.
 */
export const STATUS_TEXT_COLOR: Record<DotStatus, string> = {
  ok: 'var(--ok-text)',
  watch: 'var(--warn-text)',
  low: 'var(--warn-text)',
  out: 'var(--crit-text)',
  pending: 'var(--warn-text)',
  fulfilled: 'var(--ok-text)',
};

interface DotProps {
  status: DotStatus;
  size?: number;
  pulse?: boolean;
}

export function Dot({ status, size = 8, pulse = false }: DotProps) {
  return (
    <span
      className={'bb-dot' + (pulse ? ' bb-dot-pulse' : '')}
      style={{ width: size, height: size, background: STATUS_COLOR[status] ?? 'var(--muted)' }}
    />
  );
}
