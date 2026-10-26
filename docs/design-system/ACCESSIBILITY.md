# Accesibilidad (objetivo WCAG 2.2 AA)

## Implementado y verificado

- `lang="es"`, viewport sin bloqueo de zoom, títulos jerárquicos.
- Todos los campos estáticos tienen etiqueta asociada; no hay campos
  creados dinámicamente sin etiqueta. Todas las acciones son `<button>`.
- Foco visible (`:focus-visible` con contorno índigo + anillo en campos).
- Diálogo con `role="dialog"`, `aria-modal`, título asociado, foco
  inicial en Cancelar, trampa de foco, Escape, clic fuera y foco
  restaurado.
- Errores anunciados: `#error` con `role="alert"`; mensajes de sección
  con `aria-live="polite"`.
- Navegación con `aria-label` y `aria-current="page"`.
- `prefers-reduced-motion` respetado (no hay animaciones propias).
- Objetivos táctiles: botones de 40 px (32 px los pequeños).
- Contraste medido (Fase 6, pares texto/fondo):

| Par | Ratio | AA |
|---|---|---|
| Blanco sobre primario / hover / peligro | 6,29 / 7,90 / 6,47 | Sí |
| Texto principal sobre blanco / canvas | 16,27 / 15,33 | Sí |
| Secundario `#5A6A80` sobre blanco / canvas | 5,51 / 5,20 | Sí |
| Auxiliar `#63738C` sobre blanco / canvas | 4,81 / 4,54 | Sí |
| Éxito / advertencia / peligro / info sobre sus fondos | 4,79 / 4,84 / 5,91 / 6,16 | Sí |

Los tokens de texto se oscurecieron en Fase 6 porque los oficiales de
la especificación no alcanzaban AA (ver `DESIGN_TOKENS.md`).

## Pendiente (no afirmar como hecho)

- Recorrido completo por teclado en navegador real (Tab por acceso,
  vistas y diálogo): implementado en código, sin prueba manual
  registrada todavía.
- Captura de consola en navegador real (criterio QA-003).
