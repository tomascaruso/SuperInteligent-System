import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

export type CardProps = HTMLAttributes<HTMLDivElement>;

// Superficie blanca con borde y radio de tarjeta (tokens SIS).
export function Card({ className, ...rest }: CardProps) {
  return (
    <div
      className={cx('bg-surface border border-border rounded-card p-6', className)}
      {...rest}
    />
  );
}
