import type { InputHTMLAttributes, Ref } from 'react';
import { cx } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // React 19: ref llega como prop común; se declara para poder
  // enfocar el campo (invitación y contacto lo usan).
  ref?: Ref<HTMLInputElement>;
}

// Campo con los tokens SIS: borde, radio de control y foco con
// anillo sutil (igual que el vanilla).
export function Input({ className, ref, ...rest }: InputProps) {
  return (
    <input
      ref={ref}
      className={cx(
        'w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control',
        'disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
}
