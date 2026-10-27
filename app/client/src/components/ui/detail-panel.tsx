import { useEffect, type ReactNode } from 'react';
import { Button } from './button';

// Panel lateral de detalle compartido (R1): la composición que
// aportan las referencias (título, subtítulo, secciones apiladas,
// acciones al pie) sobre datos reales. La variante por defecto
// es un overlay a la derecha con fondo que cierra al hacer clic
// y tecla Escape; el foco inicial va al botón Cerrar. La trampa
// de foco completa llega con el Dialog de R3; esto es un panel
// de lectura, no un diálogo de decisión.
// R1b agrega la variante «inline»: una tarjeta estática en la
// grilla de la vista (sin overlay, sin fondo, sin Cerrar y sin
// Escape), para el panel derecho fijo de Oportunidades. La
// variante overlay NO cambia: sigue siendo la de arriba.
// R1c: la variante inline ya NO tiene sticky ni scroll propio
// (nada de max-height con overflow interno): acompaña a la
// página y la única barra posible es la de la página misma.
export function DetailPanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
  variant = 'overlay',
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'overlay' | 'inline';
}) {
  useEffect(() => {
    if (variant !== 'overlay' || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, variant]);

  if (variant === 'inline') {
    return (
      <aside
        aria-label={title}
        className="bg-surface border border-border rounded-card shadow-sm p-5"
      >
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        {footer && <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-2">{footer}</div>}
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar panel de detalle" onClick={onClose} className="flex-1 bg-ink/40 cursor-default" />
      <aside className="w-full max-w-md bg-surface border-l border-border overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} autoFocus>
            Cerrar
          </Button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap gap-2">{footer}</div>}
      </aside>
    </div>
  );
}
