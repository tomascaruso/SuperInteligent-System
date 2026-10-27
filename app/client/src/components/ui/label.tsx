import type { LabelHTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

// Etiqueta explícita: todo campo del cliente la lleva asociada
// con htmlFor (requisito de accesibilidad del System OS).
export function Label({ className, ...rest }: LabelProps) {
  return (
    <label
      className={cx('block mb-1 text-[13px] font-medium text-ink', className)}
      {...rest}
    />
  );
}
