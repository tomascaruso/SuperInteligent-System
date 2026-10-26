# Arquitectura de información

Cinco vistas por hash (`#inicio`, `#oportunidades`, `#tareas`,
`#aprobaciones`, `#actividad`), sin recarga. La navegación lateral en
escritorio pasa a horizontal superior en ≤1023 px. No hay vista de
Configuración: todavía no existen opciones funcionales que mostrar
(decisión documentada; agregarla vacía sería simular producto).

- **Inicio:** 4 indicadores reales + acciones prioritarias + actividad
  reciente. Cada indicador enlaza a su vista.
- **Oportunidades:** alta manual + tabla de oportunidades.
- **Tareas:** tareas abiertas con agente y vencimiento.
- **Aprobaciones:** borradores pendientes (con contexto y alcance) +
  borradores decididos.
- **Actividad:** auditoría reciente + procesos + ejecuciones con pasos
  bajo demanda y reintento (solo fallidas, solo admin).
- **Acceso:** login + canje de invitación (C8). Sin registro público.

Los contadores de navegación provienen de `/api/stats` y se ocultan en
cero. El título y subtítulo de cada vista cambian con la vista activa.
