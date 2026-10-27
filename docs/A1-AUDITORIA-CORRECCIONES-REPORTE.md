# A1 — Correcciones de la auditoría UI 27-oct-2026 — Informe de fase

## Estado general

**COMPLETO EN LOCAL.** Todas las correcciones de la auditoría
(`docs/AUDITORIA-UI-2026-10-27.md`) están implementadas y verificadas en
local. **Sin merge, sin despliegue, sin git, sin tocar la demo pública.**
La app vanilla no se tocó (MD5 de referencia intacto) y la base real
local no se tocó (MD5 intacto). Queda pendiente la decisión del usuario:
subir y mergear (ver «Autorización requerida»).

## Objetivo

Corregir, en este orden, los hallazgos P1-1 (Puntaje vacío), P1-2 + P3-2
(contraste de secundarios), P1-3 (muted informativo en acceso), P2-1
(pestañas del panel) y el pulido P3, sin datos inventados, sin romper
contratos de API (todo aditivo) y sin cambiar decisiones del usuario
(colores del sistema, textos aprobados).

## Acciones

### P1-1. Puntaje vacío — HECHO
- `app/src/db.ts`: columna `score INTEGER` en el DDL de `opportunities`
  (bases nuevas) y nueva `ensureOpportunityScoreColumn(db)`, con el
  patrón portable C4/C5 (probar la columna, `ALTER` solo si falta) y
  backfill en arranque: las filas con `score IS NULL` se recalculan con
  `classifyOpportunity` sobre los campos guardados (mensaje, empresa,
  correo). No inventa nada: una fila vieja recibe exactamente el puntaje
  que su alta habría calculado. Se llama en `initSchema`.
- `app/src/engine.ts`: `OpportunityRow` suma `score: number | null`. El
  alta nueva inserta `classification.score`. Como manual, webhook,
  reintento y worker pasan todos por `runIntake`, los cuatro caminos
  quedan cubiertos con este único cambio.
- `app/src/routes.ts`: `GET /api/opportunities` y `GET
  /api/opportunities/:id` devuelven `score` (con `?? 0` defensivo: el
  backfill de arranque ya calculó las filas viejas y 0 es el piso
  legítimo del clasificador). El alta ya lo devolvía vía el objeto
  releído tras el insert.
- El panel de Oportunidades ya renderizaba `selected.score`: no hubo
  que tocarlo; ahora muestra el número.
- Tests nuevos en `app/src/a1.test.ts` (4): alta manual con puntaje 6
  (urgente +2, presupuesto +1, empresa +1, dominio corporativo +1,
  categoría no general +1), webhook con puntaje 2, alta duplicada que
  recalcula el puntaje con el mensaje nuevo, y backfill sobre una fila
  vieja insertada sin score. Ningún test existente se modificó.

### P1-2. Secundario sobre fila seleccionada — HECHO
- `features/oportunidades/OpportunitiesView.tsx`: en la fila
  seleccionada, los subtextos (empresa, categoría, «Sin pendiente»)
  usan `text-ink` en vez de `text-secondary`. Contraste resultante
  11,94:1 (antes 3,49:1). Fuera de la fila seleccionada no cambia nada.

### P3-2. Secundario sobre fondo de página — HECHO (angosto)
- Los dos «Cargando…» que van directo sobre el fondo `#F7F8FC`
  (`HomeView`, `OpportunitiesView`) usan `text-ink` (15,33:1, antes
  4,48:1). El token `--color-secondary` global NO se tocó.
- Textos secundarios directos sobre fondo encontrados y NO tocados, por
  el alcance angosto pedido (quedan listados para decidir aparte, todos
  en 4,48:1, apenas por debajo de AA): subtítulo y línea de
  organización del encabezado de Inicio, y subtítulo del encabezado de
  Oportunidades. El resto de los `text-secondary` vive dentro de
  tarjetas blancas o diálogos (4,76:1, pasa).

### P1-3. Muted informativo en acceso — HECHO
- `features/auth/LoginScreen.tsx`: los cuatro párrafos informativos en
  `text-muted` (explicación de la invitación, línea de la cuenta demo,
  «¿No tenés una cuenta?», introducción del contacto) pasan a
  `text-secondary` (4,76:1 sobre blanco, antes 2,56:1).
- Quedan en muted, como decorativos: «by PENSIA» y las etiquetas del
  mini-dashboard (ese bloque es `aria-hidden`, presentación estática).

### P2-1. Pestañas del panel — HECHO
- El `Tabs` del panel de detalle de Oportunidades pasa de
  `scrollable={false}` (flex-wrap, «Actividad» caía a segunda línea) a
  pestañas con desplazamiento horizontal. Las etiquetas no cambian.

### P3 (pulido) — HECHO, salvo lo indicado
- `Table`: `th` con `scope="col"`.
- `SectionPlaceholder`: `h1` en vez de `h2` (ya no hay vistas sin `h1`).
- `client/index.html`: título neutro «SuperInteligent System» (antes
  «… — Acceso», fijo aun con sesión iniciada).
- Botón X del diálogo: área de toque 44×44 (`min-h-11 min-w-11` sobre
  el tamaño sm; el encabezado no se rompe: el botón solo crece).
  Verificado en el CSS construido (`min-height: calc(var(--spacing) *
  11)`).
- Paneles de pestañas: salió limpio. `Tabs` acepta `idPrefix` opcional
  (id + `aria-controls` en cada pestaña) y el panel de Oportunidades
  envuelve su contenido en un `tabpanel` enlazado. Sin cambios en el
  render condicional (un único envoltorio alrededor de las cuatro
  ramas).
- P3-7 (píldora de atención): NO tocada, como se pidió (sin acción
  salvo que el usuario la marque de nuevo).
- P3-6 (logos): SÍ se hizo, porque PIL estaba disponible en la VM.
  Mismo nombre, misma proporción, transparencia RGBA intacta
  (alfa 0–255 verificado), mismo lockup (solo reescalado LANCZOS):
  `sis-logo.png` 865×411, 187 KB → 560×266, 93 KB; `sis-mark.png`
  358×312, 73 KB → 64×56, 5 KB. Copias de los originales en
  `/tmp/a1-logo-backup/` (efímero). OJO para el merge: como los PNG
  cambiaron, el paso de subir binarios por la web de GitHub esta vez
  es obligatorio, no solo de verificación.

## Archivos

- `app/src/db.ts` (columna, backfill, llamada en `initSchema`)
- `app/src/engine.ts` (`OpportunityRow.score`, insert, alta duplicada)
- `app/src/routes.ts` (score en los dos GET de oportunidades)
- `app/src/a1.test.ts` (nuevo, 4 tests)
- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (P1-2, P3-2, P2-1, tabpanel)
- `app/client/src/features/inicio/HomeView.tsx` (P3-2)
- `app/client/src/features/auth/LoginScreen.tsx` (P1-3)
- `app/client/src/components/ui/table.tsx` (scope)
- `app/client/src/components/ui/tabs.tsx` (idPrefix)
- `app/client/src/components/ui/dialog.tsx` (X 44×44)
- `app/client/src/features/sections/SectionPlaceholder.tsx` (h1)
- `app/client/index.html` (título neutro)
- `app/client/src/assets/sis-logo.png`, `sis-mark.png` (reescalados)

## Pruebas

- `npm test` completo: **139/139 en 9 archivos** (135 previos + 4
  nuevos de A1). Ningún test existente modificado.
- `npm run build` limpio (tsc + cliente Vite). `node --check
  public/app.js` OK.
- MD5 de `app/public/app.js`: `44ef9ae6daf62c3b9c335f6f2501256a` —
  **idéntico al de referencia**: vanilla intacta.
- Smoke propio en copia de DB (`/tmp/a1-smoke.db`, puerto 3457,
  proceso matado por PID exacto, sin procesos en pie al terminar):
  `/health` OK; login demo OK; alta manual (camelCase) con mensaje
  urgente + presupuesto + empresa + dominio corporativo devolvió
  `score: 6`, categoría automatización, prioridad high; la lista
  devolvió `score` entero en todas las filas, incluidas las viejas
  (backfill al arrancar sobre la copia); `/v2/` sirve el título
  neutro; el JS/CSS construido contiene `opp-detail-panel`,
  `opp-detail-tab`, `tabpanel`, `min-h-11`/`min-w-11` (44 px) y los
  assets nuevos del logo (93 KB / 5 KB).
- MD5 de la base real local `app/data/superinteligent.db`:
  `af175edc7673befe9b9f3ace3c556c12` — **sin cambios**.
- Contrastes recalculados tras el cambio: tinta sobre fila
  seleccionada 11,94:1; tinta sobre fondo 15,33:1; secondary sobre
  blanco 4,76:1; badges blanco sobre color 5,02–6,70:1 (sin cambios).

## Evidencia

- Corrección P1-1 cazada por los tests: el primer intento del test de
  alta duplicada falló (devolvía el puntaje viejo) porque el camino
  duplicado devuelve el objeto leído antes de actualizar. Se corrigió
  sincronizando el objeto en memoria (`opp.score =
  classification.score`) tras el UPDATE; los 4 tests pasan.
- No se ejecutó ningún comando git, ni push, PR, merge o despliegue.

## Decisiones

- Columna `score` nullable (no `NOT NULL DEFAULT 0`): el NULL es el
  marcador de «fila vieja» que hace posible el backfill, igual que
  `opportunity_id` en H1. Un `DEFAULT 0` habría mezclado filas viejas
  con puntajes reales de 0 (Ana Ruiz) y el backfill no podría
  distinguirlas.
- En la alta duplicada se actualiza solo el puntaje, no categoría ni
  prioridad: ese camino nunca las tocaba y cambiarlo excedía el
  alcance de A1.
- Residual honesto, no tocado por alcance: en hover, la fila usa fondo
  `primary-subtle` y el secundario queda en 4,26:1 (estado transitorio).
  Si se quiere cerrar, la misma técnica de P1-2 sirve
  (`group-hover:text-ink`), pero no se aplicó sin aprobación.
- Los subtítulos de encabezado sobre fondo (4,48:1) quedan listados
  arriba como pendientes de decisión, no tocados.

## Riesgos

- La migración `ALTER TABLE ... ADD COLUMN score INTEGER` es portable
  SQLite/Postgres (misma forma que las migraciones C4/C6/H1) y la
  suite incluye los tests de Postgres, que pasaron.
- Los PNG reescalados cambian los hashes de los assets construidos: en
  la verificación en vivo post-merge hay que confirmar que el logo del
  acceso y la marca de la cabecera se ven igual que antes (misma
  proporción, solo menor resolución interna: 560 px para una muestra
  de 280 px, 64 px para una de ~25 px, ambas 2x).
- Sin verificación visual en vivo en esta fase (es solo local): la
  confirmación visual de pestañas, fila seleccionada y X queda para la
  verificación post-merge.

## Próximo paso

Revisión del usuario y, si lo aprueba, el flujo habitual de subida y
merge (snapshot de texto + subida de los dos PNG por la web de
GitHub, obligatoria esta vez por el cambio de binarios + PR + merge),
seguido de verificación en vivo solo lectura: panel de Oportunidades
con puntaje visible, pestañas en una línea con scroll, fila
seleccionada legible, acceso con textos en secondary y logo/marca
intactos.

## Autorización requerida

Aprobar subir y mergear A1 (no hecho en esta fase, por decisión del
proyecto: sin merges ni despliegues sin autorización explícita).
