# Fase 0 — Informe baseline (UI/UX System OS v1.1)

**Fecha:** 25-oct-2026 (noche, ART)
**Rama inspeccionada:** `d14-postgres` (HEAD `7e4a3e5`, "D14: adaptador PostgreSQL")
**Estado de la fase:** PASS (baseline establecido; no se modificó código)
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`

## Estado de la fase

- Fase y objetivo: Fase 0 — establecer el estado inicial antes de tocar la interfaz.
- Estado: PASS.
- Archivos modificados: ninguno (solo se agregan este informe y la especificación, ambos untracked).
- Funcionalidades afectadas: ninguna.
- Decisiones tomadas: ninguna de diseño; solo registro de hechos.
- Pruebas ejecutadas: typecheck, build, suite completa (17/17) y smoke con servidor real.
- Riesgos detectados: ver sección Riesgos y limitaciones.
- Próximo paso recomendado: aprobar el plan breve de la Fase 1 (abajo) antes de implementar.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `git branch --show-current` | `d14-postgres` |
| `git status --short` | Limpio, salvo `?? docs/UI-UX-SYSTEM-OS-v1.1.md` (la especificación, sin commitear) |
| `git log --oneline -3` | `7e4a3e5` D14 · `61f917c` Fase 1 MVP · `a68aa8e` scaffold |
| `node --version` / `npm --version` | v24.22.1 / 10.9.4 |
| `npm run typecheck` (`tsc --noEmit`) | Limpio, sin errores |
| `npm run build` (`tsc`) | Limpio |
| `npm test` (`vitest run`) | **17/17 en verde** (system 13, postgres 2, server 2) en ~6 s |
| Smoke: servidor compilado en puerto 3210 con copia de la base local | Ver tabla de smoke |

### Smoke (servidor real, base SQLite copiada a /tmp, luego eliminada)

| Verificación | Resultado |
|---|---|
| `GET /health` | `{"status":"ok","service":"superinteligent-system","version":"0.1.0"}` |
| `GET /` | Sirve `index.html` (título "SuperInteligent System — Demo") |
| `GET /app.js` | 200, `application/javascript` |
| `GET /api/me` sin token | 401 |
| `POST /api/auth/login` demo | Token emitido |
| `GET /api/stats` con token | `{"opportunities":3,"openTasks":3,"pendingDrafts":3,"failedExecutions":0,"createdToday":3,"maxPerDay":100}` |

Nota: el servidor smoke se apagó y los archivos temporales se eliminaron. La base local
`app/data/superinteligent.db` no se tocó (el smoke usó una copia).

## Archivos inspeccionados

- `app/package.json`: Fastify 5, `pg` 8, bcryptjs, jsonwebtoken, zod; dev: typescript, vitest,
  tsx, pg-mem. Scripts: `build` (tsc), `dev` (tsx watch), `start` (node dist/index.js),
  `test` (vitest run), `typecheck`, `seed`. Sin dependencias de frontend.
- `app/public/index.html`: página única, CSS inline básico en `<style>` (system-ui,
  max-width 960 px, secciones con borde). Sin archivos CSS, sin tokens, sin navegación.
- `app/public/app.js`: JavaScript nativo, sin framework (~230 líneas). Token en
  `localStorage` (`sis_token`), con comentario que lo marca como limitación de demo
  (en producción: cookie httpOnly + HTTPS). Render por `innerHTML` con función `esc()`
  que escapa todo contenido dinámico.
- `app/src/server.ts` / `index.ts`: `buildServer` abre la base (Postgres si hay
  `DATABASE_URL`, SQLite si no), Fastify, rutas; `index.ts` escucha en HOST/PORT.
- `app/src/routes.ts`: ver contratos abajo. El frontend NO se sirve con un plugin
  estático: `GET /` y `GET /app.js` leen los archivos con `readFileSync` en cada request.
- `app/src/config.ts`: env `HOST`, `PORT`, `DATABASE_URL`, `DATABASE_PATH`
  (default `./data/superinteligent.db`), `JWT_SECRET`, `MAX_OPPORTUNITIES_PER_DAY`.
- Tests: `server.test.ts` (health y raíz sin secretos), `system.test.ts` (12 criterios
  + webhook con firma inválida), `postgres.test.ts` (flujo completo y aislamiento
  multi-tenant contra pg-mem).

## Contratos de API que consume la UI (a preservar)

| Método y ruta | Guardas | Uso en la UI |
|---|---|---|
| `GET /health` | — | Estado del servicio |
| `GET /` | — | Sirve `index.html` |
| `GET /app.js` | — | Sirve el JS |
| `POST /api/auth/register` | — | Crear organización + usuario |
| `POST /api/auth/login` | — | Entrar, devuelve token |
| `GET /api/me` | auth | Usuario y organización |
| `POST /api/users` | auth + admin | (no usado por la UI actual) |
| `POST /api/opportunities` | auth | Alta manual |
| `GET /api/opportunities` | auth | Lista |
| `GET /api/opportunities/:id` | auth | (no usado por la UI actual) |
| `POST /api/ingest/:orgId` | firma HMAC | Webhook (no es UI) |
| `GET /api/tasks` (`?status=open`) | auth | Tareas abiertas |
| `PATCH /api/tasks/:id` | auth | Marcar hecha |
| `GET /api/drafts` | auth | Borradores (la UI filtra `pending_approval`) |
| `POST /api/drafts/:id/approve` | auth + admin | Aprobar |
| `POST /api/drafts/:id/reject` | auth + admin | Rechazar |
| `GET /api/audit` | auth | Auditoría (la UI muestra 20) |
| `GET /api/executions` | auth | Ejecuciones (la UI muestra 20) |
| `POST /api/executions/:id/retry` | auth | Reintentar (solo si fallida) |
| `GET /api/stats` | auth | Contadores |

## Funcionalidades que deben preservarse

- Registro, login, logout; sesión persistida por token.
- Aislamiento por organización (testeado: una org no ve datos de otra).
- Alta manual de oportunidades con normalización, dedup e idempotencia.
- Clasificación por reglas deterministas (no es IA: no describirla como tal en la UI).
- Tareas con vencimiento y marcado como hecha.
- Borradores con aprobación/rechazo solo admin; la aprobación actualiza el estado y
  audita, NO envía ningún mensaje externo (la UI no debe decir lo contrario).
- Auditoría, ejecuciones con reintento, límites por organización (100/día).
- Validación con zod y errores del servidor mostrados al usuario.

## Inventario de problemas visuales y funcionales (brechas vs. especificación)

### Estructura y sistema visual
- Sin tokens centralizados, sin archivos CSS, sin componentes reutilizables.
- Sin navegación: una sola página con dos secciones que se muestran/ocultan
  (`auth-section` / `app-section`); no hay Inicio, Oportunidades, Tareas, Aprobaciones
  ni Actividad como secciones navegables.
- Estilo inline mínimo; sin foco visible definido; sin breakpoints del sistema
  (el layout se adapta solo por `max-width: 960px` y `flex-wrap`).

### Formularios y estados
- Auth usa `placeholder` en vez de etiquetas visibles; un único `#error` global para
  todos los errores; sin errores junto al campo; sin estado loading; sin prevención
  de doble envío; sin gestión de foco ni cierre de sesión por expiración diferenciada.
- Sin estados de la especificación: loading inicial, sesión expirada, permiso
  insuficiente, conflicto, sin resultados vs. vacío inicial, error recuperable con
  próximo paso. Solo existe "Sin ..." como línea de texto.
- Sin diálogos de confirmación: aprobar/rechazar/reintentar/marcar hecha actúan con
  un clic, sin explicar qué ocurrirá después.
- Sin toasts ni alerts persistentes; los errores se pisan entre operaciones.

### Pantallas
- Oportunidades: tabla de 5 columnas sin acciones por fila, sin filtros, búsqueda,
  paginación ni vista de detalle (el endpoint `GET /:id` existe pero la UI no lo usa).
- Tareas: solo abiertas; sin distinguir vencidas de pendientes ni mostrar completadas.
- Borradores: solo el `body` + Aprobar/Rechazar. Falta el contexto que exige la
  especificación: tipo de acción, oportunidad relacionada, destinatario/canal,
  motivo, alcance real ("esto solo actualiza el estado y audita").
- El rechazo envía una nota fija escrita en el cliente (`'Rechazado desde la demo'`),
  no un motivo del usuario.
- Ejecuciones: lista sin detalle de pasos; el reintento solo aparece si fallida (correcto).
- Auditoría: últimos 20 sin filtros ni enlaces a detalle.
- Stats: una línea de texto; no son indicadores clicables hacia cada vista.
- Configuración: no existe en la UI (correcto no inventarla; queda fuera de la
  navegación hasta tener opciones reales).

### Accesibilidad y responsive
- Sin `<label>`, sin roles/aria, sin nombres accesibles salvo el texto de los botones.
- Sin navegación por teclado probada ni foco visible.
- Tablas sin tratamiento móvil; sin `prefers-reduced-motion`.
- No se declara ningún cumplimiento WCAG (correcto: no hay evidencia).

### Puntos a favor (a mantener)
- `esc()` escapa todo contenido dinámico: no hay inyección de HTML por datos.
- Autorización real en servidor (auth + requireAdmin) y aislamiento testeado.
- El endpoint raíz no expone secretos (cubierto por test).
- La UI no inventa datos: muestra exactamente lo que devuelve el servidor.
- Sin dependencias de frontend: el cambio es solo HTML/CSS/JS nativo.

## Desviaciones de la especificación detectadas

Ninguna en el baseline: la especificación describe correctamente la estructura real
(`index.html` + `app.js`, CSS básico parcialmente integrado en el HTML, token en
`localStorage` como limitación registrada).

## Riesgos y limitaciones

- **Rama local vs. remota:** el trabajo local está en `d14-postgres`; GitHub `main`
  es un snapshot sin historia. Los cambios de UI deberán subirse por snapshot-push y
  el merge a `main` requiere aprobación explícita en cada paso.
- **Render redespliega solo al cambiar `main`:** el push a `main` ES el despliegue.
  Por eso el gate de push cubre también el despliegue; no pushear a `main` sin
  aprobación aunque el cambio "sea solo visual".
- **Serving de nuevos archivos:** agregar `styles/*.css` exige nuevas rutas `GET` en
  `routes.ts` (o una ruta con whitelist). Es un toque mínimo de backend solo para
  servir archivos, no un cambio de contratos de API; se documentará en el diff.
- **Token en `localStorage`:** limitación de seguridad conocida, registrada en la
  especificación y en el propio `app.js`. Queda fuera del alcance visual; no se
  resuelve en las Fases 1–5 salvo decisión explícita.
- **Sin suite de frontend:** vitest cubre backend. La verificación visual será
  manual + navegador en vivo (capturas y recorridos), y se documentará como tal,
  sin afirmar pruebas que no se ejecutaron.
- **Plan gratis de Render:** la demo pública duerme a los 15 min sin tráfico; cada
  verificación post-despliegue debe contemplar ~1 min de despertar.
- **Base local con datos demo** (`app/data/superinteligent.db`, gitignored): no se
  toca durante las fases; las pruebas usan `:memory:` y pg-mem.
- **Preexistentes distinguidos de nuevos:** baseline verde (typecheck, build,
  17/17). Cualquier fallo posterior se compara contra este baseline.

## Plan breve — Fase 1 (Foundations), pendiente de aprobación

Archivos afectados:

- Nuevos: `app/public/styles/tokens.css` (tokens de la especificación),
  `app/public/styles/base.css` (tipografía, foco visible, escala de espaciado),
  `app/public/styles/components.css` (botones, campos, badges, contenedores).
- Modificados: `app/public/index.html` (linkear los CSS, sin cambiar funcionalidad),
  `app/src/routes.ts` (solo servir `GET /styles/*` con whitelist; sin tocar la API).
- Opcional: un test en `server.test.ts` que verifique que `GET /styles/tokens.css`
  responde 200 sin exponer secretos.

Criterio de salida: los elementos actuales usan el sistema consistente sin romper
autenticación ni flujos; typecheck, build y 17/17 (o más) en verde; smoke local OK.

Riesgos de la Fase 1: bajos. No cambian contratos, permisos ni datos. El único toque
de backend es servir archivos estáticos. Trabajo en rama local; sin push ni
despliegue hasta tu aprobación.

## Fases siguientes (resumen, sin iniciar)

- Fase 2: navegación y estructura (secciones navegables; Configuración fuera hasta
  tener opciones reales).
- Fase 3: oportunidades y tareas (tabla, formulario, estados, responsive).
- Fase 4: Centro de aprobaciones (panel con contexto completo y confirmación
  explícita del alcance real).
- Fase 5: actividad y ejecuciones (detalle, estados, reintentos autorizados).
- Fase 6: QA y cierre (funcional, responsive 375–1440 px, accesibilidad, errores,
  permisos, regresiones, diff y documentación).
