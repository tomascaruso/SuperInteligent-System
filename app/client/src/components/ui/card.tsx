import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

export type CardProps = HTMLAttributes<HTMLDivElement>;

// Superficie blanca con borde y radio de tarjeta (tokens SIS).
// R1c: con compact=true el padding es p-4 en vez de p-6; sin
// ella la tarjeta es la de siempre.
export function Card({ className, compact, ...rest }: CardProps & { compact?: boolean }) {
  return (
    <div
      className={cx('bg-surface border border-border rounded-card', compact ? 'p-4' : 'p-6', className)}
      {...rest}
    />
  );
}
