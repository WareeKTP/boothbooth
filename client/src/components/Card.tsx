import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  pad?: boolean;
}

export function Card({ children, className = '', style, pad = true }: CardProps) {
  return (
    <div className={`bb-card ${className}`.trim()} style={{ padding: pad ? undefined : 0, ...style }}>
      {children}
    </div>
  );
}
