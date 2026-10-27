import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'default' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-border hover:border-primary',
  ghost: 'bg-transparent text-secondary hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Primitiva propia adaptada a los tokens SIS (Fase 2). Sin lógica
// de negocio: solo presentación y estado deshabilitado.
export function Button({
  variant = 'primary',
  size = 'default',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
