import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

// Diálogo modal compartido (R1c; va a servir en R3): ventana
// centrada sobre la vista que la abre, con overlay, botón X,
// cierre con Escape y con clic en el fondo, y TRAMPA DE FOCO
// completa: el foco inicial va al primer campo visible, Tab y
// Shift+Tab ciclan solo dentro del diálogo (excluyendo
// elementos no visibles o deshabilitados) y al cerrar el foco
// vuelve al elemento que lo tenía al abrir. El diálogo se
// renderiza solo cuando open es true; el contenido lo pasa la
// vista (título, campos, acciones). No inventa botones ni
// acciones: cerrar nunca ejecuta la acción del diálogo.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Campos de formulario: el foco inicial al abrir va a uno de
// estos, nunca al botón X de cierre (que está primero en el DOM).
const FORM_FIELD =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent !== null) return true;
  return el.getClientRects().length > 0;
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // R1f: onClose se guarda en un ref para que el efecto de abajo
  // dependa SOLO de `open`. Antes dependía de [open, onClose] y
  // onClose era una función nueva en cada render de la vista:
  // cada letra tipeada en un campo controlado re-corria el
  // efecto, su cleanup devolvía el foco al elemento previo y su
  // temporizador reenfocaba el primer enfocable del contenedor,
  // que es el botón X de cierre. Por eso tipear saltaba a la X.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
    const container = containerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial: primer campo de formulario visible; solo si
    // no hay ninguno, el primer enfocable (nunca la X a priori).
    const timer = window.setTimeout(() => {
      if (!container) return;
      const firstField = Array.from(container.querySelectorAll<HTMLElement>(FORM_FIELD)).find(isVisible);
      if (firstField) {
        firstField.focus();
        return;
      }
      const first = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).find(isVisible);
      if (first) first.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!container) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const previous = previouslyFocusedRef.current;
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
    // Solo `open`: el cleanup (restaurar foco, quitar listener)
    // corre al cerrar de verdad o desmontar, no en cada pulsación.
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar diálogo"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 cursor-default"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg bg-surface border border-border rounded-dialog shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {/* A1, P3-3: área de toque 44×44 (recomendación táctil;
              el mínimo WCAG 24 px ya se cumplía). min-h/min-w
              dominan al padding del tamaño sm sin romper el
              encabezado: el botón solo crece, no empuja el título. */}
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar diálogo" className="px-2 min-h-11 min-w-11">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
