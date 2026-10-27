# Fase 1 — Diagnóstico y estrategia de migración del frontend

**Fecha:** 26-oct-2026 (noche, ART)
**Brief:** `docs/FRONTEND-MODERNIZATION-BRIEF.md`
**Estado:** DIAGNÓSTICO COMPLETO. Sin cambios de código, sin
instalación de dependencias, sin merges ni despliegues. La
Fase 2 espera autorización de Tomás (y las decisiones del
§ Decisiones pendientes).

## Arquitectura actual (verificada)

- **Backend:** Fastify 5 + TypeScript 5, Node ≥24 (VM: 24.22.1).
  `app/src/` con `rootDir: "src"`, `lib: ["ES2022"]` (sin DOM,
  sin JSX), `exclude` de tests. Scripts: `build` = `tsc`,
  `typecheck` = `tsc --noEmit`, `test` = `vitest run`.
- **Frontend actual:** vanilla — `app/public/index.html` +
  `app/public/app.js` (~770 líneas, un solo archivo con toda
  la lógica: login, 6 vistas por hash, diálogo de aprobación,
  recorrido guiado, tour) + 4 CSS con tokens centralizados
  (`tokens.css`, `base.css`, `components.css`, `layout.css`).
- **Serving (clave):** `src/routes.ts` sirve SOLO 3 cosas por
  `readFileSync` desde `public/`: `/` → `index.html`,
  `/app.js` y `/styles/:file` con lista blanca de 4 archivos
  (cualquier otro nombre da 404). No hay servidor de archivos
  estáticos genérico ni fallback SPA.
- **Autenticación:** correo + contraseña, sesión por cookie
  httpOnly (sin tokens en `localStorage`), JWT con fail-fast
  en producción, rate limit de login, logout real, alta por
  invitación (sin registro público). Sin OAuth, sin
  recuperación, sin «Recordarme».
- **APIs reales (contratos a preservar):** `/api/me`,
  `/api/stats`, `/api/opportunities`, `/api/tasks`,
  `/api/drafts` (+ approve/reject), `/api/agents`,
  `/api/processes`, `/api/executions` (+ steps, retry),
  `/api/audit`, `/api/policies`, `/api/tools`,
  `/api/workflows`, `/api/jobs`, `/api/invitations`,
  `/api/contact` (+ status). Respuestas con 404/409/403/429
  significativos que la UI ya maneja.
- **Tests:** vitest, 6 archivos, **111/111** (verificado
  26-oct-2026 en esta fase). Varios tests afirman el frontend
  vanilla servido (cadenas de `app.js`, clases CSS, elementos
  de `/`): la migración debe actualizarlos, no borrarlos sin
  reemplazo.
- **CI:** `.github/workflows/ci.yml` con 2 trabajos: `ci`
  (`npm ci`, typecheck, build, `node --check public/app.js`,
  tests, smoke `/health`) y `build-prod` (`npm ci --omit=dev`
  + build). Los workflows se crean por la web de GitHub, no
  por API.
- **Despliegue:** Render plan gratis, `buildCommand: cd app &&
  npm install && npm run build`, `NODE_ENV=production`,
  `NODE_VERSION 24.22.1`. `main` remoto verificado:
  `55c3ad66` (PR #40).
- **Estado de Git (advertencia):** el git local NO refleja el
  estado remoto: el proyecto se sube por snapshot (el historial
  local no se traslada y la rama local no avanza con los
  merges). La fuente de verdad es la rama remota. Cambios
  locales pendientes reales al inicio de esta fase: solo la
  sección L4 del reporte de login (post-PR #40). Antes de
  migrar, no sobrescribir ese documento: entra en el próximo
  push como los demás docs.

## Compatibilidad del stack objetivo

- **React + TypeScript + Vite:** compatible. Vite 7 + React 19
  + TS 5 funcionan con Node 24. El cliente necesita su propio
  `tsconfig` (JSX `react-jsx`, lib DOM): el `tsconfig` del
  servidor no puede compilarlo (`rootDir: "src"`, sin DOM).
- **Tailwind CSS:** compatible. Recomendado v4 (estable
  actual, CSS-first con `@tailwindcss/vite`, sin
  `tailwind.config.js`): los tokens del brief coinciden con
  los tokens actuales del proyecto (mismos hex), así que el
  tema se mapea 1 a 1 sin rediseñar la paleta. v3 es viable
  pero más antiguo y con más piezas.
- **shadcn/ui:** NO es una librería versionada: son
  componentes fuente que se copian y adaptan. Se vendorizan
  bajo `components/ui` (botón, campo, diálogo, badge, tabla…)
  adaptados a los tokens SIS. Requiere dependencias Radix
  subyacentes según el componente (se instalan solo las que
  se usen).
- **Lucide React:** compatible, sin riesgo (solo iconos).
- **React Router:** compatible con una decisión (abajo):
  HashRouter no exige cambios en el servidor; BrowserRouter
  exige una ruta fallback SPA (cambio aditivo pequeño en
  `routes.ts`).
- **Recharts:** compatible, pero SOLO en Fase 4 y solo con
  datos reales (stats, auditoría agregada por día, tareas por
  agente). Sin serie temporal guardada, no hay gráfico de
  evolución: se redefine con eventos reales o no se dibuja.
- **React Hook Form + Zod:** compatible; `zod` v4 YA es
  dependencia del servidor (se reutiliza el mismo paquete en
  el cliente para validación de formularios).

## Riesgos (ordenados por gravedad)

1. **Render sin devDependencies (CRÍTICO, lección C8).**
   Con `NODE_ENV=production`, `npm install` no instala
   `devDependencies`. Si Vite, Tailwind, el plugin de React o
   TypeScript del cliente viven en `devDependencies`, el build
   de Render falla (igual que falló tsc en C8). Mitigación:
   las herramientas del build del cliente van en
   `dependencies` (como ya están `typescript` y sus `@types`),
   o `buildCommand` instala dev explícitamente. El trabajo
   `build-prod` de CI (`--omit=dev`) debe actualizarse para
   construir también el cliente.
2. **Serving del build (ALTO).** Vite emite `index.html` +
   chunks con hash. El servidor actual no sirve eso: hay que
   agregar serving del directorio de salida del cliente
   (nuevas rutas en `routes.ts`, con lista blanca por
   extensión o directorio) y decidir qué sirve `/` durante la
   migración (ver estrategia).
3. **Regresión de comportamientos finos (ALTO).** El vanilla
   actual tiene detalles que hay que replicar 1 a 1, no
   aproximar: trampa de foco del diálogo (filtro de elementos
   no visibles), `withLoading` anti-doble-envío, foco inicial
   en invitación, errores 409 (`draft_expired`, `draft_stale`,
   `retry_limit`), 401 → pantalla de acceso, pluralización,
   fechas en zona local del navegador, badges de prioridad y
   estado, conteos en navegación, recorrido guiado de 8 pasos.
   Lista de paridad obligatoria para la Fase 5.
4. **Tests acoplados al vanilla (MEDIO).** Los tests de
   servidor que afirman cadenas de `app.js` y CSS dejan de
   valer cuando esos archivos se retiran. Plan: mantener los
   tests de API intactos; reemplazar los marcadores de
   frontend por marcadores del build del cliente (o tests de
   componentes, si se decide jsdom en Fase 2) antes de borrar
   el vanilla.
5. **Sesión y origen (BAJO).** La cookie httpOnly es del mismo
   origen: el cliente React debe usar `fetch` al mismo origen
   (sin cambiar a tokens en `localStorage`). Sin cambio de
   backend si se respeta esto.
6. **Tamaño y duración (MEDIO).** Es una reescritura del
   frontend (6 vistas + login + diálogo + tour). Hacerla de
   una sola vez es el riesgo mayor; por eso la estrategia es
   por convivencia, no big-bang.

## Estrategia recomendada: convivencia en `/v2/`

1. **Fase 2 — Fundamentos (sin tocar la demo):** scaffold en
   `app/client/` (Vite + React + TS + Tailwind v4 +
   Lucide), tema con los tokens exactos, cliente API tipado
   con los contratos reales, primitivas UI vendorizadas y
   adaptadas, HashRouter, y la pantalla de acceso como
   primera prueba. Fastify sirve el build en `/v2/` (ruta
   nueva, aditiva); `/` sigue sirviendo el vanilla. La demo
   pública NO cambia para el usuario.
2. **Fase 3 — Acceso y estructura en `/v2/`:** layout
   principal, navegación lateral, cabecera con usuario real y
   estado del sistema, contenedores. Login real contra la
   misma API y la misma cookie.
3. **Fase 4 — Pantallas, una por una, en `/v2/`:** Inicio →
   Oportunidades → Tareas → Aprobaciones → Actividad →
   Agentes (este orden: primero las que conectan directo a
   las APIs actuales). Cada vista mergeable por separado;
   cada una con su verificación contra la API real.
4. **Flip:** cuando `/v2/` tenga paridad (lista del §3 +
   verificación en vivo), `/` pasa a servir el build React
   y se retira el vanilla (`public/app.js`, CSS viejos y sus
   tests marcadores, reemplazados). El flip es un cambio de
   ruta, reversible.
5. **Fase 5 — Verificación:** suite, typecheck de servidor Y
   cliente, build de ambos, smoke, verificación en vivo
   post-flip (login, 6 vistas, diálogo, tour, responsive,
   indicadores).

Alternativa descartada: big-bang (reemplazar `public/` de una
vez). Se descarta por el riesgo 3 y 6: una sola rama enorme,
sin demo usable en el medio y sin reversión simple.

## Decisiones pendientes (de Tomás, no decididas acá)

1. Tailwind v4 (recomendado) o v3.
2. Convivencia en `/v2/` (recomendado) o big-bang.
3. HashRouter (recomendado, sin cambios de servidor) o
   BrowserRouter + fallback SPA.
4. Recharts en Fase 4 solo con datos reales (¿sí, con series
   redefinidas desde auditoría, o se posterga?).
5. Confirmar que la demo pública sigue en vanilla hasta el
   flip (recomendado: sí).

## Comprobaciones iniciales (evidencia)

- Node v24.22.1, `npm run build` limpio, `npm test` 111/111,
  `node --check public/app.js` OK (todo 26-oct-2026).
- `main` remoto `55c3ad66`; serving y CI verificados por
  lectura de `routes.ts`, `render.yaml` y `ci.yml`.
- Dependencias actuales: fastify 5, pg 8, jsonwebtoken 9,
  bcryptjs 3, zod 4, typescript 5, vitest 3, tsx 4. Sin React,
  Vite ni Tailwind instalados todavía.

## Archivos que tocará la Fase 2 (identificados, no tocados)

- `app/package.json` (dependencias del cliente en
  `dependencies`, scripts de build del cliente).
- `app/client/` (nuevo: scaffold Vite + React + TS + Tailwind,
  `tsconfig` propio, tema, API client, ui, rutas).
- `app/src/routes.ts` (ruta `/v2/` aditiva + serving del
  build; sin tocar las rutas actuales).
- `app/src/server.test.ts` (marcadores del cliente cuando
  haya build; sin tocar los tests de API).
- `.github/workflows/ci.yml` (por web: trabajo del cliente o
  extensión del actual; sin tocar el resto).
- `render.yaml` solo si `buildCommand` debe cambiar (no en
  Fase 2 si el build del cliente entra en `npm run build`).
