# C8 — Decisión TENANT + alta operada por PENSIA

- **Fecha:** 2026-10-26
- **Rama:** `ui-fase1-foundations` (local, sin subir ni mergear)
- **Alcance:** P-C8 (depende de P-C7). Criterio de aceptación: alta por
  invitación; sin registro público para clientes.

## Estado general

PASS. El plan C1–C8 queda completo. El registro público se eliminó y el
alta de empresas pasa a ser operada por PENSIA, con la decisión de
modelo multi-tenant documentada (D16).

## Qué se hizo, en palabras simples

1. **Decisión TENANT (D16): multi-tenant confirmado.** Un despliegue,
   una base, una organización por cliente separada por `org_id` en cada
   consulta (así funcionaba ya desde el MVP). La alternativa —una
   instancia dedicada por cliente— se descarta por ahora porque
   multiplica costo y operación y el plan gratis no la sostiene; se
   revisa si algún cliente exige más aislamiento en el futuro.
2. **Sin registro público.** El endpoint `/api/auth/register` se
   eliminó (ahora responde 404) y la pantalla de acceso ya no ofrece
   crear organizaciones.
3. **Alta por invitación.** PENSIA crea invitaciones con
   `POST /api/invitations`, protegido por un secreto del operador
   (`OPERATOR_TOKEN`, no por sesión: el operador no es usuario de
   ninguna empresa). Cada invitación vale para un correo y una empresa,
   vence a los 7 días y es de un solo uso; el código viaja una sola vez
   en la respuesta y en la base solo queda su hash. El cliente la canjea
   con `POST /api/auth/accept-invitation` (código + nombre + contraseña)
   y se crea su organización con su usuario administrador. La UI ofrece
   login + «Tengo una invitación» con su formulario.
4. **Sin cambios para lo existente.** El seed y las organizaciones ya
   creadas (incluida la demo) no se ven afectados: el login sigue igual
   y el correo duplicado se sigue rechazando (antes lo hacía el
   registro; ahora lo hace el canje, porque el login busca por correo y
   dos filas lo dejarían ambiguo).
5. **Operación.** `OPERATOR_TOKEN` se carga a mano en el dashboard de
   Render (`sync: false` en `render.yaml`, como `DATABASE_URL`); sin él,
   la creación de invitaciones está cerrada y la demo sigue funcionando.

## Archivos

- `app/src/db.ts`: tabla `invitations`.
- `app/src/domain.ts`: esquemas de invitación y canje (se eliminó el de
  registro).
- `app/src/routes.ts`: `POST /api/invitations`, `POST /api/auth/
  accept-invitation`; eliminado `POST /api/auth/register`.
- `app/src/server.ts`, `app/src/config.ts`, `app/src/index.ts`:
  `operatorToken` de entorno a rutas.
- `app/public/index.html`, `app/public/app.js`: acceso sin registro,
  con canje de invitación. Sin CSS nuevo.
- `render.yaml`: `OPERATOR_TOKEN` (a cargar en el dashboard).
- `app/src/server.test.ts`, `app/src/system.test.ts`,
  `app/src/postgres.test.ts`: migración de todos los helpers de alta al
  flujo de invitación + 4 tests nuevos C8.
- `docs/C8-REPORTE.md` (este informe), `docs/DECISIONS.md` (D16),
  `BACKLOG.md` (P-C8 PASS; TENANT cerrada), `docs/ARCHITECTURE.md`
  (decisión), `docs/GLOSARIO-PENSIA.md` (alta operada), `README.md`.

## Pruebas

- Build/typecheck limpios (`tsc`).
- **69/69 tests en verde** (4 nuevos C8: registro cerrado, creación
  exige secreto del operador con y sin configuración, ciclo completo
  con reuso/vencida/desconocida/duplicada rechazados, y UI sin registro
  y con aceptación; el resto de la suite migró al flujo de invitación).
- Smoke con servidor real (puerto 3225) sobre COPIA de la base local
  pre-C8 (la base real no se tocó): registro → 404, invitación creada,
  canje → organización + admin con cookie httpOnly, `/api/me` por
  cookie, reuso → 410, login demo → 200. Incidente del smoke: el primer
  intento no mostró el `Set-Cookie` por el mismo error de comando que en
  C7 (combinar `-i` con `-o` manda las cabeceras al archivo); no era un
  fallo del código. Temporales eliminados al final.

## Decisiones

- **El operador no es un usuario.** Las invitaciones se protegen con un
  secreto de entorno, no con sesión: no existe un rol «operador de
  PENSIA» en la base ni una organización de PENSIA. Si más adelante
  hace falta un panel de operador, se modela entonces.
- **El correo de la invitación manda.** El canje no pide correo: el
  administrador se crea con el correo invitado. Así el código no se
  puede reutilizar para abrir una organización a otro nombre.
- **Un solo uso y vencimiento real.** El reuso y el vencimiento se
  rechazan con 410 (distinto del 404 de código desconocido); el hash
  SHA-256 evita que una filtración de la base exponga códigos vigentes.

## Riesgos y límites

- `OPERATOR_TOKEN` hay que cargarlo en el dashboard de Render para
  poder invitar desde la demo pública; hasta entonces, crear
  invitaciones contra la demo responde 403 (las cuentas existentes no se
  ven afectadas).
- No hay listado ni revocación de invitaciones pendientes (solo
  creación y canje): si un código se filtra antes de usarse, hay que
  esperar a que venza (7 días) o borrar la fila en base. Queda como
  mejora futura, no como hueco de seguridad (el código es de 64
  caracteres aleatorios).
- El plan C1–C8 está completo; quedan abiertos del producto: G0-D1
  formal, F1-CI, Fase 6 de UI (QA y cierre, incl. `docs/design-system/`)
  y la revisión de la demo como cliente potencial (F3-DEMO).

## Próximo paso

Esperar la decisión de Tomás: subir C8 a la rama y/o mergear a `main`
(con su verificación visual), o encarar el siguiente trabajo (Fase 6 de
UI, F1-CI, o la revisión demo).
