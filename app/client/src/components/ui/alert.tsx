import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

type Variant = 'error' | 'success' | 'info';

const variants: Record<Variant, string> = {
  error: 'bg-danger/10 text-danger border-danger/30',
  success: 'bg-success/10 text-success border-success/30',
  info: 'bg-info/10 text-info border-info/30',
};

export interface AlertProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: Variant;
}

// Los errores usan role="alert"; los demás, aria-live polite.
// Si no hay children, no se renderiza nada (igual que :empty en
// el vanilla: un alert vacío no ocupa lugar).
export function Alert({ variant = 'error', children, ...rest }: AlertProps) {
  if (!children) return null;
  return (
    <p
      role={variant === 'error' ? 'alert' : undefined}
      aria-live={variant === 'error' ? undefined : 'polite'}
      className={cx(
        'px-3 py-2 text-sm border rounded-control',
        variants[variant],
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
