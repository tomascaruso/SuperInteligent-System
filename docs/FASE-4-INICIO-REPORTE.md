# Fase 4 — Vista Inicio con datos reales — REPORTE

**Fecha:** 26-oct-2026 (noche, ART)
**Brief:** `docs/FRONTEND-MODERNIZATION-BRIEF.md`
**Base:** Fase 3 mergeada (main `7136196a`, PR #42)
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
commits (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni
`.github/workflows`. La demo pública no cambia: el vanilla
sigue en `/` y el cliente React vive en `/v2/`.

## Estado general

La primera vista de la Fase 4 está migrada: `/inicio` en /v2/
ya no es un placeholder sino la vista real con datos de las
APIs existentes, con la misma composición que el vanilla
(#view-inicio): 4 tarjetas de indicadores, acciones
prioritarias calculadas con los datos ya cargados y actividad
reciente con los últimos 5 eventos comerciales. Las otras 5
secciones siguen como placeholders, sin tocar.

## Objetivo

Migrar la vista Inicio (primera de la Fase 4, en el orden
recomendado Inicio → Oportunidades → Tareas → Aprobaciones →
Actividad → Agentes), reemplazando su placeholder sin tocar el
layout, la navegación ni la pantalla de acceso.

## Qué muestra cada sección y de qué endpoint sale

- **Título:** «Centro de operaciones» + subtítulo «Qué
  requiere atención y qué está pasando.» (mismos textos del
  vanilla, `VIEWS.inicio`).
- **Tarjetas de indicadores** (`GET /api/stats`, mismo orden
  y mismos nombres del vanilla, y cada tarjeta enlaza a su
  sección como en el vanilla): Oportunidades
  (`stats.opportunities`), Tareas pendientes
  (`stats.openTasks`), Aprobaciones pendientes
  (`stats.pendingDrafts`), Ejecuciones fallidas
  (`stats.failedExecutions`). Valor en 32 px, como el
  vanilla.
- **Acciones prioritarias** (misma lógica del vanilla,
  calculada con los datos ya cargados):
  - `GET /api/tasks?status=open`, vencidas por fecha local
    anterior a hoy (`localDate(due_at) < today`):
    «{título} — venció {DD/MM/AAAA}» + enlace «Ver tareas».
  - `GET /api/drafts`, filtrados a `pending_approval`:
    «{n} borrador(es) pendiente(s) de aprobación» (plural
    real) + enlace «Revisar».
  - `GET /api/executions`, filtradas a `failed`:
    «{n} ejecución(es) fallida(s)» + enlace «Ver actividad».
  - Sin nada urgente: «Sin acciones urgentes.»
- **Actividad reciente** (`GET /api/audit`): la auditoría
  menos los inicios de sesión (`action !== 'user.login'`),
  primeros 5, con el formato del vanilla:
  «{fecha y hora local} — {actor}: {acción} ({entidad})
  {detalle}». El detalle resuelve la oportunidad citada en
  `detail_json.opportunityId` a su contacto y empresa
  (para eso se carga también `GET /api/opportunities`, solo
  como resolución, sin mostrar la lista); si no cita
  oportunidad, muestra categoría y prioridad cuando vienen.
  Vacío: «Sin actividad comercial todavía.»
- **Píldora de estado:** se actualiza con la carga de esta
  vista: «Sistema operativo» solo si las 6 cargas tuvieron
  éxito, «Sin conexión» si alguna falló (misma regla honesta
  de siempre; antes solo reflejaba `GET /api/me` al entrar).
  Un 401 durante la carga vuelve a la pantalla de acceso con
  «La sesión expiró. Volvé a entrar.», igual que el vanilla.
- **Estados:** cargando («Cargando…»); error (Alert con
  `role="alert"` + botón «Reintentar», sin mostrar tarjetas
  con ceros falsos: si alguna API falla, no se muestra ningún
  dato de la vista); vacíos por sección con los textos del
  vanilla. Fechas en zona local del navegador y pluralización
  real, como el vanilla.

## Acciones

- **HomeView** en `app/client/src/features/inicio/
  HomeView.tsx`: la vista real descrita arriba. El contexto
  del Outlet (`HomeOutletContext`) le da `setSystemStatus` y
  `onSessionExpired`, que provee AccessGate.
- **Formato de presentación** en `app/client/src/lib/
  format.ts` (nuevo): `plural`, `localDate`, `formatDate`,
  `formatDateTime`, `categoryLabel`, `priorityLabel`,
  `auditActionLabel`, `auditEntityLabel`, copiados del
  vanilla (solo presentación, no cambian los valores del
  servidor).
- **API tipada** en `app/client/src/lib/api.ts` (ampliada,
  sin tocar lo existente): `getOpportunities`,
  `getOpenTasks`, `getDrafts`, `getExecutions`, `getAudit`
  con los shapes reales de `app/src/routes.ts` (solo los
  campos que la vista lee).
- **App.tsx** (modificado): la ruta `/inicio` renderiza
  `HomeView` en vez del placeholder; AccessGate pasa el
  contexto del Outlet (`setSystemStatus` + `onSessionExpired`
  con `useCallback` para que su identidad estable no
  re-ejecute la carga en bucle) y maneja la sesión expirada
  volviendo al acceso. El layout, la navegación y la pantalla
  de acceso no se tocaron.
- **Sin gráficos** (Recharts queda para decidir más adelante,
  como estaba previsto) y sin cambios de diseño fuera de los
  tokens ya existentes.

## Archivos creados

- `app/client/src/features/inicio/HomeView.tsx`
- `app/client/src/lib/format.ts`
- `docs/FASE-4-INICIO-REPORTE.md` (este informe)

## Archivos modificados

- `app/client/src/App.tsx` (ruta /inicio → HomeView +
  contexto del Outlet + sesión expirada)
- `app/client/src/lib/api.ts` (5 fetchers nuevos + tipos;
  lo existente intacto)
- `app/src/server.test.ts` (3 marcadores nuevos de la Fase
  4; ningún test viejo tocado ni borrado)

## No tocado (verificable)

- `app/public/` (vanilla intacto: verificado que
  `app.js` local es idéntico al de `main`), backend, DB,
  auth, permisos, APIs, `render.yaml`,
  `.github/workflows`. Los `M app/public/*` que muestra
  `git status` local son el artefacto conocido del modelo
  snapshot (el HEAD local `8febe8a` no avanza con los
  merges); no son cambios de esta fase. Sin dependencias
  nuevas (no se instaló ningún paquete).

## Pruebas y evidencia (todo con números reales)

- Typecheck combinado (servidor + cliente): limpio.
- Build cliente (Vite): OK en 3,74 s (JS 288,21 kB, CSS
  12,50 kB; assets con base `/v2/`).
- Build servidor (`tsc`): limpio. `node --check
  public/app.js`: OK.
- Suite vitest: **120/120** (117 previos + 3 marcadores
  nuevos de la Fase 4: el JS construido referencia
  `/api/stats`, `/api/tasks?status=open`, `/api/drafts`,
  `/api/executions`, `/api/opportunities` y `/api/audit`;
  contiene los textos reales «Centro de operaciones»,
  «Acciones prioritarias», «Actividad reciente»,
  «Sin acciones urgentes» y «Sin actividad comercial
  todavía»; y `/v2/` sigue sirviendo el HTML del cliente).
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID):
  `/health` → `{"status":"ok"}`; `/v2` → 302 a `/v2/`;
  `/v2/` → 200; asset JS → 200; asset CSS → 200;
  `/` → 200 (vanilla intacto); `POST /api/auth/login` con
  la cuenta demo → 200; `GET /api/stats` con esa sesión →
  200 con los valores reales de la DB local copiada:
  `{"opportunities":3,"openTasks":3,"pendingDrafts":3,
  "failedExecutions":0,"createdToday":0,"maxPerDay":100}`.
  (La DB local no es la de la demo pública —que está en
  3/0/0/0—; los valores se reportan tal cual los devolvió
  el servidor local, no como si fueran los de la demo.)

## Qué funciona y qué no

- Funciona: vista Inicio real en /v2/ con indicadores,
  acciones prioritarias y actividad reciente desde las APIs
  reales, píldora de estado actualizada por la carga de la
  vista, 401 → acceso, error con reintento sin datos falsos,
  y todo lo de las Fases 2 y 3 intacto.
- No funciona todavía (por diseño de la fase): las otras 5
  secciones siguen como placeholders (eso es el resto de la
  Fase 4); el click-through de la vista Inicio en React no
  se puede probar sin navegador (queda para la verificación
  en vivo post-merge).

## Limitaciones y riesgos pendientes

- **Click-through sin probar:** sin navegador no se puede
  probar el flujo clicado de la vista Inicio (tarjetas que
  enlazan a secciones, enlaces «Ver tareas»/«Revisar»/«Ver
  actividad», reintento tras error). Queda para la
  verificación en vivo post-merge.
- Sin tests de componentes React (solo marcadores de
  servidor, como en las fases anteriores; no se instaló
  jsdom para no ampliar el alcance).
- La carga de Inicio hace 6 llamadas en paralelo; si una
  falla, toda la vista muestra error (fiel al `refresh()`
  del vanilla, que es todo o nada). Una mejora futura podría
  ser parcial por sección, pero cambiaría el comportamiento
  del vanilla y no se hizo.
- CI/Render no tocados por instrucción: el `build` actual
  ya incluye el cliente y sus herramientas están en
  `dependencies`.

## Próximos pasos

Siguiente vista de la Fase 4: Oportunidades (lista real con
empresa, categoría y prioridad + alta manual), reemplazando
su placeholder sin tocar el layout ni Inicio. Nada de eso
está empezado.
