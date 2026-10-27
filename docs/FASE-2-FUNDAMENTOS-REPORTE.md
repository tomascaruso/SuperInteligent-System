# Fase 2 — Fundamentos del frontend — REPORTE

**Fecha:** 26-oct-2026 (noche, ART)
**Brief:** `docs/FRONTEND-MODERNIZATION-BRIEF.md`
**Diagnóstico:** `docs/FRONTEND-MODERNIZATION-DIAGNOSTICO.md`
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
commits (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni
`.github/workflows`. La demo pública no cambia: el vanilla
sigue en `/` y el cliente React vive en `/v2/`.

## Estado general

El cliente React existe, compila, tiene tema, cliente API
tipado, primitivas UI y pantalla de acceso funcional contra la
API real, servido en `/v2/` en convivencia con el vanilla. El
backend, las rutas actuales, la autenticación y el frontend
vanilla no se tocaron (salvo el bloque aditivo de `/v2/`).

## Objetivo

Dejar la base profesional del frontend (Fase 2 del plan):
scaffold, tokens, API tipada, componentes base, rutas y la
primera pantalla (acceso) como prueba, sin tocar la demo.

## Stack y versiones efectivamente adoptados

Instalados en `app/package.json` (todo en `dependencies`, por
la lección C8: Render con `NODE_ENV=production` no instala
`devDependencies` y sin estas herramientas el build fallaría):

- react 19.3.1, react-dom 19.3.1
- react-router 8.5.0 (HashRouter, Routes, Navigate; la API
  usada es estable entre v7/v8)
- lucide-react 1.61.0 (iconos verificados por nombre: Users,
  Zap, ShieldCheck, Settings, Eye, EyeOff, LogOut,
  ArrowUpRight, ChartColumn)
- vite 7.3.7, @vitejs/plugin-react 5.2.0
- tailwindcss 4.3.3, @tailwindcss/vite 4.3.3
- @types/react 19.3.0, @types/react-dom 19.3.0
- zod 4 ya era dependencia (no se agregó validación con
  zod en el cliente en esta fase: los formularios usan la
  validación del servidor, como el vanilla; no se inventaron
  reglas)

NO instalados (por alcance): Recharts, React Hook Form
(Fase 4), shadcn/ui como paquete (las primitivas son propias
vendorizadas y adaptadas, como indica el brief).

Desvío resuelto durante la instalación: el primer intento
falló por conflicto de peers (el plugin-react más reciente
pide vite 8, pero vitest 3 fija vite 7). Se resolvió fijando
vite@^7 y @vitejs/plugin-react@^5, sin `--force` ni
`--legacy-peer-deps`.

## Acciones

- Scaffold en `app/client/`: `vite.config.ts` (root client,
  base `/v2/`, salida `client/dist`), `index.html`,
  `tsconfig.json` propio (jsx `react-jsx`, lib DOM, strict,
  separado del `tsconfig` del servidor), `src/vite-env.d.ts`.
- Tema Tailwind v4 en `src/index.css` con los tokens EXACTOS
  del brief (fondo `#F7F8FC`, superficies `#FFFFFF`,
  primario `#4F46E5`, hover `#4338CA`, sutil `#EEF2FF`,
  texto `#172033`, secundario `#64748B`, atenuado `#94A3B8`,
  bordes `#E2E8F0`, éxito `#15803D`, advertencia `#B45309`,
  error `#B91C1C`, información `#1D4ED8`; radios 8/12/16 px;
  fuente system stack del proyecto) + foco visible global.
- Cliente API tipado en `src/lib/api.ts` (fetch mismo origen,
  JSON, errores con `status`; 401 = sesión expirada) para los
  contratos reales verificados en `routes.ts`: `GET /api/me`,
  `POST /api/auth/login`, `POST /api/auth/logout`,
  `POST /api/auth/accept-invitation`,
  `GET /api/contact/status`, `POST /api/contact`,
  `GET /api/stats`.
- Primitivas UI propias en `src/components/ui/`: button
  (primary/secondary/ghost/danger, sm), input (con soporte
  `ref` de React 19), label, card, badge, alert (error con
  `role="alert"`, resto con `aria-live`).
- Pantalla de acceso en React (`src/features/auth/`):
  dos paneles como la pantalla vanilla actual (marca SIS by
  PENSIA tipográfica — el logo lo provee Tomás más adelante—,
  titular, descripción, 4 beneficios con iconos Lucide,
  mini-dashboard ESTÁTICO no interactivo sin leyenda visible
  y sin llamadas a API, formulario «Bienvenido» con correo,
  contraseña + mostrar/ocultar con `aria-pressed`, «Iniciar
  sesión», «Tengo una invitación» con su formulario y foco
  inicial, cuenta demo visible, enlace «Contactanos» que
  revela el contacto solo si `/api/contact/status` dice que
  está habilitado, honeypot). SIN botón Google, SIN
  recuperación, SIN «Recordarme» (no existen en el backend).
- Puente Fase 2 (documentado en el código): tras un login o
  una invitación exitosa, se redirige a `/` (la app vanilla,
  misma sesión por cookie). Si ya hay sesión, `/v2/`
  muestra usuario/organización/rol, enlace a `/` y botón de
  salir real (`POST /api/auth/logout`). La shell completa es
  la Fase 3.
- Serving aditivo en `src/routes.ts` (solo rutas nuevas):
  `GET /v2/` sirve el `index.html` del build y `GET /v2/*`
  sirve assets con lista blanca por extensión (js, css, svg,
  png, ico) y 404 para lo demás (incluido traversal). Si el
  cliente no está construido, `/v2/` da 404 en vez de servir
  algo a medias. NO se tocaron `/`, `/app.js`, `/styles/*`,
  APIs ni auth.
- Scripts en `app/package.json`: `build:client`,
  `dev:client`, `typecheck:client`; `build` ahora es
  `tsc && npm run build:client`; `typecheck` incluye el
  cliente; `pretest` construye el cliente (así los
  marcadores de `/v2/` siempre tienen build, ~3–4 s extra
  por corrida de tests).
- `.gitignore`: sin cambios necesarios — el patrón `dist/`
  ya cubre `app/client/dist` (verificado con
  `git check-ignore` y con el listado de archivos a subir,
  que no incluye `dist`).

## Archivos creados

- `app/client/vite.config.ts`, `app/client/index.html`,
  `app/client/tsconfig.json`
- `app/client/src/main.tsx`, `app/client/src/App.tsx`,
  `app/client/src/index.css`, `app/client/src/vite-env.d.ts`
- `app/client/src/lib/api.ts`, `app/client/src/lib/utils.ts`
- `app/client/src/components/ui/` (button, input, label, card,
  badge, alert)
- `app/client/src/features/auth/LoginScreen.tsx`,
  `app/client/src/features/auth/SessionHome.tsx`

## Archivos modificados

- `app/package.json` + `app/package-lock.json` (deps y
  scripts; todo lo del cliente en `dependencies`)
- `app/src/routes.ts` (solo el bloque aditivo `/v2/`)
- `app/src/server.test.ts` (3 marcadores nuevos de `/v2/`;
  ningún test viejo tocado ni borrado)

## No tocado (verificable)

- `app/public/` (vanilla intacto), backend, DB, auth,
  permisos, `render.yaml`, `.github/workflows`. Los
  `M app/public/*` que muestra `git status` local son el
  artefacto conocido del modelo snapshot (el HEAD local
  `8febe8a` no avanza con los merges); no son cambios míos.

## Pruebas y evidencia (todo con números reales)

- `npm install`: OK (tras fijar vite@^7 y
  @vitejs/plugin-react@^5 por el conflicto de peers).
- Typecheck cliente: limpio. Typecheck combinado
  (servidor + cliente): limpio.
- Build cliente (Vite): OK en ~3–4 s (2031 módulos;
  `dist/index.html` 0,39 kB, CSS 10,40 kB, JS 279,30 kB
  gzip 88,86 kB; assets con base `/v2/`).
- Build servidor (`tsc`): limpio. `node --check
  public/app.js`: OK.
- Suite vitest: **114/114** (111 previos + 3 marcadores
  nuevos de `/v2/`; ningún test viejo dejó de valer).
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID):
  `/health` → `{"status":"ok"}`; `/v2/` sirve el HTML del
  cliente con refs `/v2/assets/*`; asset JS → 200; asset
  CSS → 200; `POST /api/auth/login` con la cuenta demo →
  200 con sesión (la ruta de auth sigue intacta); `/` y
  `/app.js` → 200 (vanilla intacto).

## Qué funciona y qué no

- Funciona: scaffold, tema, API tipada, primitivas, acceso
  React completo contra la API real (login, invitación,
  contacto con fail-closed, demo visible, toggle, sesión
  existente con salida real), serving `/v2/` y build
  reproducible con `npm run build`.
- No funciona todavía (por diseño de la fase): no hay shell
  ni vistas operativas en React (Fase 3 y 4); tras el login
  se vuelve a la app vanilla; `/v2` sin barra final da 404
  (solo `/v2/` y sus assets están servidos); no hay tests
  de componentes React (solo marcadores de servidor; no se
  instaló jsdom para no ampliar el alcance).

## Limitaciones y riesgos pendientes

- **Click-through del login React sin probar:** sin
  navegador no se puede probar el flujo clicado (escribir,
  enviar, redirigir). Queda para la verificación en vivo
  post-merge. El resto (build, tipos, serving, API por curl)
  sí está verificado.
- **react-router v8 y lucide-react v1** son majors
  recientes; la API usada (HashRouter, Routes, Navigate,
  iconos por nombre) está verificada en los paquetes
  instalados, pero conviene vigilar cambios en upgrades
  futuros.
- **CI pendiente (no tocado por instrucción):** el trabajo
  `build-prod` (`--omit=dev`) hoy corre solo `npm run
  build`, que ya incluye el cliente (sus herramientas están
  en `dependencies`, así que no se rompe); aun así, cuando
  el agente principal actualice el workflow por web, debe
  verificar que el build del cliente se ejecute y que los
  marcadores `/v2/` corran (el `pretest` ya lo cubre en
  `npm test`).
- **Render pendiente (no tocado):** `buildCommand` actual
  (`npm install && npm run build`) ya construye el cliente
  porque `build` lo incluye; no hace falta cambiarlo en
  esta fase, pero debe verificarse en el primer despliegue
  con `/v2/` (el build de Vite tarda ~3–4 s extra).
- El `pretest` alarga cada corrida de tests unos segundos;
  si molesta en el futuro, puede moverse a un paso explícito
  de CI, pero hoy es lo que garantiza los marcadores.

## Próximos pasos (Fase 3)

Layout principal en `/v2/` (navegación lateral, cabecera con
usuario real y estado del sistema, contenedores), acceso ya
hecho como base, y luego las vistas operativas una por una
(Fase 4) hasta el flip. Nada de esto está empezado.
