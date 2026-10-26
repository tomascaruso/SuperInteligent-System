# C3 — Proceso como entidad + Workflow Registry mínimo — REPORTE

Fecha: 26-oct-2026. Paso C3 del plan de `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`
(Fase C/D, D15). Aprobado por Tomás el 26-oct-2026 («continuemos con lo
siguiente»). Sin push ni merge (requieren aprobación por separado).

## Estado general

PASS. Cada ejecución pertenece ahora a una corrida de proceso versionada
y consultable, y existe un Registry con el único workflow real del
sistema. El pipeline de intake por dentro no cambió: solo se lo envuelve
(prologo + epílogo).

## Objetivo

Criterio de aceptación C3: una ejecución pertenece a un proceso versionado
consultable; `runIntake` sin cambios internos. Cumplido: tablas, API, UI,
tests y smoke con servidor real.

## Acciones

1. **Esquema (sin migración destructiva):** dos tablas nuevas en el DDL
   compartido SQLite/Postgres, `workflows` (clave natural workflow +
   versión, nombre, pasos en JSON) y `process_runs` (org, workflow,
   versión, estado, ejecución asociada, fechas). No se alteró ninguna
   tabla existente: la relación va del lado de la corrida
   (`process_runs.execution_id`), así que no hizo falta un ALTER portable.
2. **Catálogo en arranque (`ensureProcessCatalog`, en `initSchema`):**
   siembra `opportunity.intake` v1 con sus 6 pasos reales en orden, y
   backfill idempotente: cada ejecución anterior a C3 recibe su corrida
   con sus mismos datos (una corrida por ejecución, estado y fechas
   copiados). Corre en cada arranque (SQLite, Postgres y pg-mem).
3. **Envoltura de `runIntake`:** al inicio crea la corrida en `running`;
   al final, el mismo `finish` de la ejecución espeja el estado en la
   corrida (`done`/`failed`). Los pasos (normalize, dedup, classify,
   upsert, next_action, draft) no se tocaron. El resultado suma
   `processRunId` (aditivo, no rompe el contrato).
4. **API:** `GET /api/workflows` (registry global, con auth),
   `GET /api/processes` (corridas de la org con su ejecución, un solo
   JOIN) y `GET /api/processes/:id` (corrida + ejecución; 404 si es de
   otra org o no existe, 401 sin token).
5. **UI:** tarjeta «Procesos» en la vista Actividad: workflow, versión,
   estado (En curso/Completada/Fallida), fecha y ejecución asociada
   (id corto). Estados vacíos y de carga, sin CSS nuevo.
6. **Docs:** este informe + `BACKLOG.md` (P-C3 a PASS) + glosario
   (entrada Proceso actualizada) + README (pendientes C4–C8).

## Archivos

- `app/src/db.ts`: tablas `workflows` y `process_runs`,
  `ensureProcessCatalog` (siembra + backfill).
- `app/src/engine.ts`: creación de corrida y espejo de estado en
  `finish`; `processRunId` en `IntakeResult`.
- `app/src/routes.ts`: interfaces y endpoints de workflows y procesos.
- `app/public/index.html`: tarjeta «Procesos».
- `app/public/app.js`: lista de procesos en Actividad.
- `app/src/system.test.ts`: 4 tests C3. `app/src/server.test.ts`: 1 test C3.
- `docs/C3-REPORTE.md`: este informe. `BACKLOG.md`, `docs/GLOSARIO-PENSIA.md`,
  `README.md`: actualizaciones C3.

Sin cambios en: pasos del pipeline, contratos existentes, CSS, ni
`events` (sigue sin uso; candidata a outbox en C7).

## Pruebas

- Build TypeScript limpio y typecheck limpio.
- Tests: **39/39 en verde** (34 previos + 5 nuevos C3: 4 de sistema,
  1 de servidor), 3 archivos.
- Incidente en el camino: el backfill con `NOT EXISTS` correlacionado
  falló en pg-mem («column e.id does not exist»); se reescribió con
  `LEFT JOIN ... IS NULL` (equivalente) y los 2 tests de Postgres
  volvieron a verde. Queda documentado como límite del emulador, no del
  motor real.
- Smoke con servidor real (puerto 3217, COPIA de la base demo pre-C3 en
  /tmp, base real intacta, temporales eliminados): `/health` OK, login
  demo OK, backfill real verificado (3 ejecuciones viejas → 3 corridas
  `done` con ejecución), intake nuevo con `processRunId` (4 corridas, la
  nueva `done`), registry con `opportunity.intake` v1 y sus 6 pasos, HTML
  con tarjeta «Procesos» y `/app.js` con `/api/processes`.

## Evidencia

- `GET /api/processes` → corridas con `{ workflow, workflow_version,
  status, created_at, updated_at, execution: { id, status } }`.
- `GET /api/workflows` → `[{ workflow: 'opportunity.intake', version:
  '1', name: 'Captación de oportunidad', steps: [6 pasos] }]`.
- La verificación visual en navegador real queda pendiente del próximo
  despliegue aprobado (igual que en los pasos anteriores).

## Decisiones

- Relación 1:1 corrida–ejecución en este flujo (columna
  `process_runs.execution_id` en vez de tabla de join): es lo real hoy
  (cada intake es exactamente una ejecución) y evita un ALTER portable.
  Cuando un proceso tenga varias ejecuciones (agentes en C4+), el paso
  será una tabla de join; queda anotado, no inventado.
- Backfill en arranque en vez de migración manual: la demo pre-C3 queda
  coherente sin intervención del operador y sin tocar datos existentes.
- `running` como estado real de corrida (no inventado): una corrida puede
  quedar en `running` si el servidor cae a mitad del intake; la UI lo
  muestra como «En curso» con badge neutro.

## Riesgos

- Corridas en `running` huérfanas tras una caída: existen también en
  ejecuciones (mismo problema previo); C7 (worker) deberá reconciliarlas
  o marcarlas fallidas al arrancar.
- El registry hoy tiene un solo workflow y se siembra desde el código:
  si aparece un segundo workflow real, su siembra debe agregarse en
  `KNOWN_WORKFLOWS` con sus pasos reales, no a mano en la base.

## Próximo paso

C4 (agentes como entidades) cuando Tomás lo apruebe, o subida de C3 a la
rama `ui-fase1-foundations` sin mergear.

## Autorización requerida

- Push a la rama y merge a `main`: NO autorizados todavía (pedir por
  separado).
- Despliegue: lo dispara Render solo al cambiar `main`; no hay despliegue
  con este commit local.
