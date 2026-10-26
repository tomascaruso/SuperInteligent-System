# C7 — Worker asíncrono + endurecimiento

- **Fecha:** 2026-10-26
- **Rama:** `ui-fase1-foundations` (local, sin subir ni mergear)
- **Alcance:** P-C7 (depende de P-C6). Criterio de aceptación: demo sigue
  verde + pruebas.

## Estado general

PASS. El sistema suma un worker real y cuatro endurecimientos pedidos por
la directiva, sin romper ningún contrato existente: el alta manual y el
webhook siguen devolviendo la oportunidad creada en el acto.

## Qué se hizo, en palabras simples

1. **Worker asíncrono.** Nueva tabla `jobs` y proceso aparte
   (`app/src/worker.ts`, `npm run worker`, con `--once` para una pasada):
   se encola una ingesta con `POST /api/jobs` (responde 202), el worker la
   procesa, crea la oportunidad con su ejecución y marca el job; el estado
   se consulta con `GET /api/jobs/:id`. El alta manual y el webhook NO se
   migraron a este camino: cambiarlos habría cambiado lo que devuelven y
   exige una UI con espera/consulta. Eso queda como paso posterior,
   documentado, no hecho en silencio.
2. **Reconciliación de huérfanos (riesgo anotado en C3).** En cada
   arranque del servidor y en cada pasada del worker: una ejecución en
   `running` más vieja que una hora solo puede ser una caída a mitad de
   intake y se marca fallida con causa `interrupted`; una corrida en
   `running` cuya ejecución ya terminó adopta el estado de su ejecución.
3. **Sesión en cookie httpOnly.** El token ya no vive en `localStorage`
   (donde cualquier script lo podía leer): el servidor lo pone en una
   cookie httpOnly al entrar y salir, el navegador la manda sola, y la UI
   detecta la sesión con `/api/me`. El token en el cuerpo de la respuesta
   y el header Bearer se mantienen para clientes API y tests.
4. **Cabeceras de seguridad** en todas las respuestas: `nosniff`,
   `DENY` para frames, `Referrer-Policy` y `Content-Security-Policy`
   `default-src 'self'` (la app solo sirve recursos del mismo origen, sin
   scripts ni estilos externos ni inline: verificado por inspección).
5. **Límite de intentos de login:** 20 intentos fallidos por IP cada 15
   minutos; el 21 responde 429 `rate_limited`. Solo cuentan los fallidos
   y el estado vive en memoria (se pierde al reiniciar: es un tope
   anti-fuerza-bruta, no auditoría).
6. **Arranque que falla sin secreto en producción.** Antes solo se
   avisaba por consola y se seguía con el secreto de desarrollo, que
   cualquiera conoce. Ahora, con `NODE_ENV=production` y sin `JWT_SECRET`
   real, el servidor no arranca. `render.yaml` fija `NODE_ENV=production`
   (Render ya genera `JWT_SECRET` en el dashboard, así que el despliegue
   no se ve afectado).

## Archivos

- `app/src/db.ts`: tabla `jobs`.
- `app/src/engine.ts`: `enqueueIntakeJob`, `processPendingJobs`,
  `reconcileOrphans`.
- `app/src/worker.ts`: proceso worker (bucle con `WORKER_INTERVAL_MS`,
  `--once`, cierre limpio con SIGINT/SIGTERM).
- `app/src/auth.ts`: el token se lee de la cookie httpOnly o del header
  Bearer.
- `app/src/routes.ts`: cookie al entrar, `POST /api/auth/logout`,
  límite de login, `POST /api/jobs` y `GET /api/jobs/:id`.
- `app/src/server.ts`: cabeceras de seguridad y reconciliación en cada
  arranque.
- `app/src/config.ts` + `app/src/index.ts`: `assertProductionSecret`
  (testeable) y fail-fast en producción.
- `app/public/app.js`: sin `localStorage`, logout contra el servidor,
  sesión detectada por `/api/me`. Sin CSS nuevo.
- `app/package.json`: script `worker`. `render.yaml`: `NODE_ENV`.
- `app/src/server.test.ts`, `app/src/system.test.ts`,
  `app/src/postgres.test.ts`: 8 tests nuevos C7.
- `docs/C7-REPORTE.md` (este informe), `BACKLOG.md` (P-C7 PASS),
  `docs/ARCHITECTURE.md` (worker), `README.md` (última actualización C7).

## Pruebas

- Build/typecheck limpios (`tsc`).
- **65/65 tests en verde** (8 nuevos C7: cabeceras, cookie login/me/
  logout, rate limit 20→401 y 21→429, fail-fast en producción, app.js sin
  localStorage, job encolado→procesado→oportunidad creada, reconciliación
  de ejecución vieja y corrida huérfana, y el camino Postgres/pg-mem).
- Smoke con servidor real (puerto 3222/3223) sobre COPIA de la base local
  pre-C7 (la base real no se tocó): las 4 cabeceras presentes, login con
  cookie httpOnly, `/api/me` autenticado por cookie, job encolado →
  `worker --once` lo procesa (1 ok) → job `done` con ejecución y 4
  oportunidades (3 del seed + 1 del job), logout borra la cookie.
  Incidente del smoke: el primer intento no mostró el `Set-Cookie` porque
  el comando combinaba `-i` con `-o` y curl mandaba las cabeceras al
  archivo, no a la salida; no era un fallo del código (segundo intento
  con `-D` lo confirmó). Temporales eliminados al final.

## Decisiones

- **Worker aditivo, no migración silenciosa.** Cambiar el alta a
  asíncrono habría roto su contrato (201 + oportunidad) y dejado a la UI
  sin forma de mostrar el resultado. El camino asíncrono existe y se
  prueba; la migración es trabajo visible posterior.
- **Sin dependencias nuevas.** Cabeceras y rate limit son código propio
  (unas 30 líneas): no se sumaron `helmet` ni plugins de rate limit para
  no agrandar la superficie de dependencias del MVP.
- **Rate limit en memoria.** Simple y suficiente para un tope
  anti-fuerza-bruta; con varias instancias no se comparte (el MVP corre
  una sola).
- **Sin servicio worker en `render.yaml`.** No se verificó si el plan
  gratis de Render admite un background worker; agregarlo sin verificar
  podía romper el despliegue. Queda como decisión pendiente para Tomás
  (la demo funciona con o sin worker, por los caminos sincrónicos).

## Riesgos y límites

- La vía ALTER de `jobs` no aplica (tabla nueva, viene del DDL); en
  Postgres real la tabla se crea en el primer arranque tras el despliegue
  (como pasó con `policies` en C6).
- El CSP `default-src 'self'` se verificó por inspección del código (sin
  recursos externos ni inline); la verificación visual post-despliegue
  debe confirmar que la app carga y funciona en el navegador real.
- El worker en la demo pública no corre hasta que se decida su servicio
  en Render; mientras tanto los jobs encolados quedarían pendientes (el
  alta normal no usa jobs, así que nada visible se ve afectado).

## Próximo paso

Esperar la decisión de Tomás: subir C7 a la rama y/o mergear a `main`
(con su verificación visual), o seguir con C8 (decisión TENANT + alta
operada por PENSIA).
