# Tokens de diseño (reales, de `app/public/styles/tokens.css`)

## Colores

| Token | Valor | Uso |
|---|---|---|
| `color-primary` | `#4F46E5` | Acciones primarias, foco |
| `color-primary-hover` | `#4338CA` | Hover primaria |
| `color-primary-subtle` | `#EEF2FF` | Fondos suaves, selección |
| `color-text-primary` | `#172033` | Texto principal |
| `color-text-secondary` | `#5A6A80` | Texto secundario (ver desviación) |
| `color-text-muted` | `#63738C` | Información auxiliar (ver desviación) |
| `color-surface` | `#FFFFFF` | Superficies |
| `color-canvas` | `#F7F8FC` | Fondo general |
| `color-border` | `#E2E8F0` | Bordes |
| `color-success` / `bg` | `#15803D` / `#F0FDF4` | Éxito |
| `color-warning` / `bg` | `#B45309` / `#FFFBEB` | Advertencia |
| `color-danger` / `bg` | `#B91C1C` / `#FEF2F2` | Error |
| `color-info` / `bg` | `#1D4ED8` / `#EFF6FF` | Información |

**Desviación documentada (Fase 6):** la especificación pedía secundario
`#64748B` y auxiliar `#94A3B8`. Medidos, el secundario daba 4,48:1 sobre
canvas (bajo el 4,5:1 de WCAG AA) y el auxiliar 2,56:1 sobre blanco. Los
valores actuales pasan AA en blanco y en canvas: secundario 5,51:1 /
5,20:1; auxiliar 4,81:1 / 4,54:1. El resto de los pares (botones, badges,
alertas) pasa AA; ver la tabla completa en `ACCESSIBILITY.md`.

## Tipografía, espaciado, radios y sombras

Ver `VISUAL_FOUNDATIONS.md`. Breakpoints de referencia: móvil <640,
tablet 640–1023, escritorio 1024–1439, ancho ≥1440 (el CSS usa literales;
ver `RESPONSIVE_BEHAVIOR.md`).
