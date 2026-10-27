import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const variants: Record<Variant, string> = {
  neutral: 'bg-canvas text-secondary',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

// Etiqueta de estado: el texto acompaña siempre al color (nunca
// solo color, como en el vanilla).
export function Badge({ variant = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
