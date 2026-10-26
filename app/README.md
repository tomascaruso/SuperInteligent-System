# App — SuperInteligent System (MVP Fase 1 completo)

Servidor API + interfaz web mínima del monolito modular (TypeScript +
Fastify). Estado: MVP Fase 1 completo en local (F1-SCAFF → F1-DEMO).

## Qué incluye

- Autenticación (bcrypt + JWT), organizaciones multi-tenant, usuarios
  (admin crea miembros; solo admin aprueba/rechaza borradores).
- Alta manual de oportunidades + ingesta por webhook firmado (HMAC) con
  idempotencia.
- Normalización, deduplicación, clasificación por reglas explícitas y
  prioridad, tarea siguiente automática y borrador por plantilla.
- Aprobaciones humanas obligatorias antes de cualquier acción externa
  (en el MVP no hay envíos externos reales: aprobar mueve la oportunidad
  a seguimiento y queda auditado).
- Auditoría completa, ejecuciones con pasos persistidos y reintento,
  límites por organización y estadísticas.
- Interfaz web mínima en `/` (registro, login, oportunidades, tareas,
  borradores, auditoría, ejecuciones).
- Seed de demo con la agencia ficticia de Martín.

## Cómo correr

```bash
cd app
npm install
npm run dev     # desarrollo con recarga (tsx)
npm run build   # compila a dist/
npm start       # corre lo compilado
npm test        # tests con Vitest (17 tests: 12 criterios + 3 + 2 Postgres)
npm run typecheck
npm run seed    # crea la demo (idempotente; imprime las credenciales demo)

## Backend de base de datos

- SQLite local (por defecto): `npm run dev` usa `DATABASE_PATH`.
- Postgres (p. ej. Neon): definí `DATABASE_URL` y la app usa `pg`:
  `DATABASE_URL=postgresql://usuario:clave@host/db npm run dev`.
  Sin `DATABASE_URL`, siempre SQLite. Los tests de Postgres corren
  contra pg-mem (emulador); la verificación contra un Postgres real
  queda pendiente (ver `docs/OPERATIONS.md`).
```

Cuenta demo (SOLO local, tras `npm run seed`):
`demo@agenciamartin.demo` / `Demo1234!`

## Variables de entorno

- `HOST` (por defecto `127.0.0.1`; solo local en desarrollo)
- `PORT` (por defecto `3000`)
- `DATABASE_URL` (si está definida, Postgres vía `pg`; si no, SQLite)
- `DATABASE_PATH` (por defecto `./data/superinteligent.db`; `:memory:` en tests)
- `JWT_SECRET` (por defecto `dev-jwt-secret`, SOLO desarrollo)
- `MAX_OPPORTUNITIES_PER_DAY` (por defecto `100` por organización)

Los secretos nunca se imprimen en logs ni se commitean. La base demo
(`data/`) está ignorada por git.

## Estructura

```text
src/
  index.ts        arranque + cierre ordenado (SIGINT/SIGTERM)
  server.ts       construcción del servidor (db + rutas)
  config.ts       configuración por entorno
  db.ts           esquema + adaptadores SQLite/Postgres + auditoría
  domain.ts       validación, normalización, dedup, clasificación, plantilla
  auth.ts         bcrypt, JWT, autenticación y roles
  engine.ts       workflow opportunity.intake v1 (pasos persistidos, reintento)
  routes.ts       API REST + interfaz estática
  seed.ts         siembra de la demo ficticia
  server.test.ts  smoke de /health y de la UI
  system.test.ts  12 criterios de aceptación del MVP + seguridad
  postgres.test.ts  camino Postgres contra pg-mem (D14)
public/
  index.html      interfaz mínima
  app.js          lógica de la interfaz (fetch + token en localStorage)
```

## Rutas principales

- `GET /health` · `GET /` (UI) · `GET /app.js`
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/me`
- `POST /api/users` (admin)
- `POST /api/opportunities` · `GET /api/opportunities` · `GET /api/opportunities/:id`
- `POST /api/ingest/:orgId` (webhook HMAC + `x-idempotency-key`)
- `GET /api/tasks` · `PATCH /api/tasks/:id`
- `GET /api/drafts` · `POST /api/drafts/:id/approve` · `POST /api/drafts/:id/reject` (admin)
- `GET /api/audit` · `GET /api/executions` · `POST /api/executions/:id/retry`
- `GET /api/stats`

## Demo vs. producción (leer antes de exponer)

Demo-grado en este MVP: JWT_SECRET por defecto, token en localStorage,
secreto de webhook visible para el admin, ejecución síncrona (sin worker
asíncrono separado) y sin rate limiting global. El adaptador Postgres
(D14) ya está implementado: con `DATABASE_URL` la app corre contra
Postgres y sin ella contra SQLite local. Pendiente para producción (ver
`docs/SECURITY.md` y D14): verificación contra un Postgres real,
Supabase Auth + PostgreSQL con RLS, secretos en gestor dedicado, cookie
httpOnly, HTTPS, rate limiting, worker asíncrono y CI con repo remoto.

## Despliegue demo (Render + Neon)

Blueprint en `../render.yaml` (servicio web Node, plan gratis). Pasos
manuales: subir la rama a un repo remoto, crear el proyecto Neon gratis,
crear el servicio en Render desde el blueprint con su `DATABASE_URL`,
sembrar la demo una vez desde la Shell de Render
(`cd app && npm run seed`) y verificar `/health`, login demo y
`/api/stats` en la URL pública. Detalle y límites del plan gratis en
`docs/OPERATIONS.md`. Node requerido: >= 24 (ver `.node-version`).
