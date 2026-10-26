# C4 — Agentes como entidades — REPORTE

Fecha: 26-oct-2026. Paso C4 del plan de `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`
(Fase C/D, D15). Aprobado por Tomás el 26-oct-2026 («podemos continuar con
lo siguiente», sobre el cierre de C3). Sin push ni merge (requieren
aprobación por separado).

## Estado general

PASS. Las tareas ya no cuelgan de un texto fijo: cada tarea pertenece a un
agente del registry, y la UI muestra cuál la generó. Los 5 agentes siguen
siendo deterministas: la tabla los convierte en entidades consultables, no
les agrega IA, autonomía ni envío alguno.

## Objetivo

Criterio de aceptación P-C4: la tarea muestra qué agente la generó;
`assigned_to` deja de ser texto fijo. Cumplido: tabla, API, UI, tests y
smoke con servidor real.

## Acciones

1. **Esquema:** tabla nueva `agents` (registry global, como `workflows`:
   id slug, nombre en español, descripción, pasos en JSON, orden) y
   columna `agent_id` en `tasks` (con FK en bases nuevas). Ninguna tabla
   existente se alteró salvo agregar esa columna.
2. **Catálogo en arranque (`ensureAgentCatalog`, en `initSchema`):**
   siembra los 5 agentes si faltan; migración portable para bases pre-C4
   (probar la columna y hacer ALTER solo si falta, porque SQLite,
   Postgres y pg-mem fallan igual si no existe); backfill idempotente:
   cada tarea sin agente recibe `follow_up` y su `assigned_to` pasa de
   «Fundador» a «Seguimiento» (ver Decisiones).
3. **Engine sin cambios de pasos:** `ensureTaskAndDraft` crea la tarea
   con `agent_id = 'follow_up'` y `assigned_to = 'Seguimiento'`
   (constantes compartidas con `db.ts`, no un literal nuevo). Los pasos
   (normalize, dedup, classify, upsert, next_action, draft) no se
   tocaron.
4. **API:** `GET /api/agents` (registry global, con auth, en orden, con
   los pasos parseados) y `GET /api/tasks` con JOIN a `agents` (trae
   `agent_name`; columnas explícitas para no duplicar `agent_id`).
   `PATCH /api/tasks/:id` no cambió (la UI refresca con GET).
5. **UI:** la lista de tareas muestra «Agente: Seguimiento» (fallback a
   `assigned_to` si no hay agente). Sin CSS nuevo.
6. **Docs:** este informe, BACKLOG (P-C4 PASS), glosario (estado del
   agente actualizado), nota C4 en `WORKFLOWS.md` y README.

Los 5 agentes, con sus pasos reales del pipeline:

| id | Nombre | Pasos |
|---|---|---|
| intake | Captación | normalize, dedup |
| qualification | Calificación | classify |
| response_proposal | Respuesta y propuesta | draft |
| follow_up | Seguimiento | next_action |
| qa_policy | QA y políticas | (ninguno: revisa antes de aprobar, sin aprobar solo) |

## Archivos

- `app/src/db.ts`: tabla `agents`, `agent_id` en `tasks`,
  `KNOWN_AGENTS`, `ensureAgentCatalog` (siembra, migración, backfill).
- `app/src/engine.ts`: `TaskRow.agent_id`; la tarea nueva lleva agente
  Seguimiento.
- `app/src/routes.ts`: `TaskRow` con agente, JOIN en `GET /api/tasks`,
  endpoint `GET /api/agents`.
- `app/public/app.js`: «Agente:» en cada tarea abierta.
- Tests: `app/src/server.test.ts`, `app/src/system.test.ts`,
  `app/src/postgres.test.ts` (5 nuevos C4).
- Docs: `docs/C4-REPORTE.md`, `BACKLOG.md`, `docs/GLOSARIO-PENSIA.md`,
  `docs/WORKFLOWS.md`, `README.md`.

## Pruebas

Build limpio (`tsc`) y **44/44 tests en verde** (5 nuevos C4):

- Registry: `GET /api/agents` devuelve los 5 en orden, con sus pasos;
  QA y políticas con lista vacía (no inventada); 401 sin token.
- Intake: la tarea creada lleva `agent_id = 'follow_up'`,
  `assigned_to = 'Seguimiento'` y `agent_name = 'Seguimiento'`.
- Backfill: una tarea legado (`assigned_to = 'Fundador'`, sin agente)
  queda con agente Seguimiento tras `ensureAgentCatalog`.
- UI: `/app.js` sirve «Agente:» en la lista de tareas.
- Postgres (pg-mem): catálogo de 5 agentes y tarea con agente en el
  mismo flujo que el MVP.

Smoke con servidor real (puerto 3218) sobre una COPIA de la base local
pre-C4 (la base real no se tocó): antes, `tasks` no tenía `agent_id` y
las 3 tareas decían «Fundador»; tras arrancar, la columna existe, las 3
tareas quedaron backfilleadas (Seguimiento / follow_up), `GET /api/agents`
devuelve los 5 y un intake nuevo crea su tarea con agente Seguimiento.
Servidor matado por PID y temporales eliminados al final.

## Evidencia

- Tests: 44/44 (antes 39/39). Build: limpio.
- Smoke: migración, backfill, registry e intake nuevo verificados en
  vivo contra la copia pre-C4 (ver Pruebas).
- Ningún paso del pipeline cambió; ningún envío nuevo; ninguna
  capacidad ficticia agregada.

## Decisiones

- **Registry global, no por org:** como `workflows`; el Core no se
  bifurca por cliente (D13).
- **QA y políticas con pasos vacíos:** no tiene paso propio en el
  pipeline actual; inventarle uno habría sido capacidad ficticia. Su
  revisión vive antes de la aprobación, fuera del pipeline.
- **`assigned_to` se conserva** como nombre visible del agente (no se
  rompe el contrato de la API); la referencia canónica es `agent_id`.
- **Backfill a Seguimiento:** el único escritor de tareas es el paso
  `next_action`, de ese agente; «Fundador» era un placeholder, no una
  persona. Atribuir las tareas legado a Seguimiento es fiel al código
  que las creó.
- **PATCH de tareas sin cambios:** devuelve la fila plana como antes;
  la UI ya refresca con GET tras marcar hecha.

## Riesgos

- La vía ALTER en Postgres real no se ejerció (pg-mem cubre DDL,
  catálogo y JOIN; la migración ALTER solo se ejerció en SQLite). Al
  desplegar, el arranque en Render/Neon ejecutará la migración; si
  fallara, el inicio fallaría de forma visible, no silenciosa. En la
  verificación post-despliegue hay que confirmar que las 3 tareas de la
  demo muestren «Seguimiento».
- En bases migradas, `agent_id` no tiene FK (el ALTER agrega columna
  plana); en bases nuevas sí. Riesgo bajo: el único escritor es el
  engine, con un id del catálogo.
- Los `execution_steps` todavía no registran agente por paso; el mapeo
  paso→agente vive en `steps_json` del registry. Eso queda fuera de C4.

## Próximo paso

C5 (aprobaciones con expiración de 7 días + invalidación si cambia el
mensaje) cuando Tomás lo decida; o subir C4 a la rama
`ui-fase1-foundations` (sin mergear).

## Autorización requerida

Subir a la rama y mergear a `main` requieren aprobación por separado.
Sin despliegue a producción.
