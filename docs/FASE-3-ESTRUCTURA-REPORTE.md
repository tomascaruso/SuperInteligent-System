# Fase 3 — Estructura general — REPORTE

**Fecha:** 26-oct-2026 (noche, ART)
**Brief:** `docs/FRONTEND-MODERNIZATION-BRIEF.md`
**Base:** Fase 2 mergeada (main `1f45f4fd`, PR #41)
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
commits (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni
`.github/workflows`. La demo pública no cambia: el vanilla
sigue en `/` y el cliente React vive en `/v2/`.

## Estado general

El cliente React ya tiene estructura general: layout principal
con navegación lateral de las 6 secciones reales, cabecera con
usuario real y píldora de estado con la regla honesta del
vanilla, y rutas HashRouter para cada sección. Las vistas con
datos reales son la Fase 4 y NO se migraron: cada sección
muestra su título real y un estado honesto de migración con un
enlace real a / como puente. Tras un login o una invitación
exitosa ya no se redirige a /: se queda en /v2/ (ruta
/#/inicio). La vista SessionHome de la Fase 2 se retiró.

## Objetivo

Dejar la estructura (Fase 3 del plan): layout, navegación,
cabecera y contenedores, con las sesiones y permisos
conservados, como base para migrar las vistas una por una en
la Fase 4.

## Acciones

- **AppLayout** en `app/client/src/components/layout/
  AppLayout.tsx`: barra lateral `<nav aria-label="Navegación
  principal">` con las 6 secciones REALES del vanilla, mismo
  orden y mismos nombres (Inicio, Oportunidades, «Tareas y
  seguimientos», Aprobaciones, «Actividad y ejecuciones»,
  Agentes), como `NavLink` de HashRouter (la activa lleva
  `aria-current="page"` y fondo sutil, como el vanilla).
  Cabecera con marca SIS, píldora de estado y chip de usuario
  real de `GET /api/me` («nombre · rol»), y botón «Salir»
  real (`POST /api/auth/logout`, error con `role="alert"`).
  Responsive con el mismo criterio del vanilla: en escritorio
  (≥1024 px) la navegación es una columna lateral; en angosto
  es una tira horizontal con scroll, sin ocultar secciones.
  Objetivos táctiles de 44 px en enlaces y botón de salir.
- **Píldora de estado, misma regla del vanilla**
  (`setSystemStatus` en `app/public/app.js`): arranca
  «Conectando…», «Sistema operativo» solo si la última carga
  de la API tuvo éxito, «Sin conexión» si falló. En esta fase
  la carga es `GET /api/me` al entrar; las vistas de la Fase 4
  actualizarán la píldora en cada carga, como el `refresh()`
  del vanilla.
- **Rutas HashRouter** en `app/client/src/App.tsx`: `/inicio`,
  `/oportunidades`, `/tareas`, `/aprobaciones`, `/actividad`,
  `/agentes`; la ruta índice y cualquier ruta desconocida
  redirigen a `/inicio`. 401 en `GET /api/me` vuelve a la
  pantalla de acceso, igual que el vanilla.
- **SectionPlaceholder** en `app/client/src/features/sections/
  SectionPlaceholder.tsx`: título real, una línea de qué
  contiene esa vista en la app actual (descripción de
  funcionalidad existente, no inventada), aviso de que se
  migra en la Fase 4 y botón real «Ir a la aplicación
  actual» (a /). Nada de contadores, datos ni botones
  decorativos.
- **Cambio de puente post-login**: `LoginScreen` ahora acepta
  `onAuthenticated` (opcional; sin él mantiene el puente
  original a /). `App` lo usa para quedarse en /v2/ (navega a
  `/#/inicio` tras verificar la sesión con `GET /api/me`).
  Aplica igual a login e invitación.
- **SessionHome retirada**: el archivo
  `app/client/src/features/auth/SessionHome.tsx` se eliminó
  (sin referencias restantes) y su texto de puente pasó al
  estado de migración de cada sección.
- **Corrección /v2 sin barra** en `app/src/routes.ts` (única
  excepción a «no tocar el servidor», y solo aditiva): `GET
  /v2` redirige 302 a `/v2/`. El resto del serving de /v2/
  queda igual. Desvío corregido en el intento: el `redirect`
  de esta versión de Fastify pide la URL primero
  (`reply.redirect('/v2/', 302)`), no el código primero.
- **Sin dependencias nuevas**: no se agregó ningún paquete.
  La navegación no usa iconos (fiel al vanilla, que tampoco
  los tiene), así que no hubo que verificar nombres nuevos
  de Lucide.

## Archivos creados

- `app/client/src/components/layout/AppLayout.tsx`
- `app/client/src/features/sections/SectionPlaceholder.tsx`
- `docs/FASE-3-ESTRUCTURA-REPORTE.md` (este informe)

## Archivos modificados

- `app/client/src/App.tsx` (reescrito: AccessGate + rutas de
  las 6 secciones + índice/desconocida a /inicio)
- `app/client/src/features/auth/LoginScreen.tsx`
  (prop `onAuthenticated`, comentario del puente actualizado)
- `app/src/routes.ts` (solo la ruta aditiva `GET /v2` → 302)
- `app/src/server.test.ts` (3 marcadores nuevos de la Fase 3;
  ningún test viejo tocado ni borrado)

## Archivos eliminados

- `app/client/src/features/auth/SessionHome.tsx` (retirada por
  alcance de la Fase 3; su contenido pasa a los placeholders)

## No tocado (verificable)

- `app/public/` (vanilla intacto: no se editó ningún archivo
  de esa carpeta en esta fase), backend, DB, auth, permisos,
  APIs, `render.yaml`, `.github/workflows`. Los `M
  app/public/*` que muestra `git status` local son el
  artefacto conocido del modelo snapshot (el HEAD local
  `8febe8a` no avanza con los merges); no son cambios de esta
  fase.

## Pruebas y evidencia (todo con números reales)

- Typecheck combinado (servidor + cliente): limpio.
- Build cliente (Vite): OK en 3,05 s (JS 282,46 kB, CSS
  11,49 kB; assets con base `/v2/`).
- Build servidor (`tsc`): limpio. `node --check
  public/app.js`: OK.
- Suite vitest: **117/117** (114 previos + 3 marcadores
  nuevos de la Fase 3: redirect /v2 → /v2/, /v2/ sigue
  sirviendo el HTML del cliente, y el JS construido contiene
  los literales de las 6 rutas de sección; ningún test viejo
  dejó de valer).
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID):
  `/health` → `{"status":"ok"}`; `/v2` → 302 a `/v2/`;
  `/v2/` → 200; asset JS → 200; asset CSS → 200;
  `/` → 200 (vanilla intacto); `POST /api/auth/login` con la
  cuenta demo → 200 (auth intacta); `/v2/../secret` → 404
  (traversal sigue rechazado).

## Qué funciona y qué no

- Funciona: estructura completa en /v2/ (navegación de 6
  secciones, cabecera con usuario y estado honestos, salida
  real, 401 → acceso), puente post-login dentro de /v2/,
  redirect /v2 → /v2/, y todo lo de la Fase 2 intacto.
- No funciona todavía (por diseño de la fase): las 6
  secciones muestran solo el estado de migración, sin datos
  reales (eso es la Fase 4, vista por vista); el click-
  through de la navegación y del login en React no se puede
  probar sin navegador (queda para la verificación en vivo
  post-merge).

## Limitaciones y riesgos pendientes

- **Click-through sin probar:** sin navegador no se puede
  probar el flujo clicado (navegar entre secciones, entrar y
  salir, `aria-current` en la activa). Queda para la
  verificación en vivo post-merge.
- **Sin tests de componentes React** (solo marcadores de
  servidor, como en la Fase 2; no se instaló jsdom para no
  ampliar el alcance).
- **La píldora de estado** hoy solo refleja la carga de
  `/api/me` al entrar; la actualización en cada carga de
  vista (como el `refresh()` del vanilla) llega con la
  Fase 4.
- **CI/Render no tocados por instrucción:** el `build`
  actual ya incluye el cliente y sus herramientas están en
  `dependencies`; el primer despliegue con /v2/ ya se
  verificó en la Fase 2, así que no hay riesgo nuevo acá.

## Próximos pasos (Fase 4)

Migrar las vistas una por una con datos reales de las APIs
actuales, en el orden recomendado: Inicio (stats reales) →
Oportunidades → Tareas → Aprobaciones → Actividad →
Agentes. Cada vista reemplaza su placeholder sin tocar el
layout. Nada de esto está empezado.
