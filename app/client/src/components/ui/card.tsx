import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

export type CardProps = HTMLAttributes<HTMLDivElement>;

// Superficie blanca con borde y radio de tarjeta (tokens SIS).
// R1c: con compact=true el padding es p-4 en vez de p-6; sin
// ella la tarjeta es la de siempre.
export function Card({ className, compact, pad, ...rest }: CardProps & { compact?: boolean; pad?: string }) {
  return (
    <div
      // R1g: pad explícito reemplaza al padding por defecto
      // (sin convivir con él, para que no haya dos paddings
      // en conflicto). Solo lo usa la tarjeta de la tabla de
      // Oportunidades (p-3); el resto no cambia.
      className={cx('bg-surface border border-border rounded-card', pad ?? (compact ? 'p-4' : 'p-6'), className)}
      {...rest}
    />
  );
}
