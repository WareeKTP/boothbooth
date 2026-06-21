import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children: ReactNode;
  variant?: 'ghost' | 'solid' | 'danger';
  icon?: IconName;
  style?: CSSProperties;
}

export function Button({ children, variant = 'ghost', icon, style, className = '', ...rest }: ButtonProps) {
  return (
    <button className={`bb-btn bb-btn-${variant} ${className}`.trim()} style={style} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}
