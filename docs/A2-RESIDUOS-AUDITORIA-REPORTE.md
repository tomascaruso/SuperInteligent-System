# A2 — Residuos de la auditoría UI 27-oct-2026 — Informe de fase

## Estado general

**COMPLETO EN LOCAL.** Los 3 residuos de la auditoría
(`docs/AUDITORIA-UI-2026-10-27.md`, pendientes tras A1) están
implementados y verificados en local. **Sin merge, sin despliegue,
sin git, sin tocar la demo pública.** La app vanilla no se tocó (MD5
de referencia intacto) y la base real local no se tocó (MD5 intacto).
Queda pendiente la decisión del usuario: subir y mergear (ver
«Autorización requerida»).

## Objetivo

Cerrar los 3 residuos y nada más: subtítulos de encabezado 4,48:1,
hover de fila fuera de Tareas 4,26:1, y `task.updated` sin citar a la
oportunidad. Sin datos inventados, sin cambios de API (todo aditivo:
un campo más en el detalle de un evento existente) y sin cambiar
decisiones del usuario (tokens del sistema intactos, textos
aprobados intactos).

## Acciones

### 1. Subtítulos de encabezado sobre fondo — HECHO (4,48:1 → 15,33:1)
- Dónde: subtítulos `text-secondary` directos sobre el fondo
  `#F7F8FC`, en los encabezados de las vistas. A1 había listado
  Inicio y Oportunidades; el mismo defecto estaba en los demás
  encabezados y se corrigió en todos: Inicio (subtítulo y línea de
  organización), Oportunidades, Tareas, Aprobaciones, Actividad,
  Agentes e Integraciones.
- Cómo: esos subtítulos usan ahora `text-ink`, la misma técnica
  angosta de A1 (el token `--color-secondary` global NO se tocó).
  Contraste medido por cálculo de luminancia: secondary sobre fondo
  4,48:1 → tinta sobre fondo 15,33:1.
- No tocados (ya pasan): los `text-secondary` dentro de tarjetas
  blancas o diálogos (4,76:1 sobre blanco).

### 2. Hover de fila fuera de Tareas — HECHO (4,26:1 → 14,55:1)
- Dónde: la tabla de Oportunidades era la única fila con hover
  pendiente. Tareas ya lo tenía corregido en R2 y Actividad ya
  tenía la misma técnica aplicada; las demás vistas usan tarjetas,
  no filas de tabla.
- Cómo: la fila de Oportunidades suma la clase `group` y sus tres
  subtextos (empresa, categoría, «Sin pendiente») suman
  `group-hover:text-ink`, la técnica sugerida por el propio informe
  A1 y ya usada en Tareas y Actividad. Sin hover ni selección, los
  subtextos siguen en secondary sobre tarjeta blanca (4,76:1);
  seleccionados, en tinta sobre primary/20 (11,94:1, sin cambios);
  en hover, en tinta sobre primary-subtle (14,55:1, antes 4,26:1).
- El hover ya correcto de Tareas no se tocó.

### 3. `task.updated` cita a la oportunidad — HECHO (solo eventos futuros)
- Hallazgo: `GET /api/audit?opportunityId=` arma la línea de tiempo
  con eventos directos (`entity_id`) más eventos relacionados que
  citan a la oportunidad en su detalle
  (`detail_json LIKE '%"opportunityId":"<id>"%'`). Así lo hacen
  `task.created` y `draft.created` (engine.ts). Pero `task.updated`
  (PATCH /api/tasks/:id, routes.ts) escribía solo
  `{ status }`: al completar una tarea, el evento no aparecía en
  la línea de tiempo de su oportunidad.
- Cómo: el PATCH ahora escribe `{ status, opportunityId:
  task.opportunity_id }`, con la tarea ya cargada por el propio
  handler (sin consulta nueva). La columna `opportunity_id` de
  `tasks` es NOT NULL, así que siempre hay a qué citar. Ningún
  otro comportamiento de tareas, auditoría o API cambia.
- Solo eventos futuros: el cambio solo afecta a los eventos que se
  escriben desde ahora; las filas viejas no se reescriben (cubierto
  por test, ver abajo).
- Tests nuevos en `app/src/a2.test.ts` (2): completar una tarea
  genera `task.updated` con `opportunityId` y la línea de tiempo
  (`GET /api/audit?opportunityId=`) lo incluye; y una fila vieja
  de `task.updated` insertada sin `opportunityId` sigue sin él
  después de completar otra tarea, mientras el evento nuevo sí lo
  cita. Ningún test existente se modificó.

## Archivos

- `app/src/routes.ts` (task.updated con opportunityId)
- `app/src/a2.test.ts` (nuevo, 2 tests)
- `app/client/src/features/inicio/HomeView.tsx` (subtítulo y
  organización a tinta)
- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (subtítulo a tinta; fila con group + group-hover en subtextos)
- `app/client/src/features/tareas/TasksView.tsx`,
  `aprobaciones/ApprovalsView.tsx`,
  `actividad/ActivityView.tsx`, `agentes/AgentsView.tsx`,
  `integraciones/IntegrationsView.tsx` (subtítulos a tinta)

## Pruebas

- `npm test` completo: **158/158 en 11 archivos** (156 previos + 2
  nuevos de A2). Ningún test existente modificado.
- `npm run build` limpio (tsc + cliente Vite).
  `tsc -p client/tsconfig.json --noEmit` limpio.
  `node --check public/app.js` OK.
- MD5 de `app/public/app.js`: `44ef9ae6daf62c3b9c335f6f2501256a` —
  **idéntico al de referencia**: vanilla intacta.
- Smoke propio en copia de DB (`/tmp/a2-smoke.db`, puerto 3493,
  proceso matado por PID exacto, sin procesos en pie al terminar):
  `/health` OK; login demo OK; 3 tareas (3 abiertas); completada
  una tarea de la copia; `GET /api/audit?opportunityId=` de su
  oportunidad muestra el `task.updated` nuevo con
  `{ status: 'done', opportunityId }` correcto; stats coherentes
  (openTasks 3→2).
- MD5 de la base real local `app/data/superinteligent.db`:
  `af175edc7673befe9b9f3ace3c556c12` — **sin cambios**.
- Contrastes recalculados: secondary sobre fondo 4,48:1 → tinta
  sobre fondo 15,33:1; secondary sobre hover 4,26:1 → tinta sobre
  hover 14,55:1; secondary sobre blanco 4,76:1 y tinta sobre fila
  seleccionada 11,94:1 sin cambios.

## Observación fuera de alcance (no corregida, queda anotada)

- El panel izquierdo del acceso nuevo (login dos paneles) tiene
  textos `text-secondary` directos sobre su fondo claro
  (`bg-canvas`): subtítulo, descriptores de los 4 rubros y primera
  línea del pie, también en 4,48:1. No se tocó porque el alcance de
  A2 era «subtítulos de encabezado de sección/vista» y el acceso
  no es una vista de sección. Si se quiere cerrar, es el mismo
  cambio de una palabra por texto (a tinta).

## Riesgos

- Sin verificación visual en vivo en esta fase (en la VM no hay
  Chromium/Playwright): los contrastes se verificaron por cálculo
  de luminancia, como en la auditoría. La confirmación visual de
  subtítulos y hover queda para la verificación post-merge.
- El punto 3 solo afecta eventos futuros: las líneas de tiempo de
  oportunidades con tareas completadas antes de este cambio seguirán
  sin mostrar esos `task.updated` viejos (no hay reescritura, por
  decisión explícita).

## Próximo paso

Revisión del usuario y, si lo aprueba, el flujo habitual de subida
y merge (snapshot de texto + verificación de PNG conservados + PR
+ merge), seguido de verificación en vivo solo lectura:
subtítulos de encabezado legibles, hover de Oportunidades legible,
y línea de tiempo de una oportunidad con el evento de tarea
completada (el evento viejo, si lo hay, seguirá sin citarla).

## Autorización requerida

Aprobar subir y mergear A2 (no hecho en esta fase, por decisión del
proyecto: sin merges ni despliegues sin autorización explícita).
