# FLIP — La app React pasa a ser la principal en /

## Estado general

- **Estado:** COMPLETO EN LOCAL (sin merge, sin despliegue).
- **Fecha:** 27-oct-2026.
- **Alcance:** servidor (`app/src/routes.ts`, tests en `app/src/server.test.ts`), base del build (`app/client/vite.config.ts`) y comentarios de enrutado en `app/client/src/App.tsx` y `app/client/src/features/auth/LoginScreen.tsx`. Sin cambios de datos, sin cambios de API, sin cambios de UI del cliente, sin tocar `render.yaml`, sin tocar el contenido vanilla, sin tocar la base real local.

## Objetivo

Cerrar la migración React: que la app React actual en /v2/ pase a ser la app principal en /, con la app vanilla conservada como respaldo y redirecciones desde /v2/ para no romper marcadores. Aprobado por Tomás 27-oct ~20:56.

## Acciones

### 1. Rutas antes / después

| Ruta | Antes | Después |
|---|---|---|
| `/` | Vanilla (index + app.js) | **React** (index de `client/dist`, assets en `/assets/*`) |
| `/assets/*` | No existía | Assets del build React (js, css, svg, png, ico, con lista blanca y 404 ante traversal) |
| `/vanilla/` | No existía | **Vanilla intacta** (mismo index, mismo app.js, mismos estilos) |
| `/vanilla/app.js`, `/vanilla/styles/*` | No existían | Vanilla (estilos con la misma lista blanca de antes) |
| `/app.js`, `/styles/*` | Vanilla | Siguen sirviendo vanilla (compatibilidad, ver abajo) |
| `/v2`, `/v2/` | React (con redirect `/v2` → `/v2/`) | **302 → `/`** |
| `/v2/*` | Assets React | **302 → `/*` equivalente** (ej.: `/v2/assets/x.js` → `/assets/x.js`; con `..` redirige a `/`) |
| `/vanilla` | No existía | 302 → `/vanilla/` |

### 2. Decisión de la ruta de respaldo: /vanilla/

Se eligió `/vanilla/` (no hizo falta `/legacy/`): no choca con ninguna ruta existente (no hay `/api/*`, `/assets/*` ni secciones con ese nombre) y su nombre dice exactamente qué es. El contenido vanilla NO se tocó: mismo `index.html`, mismo `app.js`, mismos estilos (MD5 de `app/public/app.js` intacto, ver Pruebas).

### 3. Por qué /app.js y /styles/* siguen sirviendo vanilla

La vanilla de `/vanilla/` referencia sus assets con rutas absolutas (`/app.js`, `/styles/tokens.css`, etc.). Si esas rutas dejaran de servir, la vanilla de respaldo quedaría rota sin tocar su contenido. Mantenerlas sirviendo vanilla es compatible (ningún asset React vive en `/app.js` ni en `/styles/*`) y evita reescribir el HTML vanilla. Decisión documentada, no un olvido.

### 4. Base del build React: /v2/ → /

`app/client/vite.config.ts`: `base: '/v2/'` → `base: '/'`. Los assets del build salen ahora como `/assets/*`. Solo se actualizaron comentarios de enrutado en `App.tsx` y `LoginScreen.tsx` (el «se queda en /v2/» pasó a «se queda en /»); los ids de formulario `v2-email`, `v2-password`, etc. no se tocaron (son ids internos, no rutas).

### 5. Cookie de sesión: Path=/, la sesión sobrevive al flip

Hallazgo verificado en `app/src/routes.ts` (`authCookie`): la cookie es `token=...; HttpOnly; Path=/; SameSite=Lax` (más `Secure` en producción) y el borrado usa el mismo `Path=/`. **Consecuencia: ninguna.** Como el Path ya es `/`, la cookie se envía tanto a `/` como a `/vanilla/` y a `/v2/`; el usuario NO tiene que volver a entrar por el flip. No se cambió nada del servidor en este punto (cambiar el Path no hizo falta y no se impuso ningún cambio de seguridad).

### 6. Tests: migración completa del enrutado

- Las pruebas de contenido vanilla que pedían `/` ahora piden `/vanilla/` (11 pruebas, más 2 de contenido vanilla cuyos nombres no empezaban con «GET /» y se reorientaron a mano: C8 y Fase 6 QA).
- Las pruebas React de fase 2/3/4/r1 pasaron de `/v2/` y `/v2/assets/` a `/` y `/assets/` (incluidas las regex literales escapadas `\/v2\/assets\/`, que dieron 7 fallos en la primera corrida y se corrigieron).
- Las pruebas de traversal pasaron de `/v2/*` a `/assets/*`.
- **6 pruebas nuevas del flip:** `/vanilla/` sirve la vanilla intacta; `/vanilla/app.js` idéntico al archivo en disco; `/vanilla` redirige a `/vanilla/`; `/v2` y `/v2/` redirigen a `/`; `/v2/assets/<logo>` redirige a `/assets/<logo>`; `/app.js` y `/styles/tokens.css` históricos siguen sirviendo vanilla.
- `render.yaml` no se tocó: el build (`cd app && npm install && npm run build`) y el arranque (`cd app && npm start`) ya producen y sirven `client/dist`, así que el flip no exige ningún cambio de despliegue.

## Pruebas

- **Suite: 156/156 en 10 archivos** (150 previas + 6 nuevas del flip). Sin cambios de servidor salvo el enrutado; el cliente no tiene runner de tests en este repo.
- **Build limpio** (`npm run build`: tsc + Vite) y **typecheck del cliente limpio** (`tsc -p client/tsconfig.json --noEmit`); `node --check public/app.js` OK.
- **Vanilla intacta:** MD5 de `app/public/app.js` = `44ef9ae6daf62c3b9c335f6f2501256a` (referencia).
- **DB real local intacta:** MD5 de `app/data/superinteligent.db` = `af175edc7673befe9b9f3ace3c556c12`.
- **Smoke propio en copia de DB** (puerto 3489, matado por PID exacto, sin procesos en pie): `GET /` 200 con `src="/assets/index-*.js"` y `<div id="root"`; `GET /vanilla/` 200 con título «SuperInteligent System — Demo»; `GET /v2` 302 → `/`; `GET /v2/assets/x` 302 → `/assets/x`; login demo 200; `GET /api/opportunities` 200 (3 oportunidades, las del seed de la copia); `GET /api/stats` 200 coherente (3 oportunidades / 3 tareas abiertas / 3 borradores pendientes / 0 fallidas); `GET /assets/*.js` 200; `GET /vanilla/app.js` 200 con MD5 igual a la referencia.

## Lo que NO cambió

- Sin cambios de datos, de API, de UI del cliente ni de reglas de negocio.
- Sin capacidades nuevas ni ficticias: el flip es solo enrutado.
- Sin borrado de la vanilla ni de /v2/ como concepto: /v2/ redirige, /vanilla/ conserva.

## Pendiente para la verificación en vivo post-merge

En esta VM no hay Chromium/Playwright, así que lo visual no se pudo verificar. La verificación en vivo debe confirmar, en solo lectura y sin cerrar la sesión principal:

- `/` sirve la app React (indicadores sin cambios respecto del estado previo: 0/2/2/5).
- `/v2/` redirige a `/` (y un marcador viejo tipo `/v2/#/inicio` termina en la app principal).
- `/vanilla/` sirve la app vieja intacta.
- La pantalla de acceso nueva en incógnito (el navegador no puede abrir ventana privada sin cerrar la sesión principal, así que ese punto queda para captura del usuario, como en PR #63 y #64): dos paneles, logo sin distorsión, iconos en una fila, gráfico mayor, cierre en contacto y todo sin scroll.

## Autorización requerida

Subir y mergear (procedimiento habitual: snapshot de texto + verificación de PNG conservados + PR + merge + verificación en vivo solo lectura). Esta tarea fue solo local: no se hizo push, PR, merge ni despliegue.
