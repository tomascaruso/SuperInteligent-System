# Decisiones del design system

- **Fuente del sistema, no externa.** Sin pipeline de fuentes, se usa el
  stack de sistema (opción prevista por la especificación).
- **Texto más oscuro que la especificación (Fase 6).** Secundario
  `#64748B` → `#5A6A80` y auxiliar `#94A3B8` → `#63738C`, para pasar
  WCAG AA en blanco y en canvas. Medido, no estimado.
- **Diálogo con radio de tarjeta (12 px).** El token `--radius-dialog`
  (16 px) existe pero el diálogo usa `--radius-card`; se mantiene el
  token para un uso futuro y se documenta el uso real.
- **Sin vista de Configuración.** No hay opciones funcionales; una
  vista vacía simularía producto.
- **Tablas a tarjetas en ≤767 px** con `data-label` por celda, en vez
  de scroll horizontal de tabla.
- **Contenido a 1200 px máximo** en pantallas anchas, sin regla
  distinta para ≥1440 px.
- **Listas limitadas a 20 en la UI** (la API permite hasta 100).
- **Sin filtros ni búsqueda en Oportunidades** y sin filtro de estado
  en Tareas en la UI: no se simulan controles sin backend.
- **Alta por invitación (C8), sin registro público:** la pantalla de
  acceso ofrece login + canje; crear invitaciones es solo API del
  operador (sin UI de operador todavía).
