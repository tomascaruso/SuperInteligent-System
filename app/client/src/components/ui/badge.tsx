import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// R1e: colores sólidos con texto blanco (más vivos que los
// tintes /10 anteriores), con los tokens SIS existentes.
const variants: Record<Variant, string> = {
  neutral: 'bg-slate-500 text-white',
  info: 'bg-info text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
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
