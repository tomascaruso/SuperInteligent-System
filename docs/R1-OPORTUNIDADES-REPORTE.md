# R1: Vista Oportunidades real + logo — REPORTE

**Fecha:** 27-oct-2026 (madrugada, ART)
**Brief:** `docs/REFERENCIAS-VISUALES-DIAGNOSTICO.md` (sección 5
Oportunidades, C sistema de diseño, D fase R1) y decisión de
Tomás 27-oct-2026 ~00:40 («nono, adaptalo»: el logo SÍ se
adapta) + aprobación R1 27-oct-2026 ~00:41.
**Base:** main `42537e6a` (Fases 2–4, PR #43).
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
commits (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni
`.github/workflows`. La demo pública no cambia: el vanilla
sigue en `/` y el cliente React vive en `/v2/`.

## Estado general

Dos trabajos encadenados, en orden: primero el logo
(completo, incluido su build) y después R1. La vista
`/oportunidades` en /v2/ ya no es un placeholder: es la
tabla real + panel de detalle lateral con la composición de
la referencia, alimentada solo con datos reales. Las otras 4
secciones siguen como placeholders, sin tocar.

## Trabajo 1 — Adaptar el logo

**Fuente:** `~/workspace/user/media_library/image/79/796f73b56e7b80bb7ddafb07be34830008e1d363e31bcdcd63300ff932c7991c.png`
(PNG 1254×1254 RGBA con transparencia real, lockup completo:
marca remolino degradado + «SIS» + «SuperIntelligent
System» + «by PENSIA»).

**Assets en el repo (importados desde el código; Vite los
hashea en el build):**

- `app/client/src/assets/sis-logo.png` (1137×1040): lockup
  completo recortado a su contenido real (bounding box de
  alfa > 0: x 87–1224, y 27–1067). Se usa en el panel de
  marca de la pantalla de acceso.
- `app/client/src/assets/sis-mark.png` (208×271): solo la
  marca (componente conexo mayor del análisis de alfa: x
  197–389, y 407–662, con 8 px de aire). Se usa en la
  cabecera del layout, junto al texto tipográfico «SIS»
  existente.

**Cambios:**

- `LoginScreen`: el panel de marca muestra el lockup
  (`<img>` con alt «SIS — SuperIntelligent System by
  PENSIA», 280 px de ancho, `aspect-ratio: 1137 / 1040`
  para no saltar el layout). El resto de la pantalla no
  cambia: sin «Recordarme» ni «¿Olvidaste tu contraseña?»
  (no hay backend para eso), sin cambios de login, rutas ni
  auth.
- `AppLayout`: la cabecera muestra la marca (32 px de alto,
  decorativa con `alt=""` porque el texto «SIS» adyacente
  ya la nombra) + el texto tipográfico existente
  («SIS SuperIntelligent System by PENSIA»). El lockup
  completo a 32 px sería ilegible; por eso va solo la marca.

**Verificación del trabajo 1:** ambos PNG quedaron listados
por `git ls-files --others` (no ignorados: viajan en el
próximo push) y el build de Vite los emite hasheados
(`sis-logo-BEwAISMD.png`, `sis-mark-oX-c7FCy.png`) con base
`/v2/`; el smoke los sirvió en 200 (la lista blanca de
`/v2/*` ya incluía `png`).

## Trabajo 2 — R1: vista Oportunidades real

**Qué muestra y de qué endpoint sale:**

- **Título:** «Oportunidades» + subtítulo «Oportunidades
  comerciales y alta manual.» (textos del vanilla).
- **Alta manual** (`POST /api/opportunities`, mismo
  formulario del vanilla): Nombre de contacto (requerido),
  Correo de contacto (requerido, email), Empresa
  (opcional), Mensaje (requerido). Errores del servidor se
  muestran tal cual; éxito: «Oportunidad creada.» o, si el
  servidor marcó duplicado, «La oportunidad ya estaba
  registrada.» (el vanilla decía siempre «creada»; acá se
  usa la marca real `duplicate` de la respuesta). Tras
  crear, se limpia el formulario y se recarga la lista.
- **Tabla** (`GET /api/opportunities`, hasta 100, orden
  `created_at` DESC): Contacto, Empresa, Categoría (con su
  etiqueta: `general` → «Consulta general»), Prioridad
  (badge Alta/Media/Baja), Estado (badge Nueva/Borrador de
  propuesta/En seguimiento), Canal (Alta manual/Entrada
  externa/No disponible) y Próximo paso: título de la tarea
  abierta más próxima de esa oportunidad (derivado de
  `GET /api/tasks`, que ya viene ordenado por vencimiento
  ascendente; sin tarea abierta muestra «—»). Clic en una
  fila (o Enter/Espacio con foco) abre el detalle.
- **Buscador y filtros en cliente** (el servidor no expone
  query params para esto): texto sobre contacto/empresa/
  mensaje, Estado, Prioridad y Fuente (opciones = las
  fuentes distintas presentes en los datos, con su
  etiqueta). Botón «Limpiar».
- **Paginación en cliente** (20 por página): «Mostrando X
  a Y de Z» + Anterior/Siguiente.
- **Panel de detalle lateral** (componente compartido
  `DetailPanel`: overlay derecho con cierre X, clic en el
  fondo y tecla Escape; foco inicial en Cerrar) con
  pestañas (componente compartido `Tabs`; solo pestañas
  con contenido real):
  - **Resumen:** contacto, correo, empresa, mensaje,
    canal, estado, puntaje (`score`), creada y
    actualizada (fechas en zona local). Nota honesta: el
    puntaje sale de reglas deterministas y su desglose por
    oportunidad no queda guardado.
  - **Borrador:** el borrador vigente de la oportunidad
    (los borradores vienen `created_at` DESC, se toma el
    primero), con su estado (Pendiente de aprobación/
    Aprobada/Rechazada), marcas Vencido/Desactualizado con
    los textos del vanilla, cuerpo real y, si está
    decidido, quién, cuándo y motivo. Se llama
    «Borrador», nunca «Borrador IA» (veredicto F2-AI
    DISCARD). Sin borrador: «Sin borrador para esta
    oportunidad.»
  - **Tareas:** tareas de la oportunidad con título,
    estado (Abierta/Hecha), agente (`agent_name` o
    `assigned_to`, como el vanilla) y vencimiento.
  - **Actividad:** eventos de
    `GET /api/audit?opportunityId=` (se cargan al abrir el
    panel, una vez por oportunidad) con el formato del
    vanilla. Si el borrador está pendiente, el pie del
    panel enlaza a «Revisar borrador en Aprobaciones».
- **Estados:** cargando («Cargando…»); error (Alert con
  `role="alert"` + «Reintentar», sin datos falsos); vacío
  de lista con el texto del vanilla («Aún no hay
  oportunidades. Creá la primera con el formulario de alta
  manual.»); sin resultados para los filtros, texto
  propio. 401 → pantalla de acceso («La sesión expiró.»),
  como el vanilla. La píldora de estado se actualiza con
  la carga de la vista.

**Criterios aprobados respetados (omitidos a propósito):**
sin columna «Agente IA Asignado», sin valor estimado,
probabilidad ni fecha de cierre, sin «Atención humana»
como columna, sin desglose generado por IA, sin pestaña
«AI Breakdown». Clientes e Integraciones fuera de
alcance. Nada de datos ficticios ni botones decorativos.

**Componentes compartidos nuevos** (reutilizables por las
demás vistas): `Table`, `DetailPanel`, `FilterBar`,
`Tabs`, `Pagination` en `app/client/src/components/ui/`.
Primitivas existentes reutilizadas: button, input, label,
badge, card, alert. Etiquetas nuevas en `lib/format.ts`
(`statusLabel`, `channelLabel`, `draftStatusLabel`,
copiadas del vanilla). Fetchers nuevos en `lib/api.ts`
con los shapes reales de `routes.ts` (sin tocar los
existentes): `getOpportunityList`, `getAllTasks`,
`getDraftsDetail`, `getOpportunityAudit`,
`createOpportunity`.

## Archivos creados

- `app/client/src/assets/sis-logo.png`
- `app/client/src/assets/sis-mark.png`
- `app/client/src/components/ui/table.tsx`
- `app/client/src/components/ui/detail-panel.tsx`
- `app/client/src/components/ui/filter-bar.tsx`
- `app/client/src/components/ui/tabs.tsx`
- `app/client/src/components/ui/pagination.tsx`
- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
- `docs/R1-OPORTUNIDADES-REPORTE.md` (este informe)

## Archivos modificados

- `app/client/src/features/auth/LoginScreen.tsx` (marca
  del panel de marca → lockup; resto intacto)
- `app/client/src/components/layout/AppLayout.tsx`
  (marca en cabecera; resto intacto)
- `app/client/src/App.tsx` (ruta /oportunidades →
  OpportunitiesView)
- `app/client/src/lib/api.ts` (5 fetchers nuevos + tipos;
  lo existente intacto)
- `app/client/src/lib/format.ts` (3 etiquetas nuevas)
- `app/src/server.test.ts` (import `readdirSync` + 3
  marcadores nuevos de R1; ningún test viejo tocado ni
  borrado)

## No tocado (verificable)

- `app/public/` (vanilla intacto: verificado que
  `app.js` local es idéntico al de `main`), backend, DB,
  auth, permisos, APIs, `render.yaml`,
  `.github/workflows`. Los `M app/public/*` y `M
  app/src/routes.ts` que muestra `git status` local son
  el artefacto conocido del modelo snapshot (el HEAD
  local `8febe8a` no avanza con los merges); esta fase
  no modificó `routes.ts`. Sin dependencias nuevas (19,
  igual que antes).

## Pruebas y evidencia (todo con números reales)

- Typecheck combinado (servidor + cliente): limpio.
- Build cliente (Vite): OK en 3,57 s (JS 303,74 kB, CSS
  14,12 kB; assets con base `/v2/`, incluidos los dos PNG
  del logo). Build servidor (`tsc`): limpio.
  `node --check public/app.js`: OK.
- Suite vitest: **123/123** (120 previos + 3 marcadores
  nuevos de R1: el JS construido referencia los assets
  `sis-logo-`/`sis-mark-` y `.png`; contiene los textos
  reales («Oportunidades comerciales y alta manual»,
  «Nueva oportunidad (alta manual)», «Crear oportunidad»,
  «Próximo paso», «Aún no hay oportunidades»,
  «Mostrando»); y `GET /v2/assets/<sis-logo>` → 200).
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID):
  `/health` → `{"status":"ok"}`; `/v2` → 302 a `/v2/`;
  `/v2/` → 200; asset JS → 200; asset CSS → 200;
  `sis-logo-BEwAISMD.png` → 200;
  `sis-mark-oX-c7FCy.png` → 200; `/` → 200 (vanilla
  intacto); `POST /api/auth/login` con la cuenta demo →
  200; `GET /api/opportunities` con esa sesión → 200 con
  3 oportunidades en la DB local copiada (primera: Ana
  Ruiz, por `created_at` DESC). (La DB local no es la de
  la demo pública; los valores se reportan tal cual.)

## Qué funciona y qué no

- Funciona: logo en acceso y cabecera (assets hasheados
  servidos en 200), vista Oportunidades real con tabla,
  filtros, paginación, detalle con 4 pestañas y alta
  manual, píldora de estado actualizada por la carga,
  401 → acceso, error con reintento sin datos falsos, y
  todo lo de las Fases 2–4 intacto.
- No funciona todavía (por diseño de la fase): las otras
  4 secciones siguen como placeholders (eso es el resto
  de R2–R5); el click-through (logo visible, navegación,
  detalle, alta) no se puede probar sin navegador (queda
  para la verificación en vivo post-merge).

## Limitaciones y riesgos pendientes

- **Click-through sin probar:** sin navegador no se
  puede probar el flujo clicado (logo visible en acceso
  y cabecera, filas que abren el detalle, pestañas, alta
  manual). Queda para la verificación en vivo post-merge.
- **DetailPanel sin trampa de foco completa:** tiene
  foco inicial en Cerrar y cierre con Escape, pero no la
  trampa de foco con filtro de no visibles; esa llega con
  el `Dialog` de R3 (el panel es de lectura, no de
  decisión, por eso es aceptable acá).
- **Paginación en cliente:** el servidor devuelve hasta
  100 filas sin paginar; la vista pagina en cliente y lo
  dice con el texto «Mostrando X a Y de Z».
- **«Próximo paso»:** columna derivada (título de la
  tarea abierta más próxima), no campo del servidor; se
  documenta como tal. Las etiquetas de estado de tarea
  (Abierta/Hecha) son presentación propia, no del vanilla
  (que no las badgea).
- Sin tests de componentes React (solo marcadores de
  servidor, como en las fases anteriores; no se instaló
  jsdom para no ampliar el alcance).
- CI/Render no tocados por instrucción.

## Próximos pasos

Siguiente vista: R2 Tareas y seguimientos (tabla real,
tarjetas de resumen reales, panel de detalle, completar/
reabrir), reutilizando Table, DetailPanel, FilterBar y
Pagination. Nada de eso está empezado.
