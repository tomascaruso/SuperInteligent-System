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
  // R1h: compacto usa 11 px en vez de 12 px. Es prop (no
  // className) a propósito: cx() concatena sin resolver
  // conflictos, así que un text-[11px] agregado por className
  // competiría con text-xs según el orden del CSS construido
  // y no sería determinista. Por defecto sigue en 12 px.
  compact?: boolean;
}

// Etiqueta de estado: el texto acompaña siempre al color (nunca
// solo color, como en el vanilla).
export function Badge({ variant = 'neutral', compact = false, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center px-2 py-0.5 rounded-full font-medium',
        compact ? 'text-[11px]' : 'text-xs',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
