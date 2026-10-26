# BACKLOG — SuperInteligent System

Estados: PLANNED · IN_PROGRESS · BLOCKED · PASS · FAIL · NOT_VERIFIED.
Ningún ítem es PASS sin evidencia (test ejecutado, link, registro).

## Gate 0 (en curso)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| G0-ENV | Alta | Inspección del entorno | — | Herramientas y trabajo previo documentados | Bajo | PASS | README (entorno verificado 2026-10-25); sin trabajo previo hallado |
| G0-DOCS | Alta | Entregables de Gate 0 | G0-ENV | 11 documentos creados y coherentes | Bajo | PASS | `docs/` + `BACKLOG.md` en `workspace/superinteligent-system/` |
| G0-D1 | Alta | Confirmar stack propuesto | G0-DOCS | Decisión humana registrada en DECISIONS | Medio | BLOCKED | Avance autorizado por Tomás el 25-oct-2026 («okey avancemos»); se construyó con el stack propuesto como supuesto reversible; la confirmación formal sigue pendiente |
| G0-D2 | Alta | Aprobar experimento E1 | G0-DOCS | Guion y acceso a entrevistados | Medio | CANCELLED | Cancelado 25-oct-2026 por decisión de Tomás (D12: no habrá entrevistas) |
| G0-D3 | Alta | Repo remoto + cuentas | G0-D1 | Repositorio remoto y proyecto Supabase creados | Medio | BLOCKED | Requiere autorización y credenciales |

## Validación (PLANNED)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| VAL-E1 | Alta | 10–15 entrevistas a fundadores del segmento prioritario | G0-D2 | Guion ejecutado, pregunta central respondida, patrón de dolor en ≥ 60% o H1 revisada | Alto | CANCELLED | Cancelado 25-oct-2026 (D12: no habrá entrevistas) |

## Fase 1 — MVP Core (completada 26-oct-2026; TENANT decidida en C8, D16)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| F1-SCAFF | Alta | Scaffold TS + Fastify + estructura modular | G0-D1, G0-D3 | `npm run dev` y `npm test` funcionan en local | Bajo | PASS |
| F1-CI | Media | CI básica (lint, tipos, tests) | F1-SCAFF, G0-D3 | PR en verde antes de merge | Bajo | PASS | Corrida #4 en verde el 26-oct-2026 tras el merge del PR #14 (docs/F1-CI-REPORTE.md). Sin paso de lint: el proyecto no tiene linter configurado.
| F1-AUTH | Alta | Auth + orgs + roles + usuarios | F1-SCAFF | Tests de escape multiempresa en verde | Alto | PASS |
| F1-INGEST | Alta | Alta manual + webhook firmado + idempotencia | F1-AUTH | Evento duplicado sin efectos duplicados | Alto | PASS |
| F1-NORM | Alta | Normalización + dedup + upsert | F1-INGEST | Casos de prueba de normalización y dedup en verde | Medio | PASS |
| F1-CLASS | Alta | Clasificación por reglas + prioridad | F1-NORM | Salida validada por esquema en todos los casos | Medio | PASS |
| F1-TASK | Alta | Tareas, borradores por plantilla, aprobaciones | F1-CLASS | Borrador sin aprobación no ejecuta acción externa | Alto | PASS |
| F1-AUDIT | Alta | Auditoría, ejecuciones, límites y métricas | F1-TASK | Ejecución auditable de punta a punta; fallo recuperable | Medio | PASS |
| F1-E2E | Alta | Tests de los 12 criterios de aceptación | F1-AUDIT | 12/12 criterios con test ejecutado | Alto | PASS |
| F1-DEMO | Media | Demo reproducible con datos ficticios | F1-E2E | Informe de pruebas + grabación o pasos reproducibles | Bajo | PASS |
| F1-TENANT | Media | Decidir modelo de despliegue por cliente | F1-AUTH | Decisión registrada (multi-tenant vs instancia dedicada) | Medio | PLANNED |

## Fase 1 — Resultado (25-oct-2026)

- Build TypeScript limpio (`npm run build`, sin errores).
- Tests: 15/15 en verde en 2 archivos (`server.test.ts` + `system.test.ts`):
  los 12 criterios del PRD más firma de webhook inválida y smoke de la UI.
- Seed: `npm run seed` crea la organización ficticia «Agencia Martín
  (demo)» con 3 oportunidades (automatización/high, marketing/medium,
  general/low), sus tareas y borradores.
- Smoke con servidor real: `GET /health` OK y login demo OK con JWT.
- Nota de precisión sobre F1-AUDIT: la auditoría, los límites, las
  métricas y el reintento están verificados; el worker asíncrono separado
  NO está implementado (la ejecución es síncrona con pasos persistidos y
  el reintento converge por dedup). Ver Deuda.

## Fase 2 — IA medida (PLANNED)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| F2-EVAL | Alta | Conjunto de evaluación fijo | F1-E2E | Casos con salida esperada, versionados | Medio | PLANNED |
| F2-AI | Alta | Proveedor de IA + clasificación/borradores con IA | F2-EVAL, claves aprobadas | Supera a reglas con margen predefinido o se descarta | Alto | PLANNED |

## Fase 3 — Demo de portafolio (PLANNED)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| F3-DEMO | Alta | Demo con tenant ficticio, recorrido guiado y caso documentado | F1-DEMO | Revisión de Tomás como potencial cliente: comprensible en < 10 min, profesional y creíble | Medio | PLANNED |

## Fase 4 — Plantilla y servicio (PLANNED)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| F4-TEMPLATE | Alta | Empaquetar la plantilla reutilizable | F3-DEMO | Guía de configuración por cliente; segundo vertical de ejemplo sin tocar el núcleo | Alto | PLANNED |
| F4-SERVICE | Media | Proceso de implementación por cliente | F4-TEMPLATE | Checklist de adaptación (workflows, agentes, herramientas, políticas, integraciones) | Medio | PLANNED |

## Alineación PENSIA (Fase C/D — Directiva 26-oct-2026, D15)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| P-C1 | Alta | Alineación nominal y documental, sin código | Diagnóstico A+B | README/docs dicen lo que el código hace; glosario PENSIA; docs desactualizados corregidos | Bajo | PASS |
| P-C2 | Alta | Trazabilidad expuesta (pasos por ejecución en API + UI) | P-C1 | Ver los pasos reales de una ejecución en la demo | Medio | PASS |
| P-C3 | Alta | Proceso como entidad + Workflow Registry mínimo | P-C2 | Una ejecución pertenece a un proceso versionado consultable; `runIntake` sin cambios internos | Medio | PASS |
| P-C4 | Alta | Agentes como entidades (los 5 actuales, deterministas) | P-C3 | La tarea muestra qué agente la generó; `assigned_to` deja de ser texto fijo | Medio | PASS |
| P-C5 | Alta | Aprobaciones con expiración (7 días) + invalidación si cambia el mensaje | P-C4 | Un borrador viejo o desincronizado no se puede aprobar | Medio | PASS |
| P-C6 | Media | Policy/Tool Registry mínimo + reintento con tope y solo admin | P-C5 | Tests de permisos en verde | Medio | PASS (26-oct-2026; informe docs/C6-REPORTE.md; 57/57 tests, 8 nuevos C6; smoke con servidor real OK) |
| P-C7 | Media | Worker asíncrono + endurecimiento (httpOnly, headers, rate limit, arranque sin secreto en prod) | P-C6 | Demo sigue verde + pruebas | Alto | PASS (26-oct-2026; informe docs/C7-REPORTE.md; 65/65 tests, 8 nuevos C7; smoke con servidor real + worker --once OK) |
| P-C8 | Alta | Decisión TENANT + alta operada por PENSIA | P-C7 | Alta por invitación; sin registro público para clientes | Medio | PASS (26-oct-2026; informe docs/C8-REPORTE.md; D16 multi-tenant; 69/69 tests, 4 nuevos C8; smoke con servidor real OK) |

Evidencia P-C1: `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`,
`docs/GLOSARIO-PENSIA.md`, README actualizado, correcciones en
`docs/ARCHITECTURE.md` y `docs/WORKFLOWS.md`, D15 en `docs/DECISIONS.md`.
Aprobado por Tomás el 26-oct-2026. Sin push ni merge (requieren aprobación
por separado).
Evidencia P-C2: endpoint `GET /api/executions/:id/steps` + botón
«Ver pasos» en Actividad; 34/34 tests en verde (3 nuevos C2); smoke con
servidor real (6 pasos en orden, 401 sin token). Informe en
`docs/C2-REPORTE.md`. Aprobado por Tomás el 26-oct-2026 («Seguí con C2»).
Sin push ni merge todavía.
Evidencia P-C3: tablas `workflows` y `process_runs`, siembra +
backfill en arranque, `runIntake` envuelto (pasos intactos), API de
procesos y workflows, tarjeta «Procesos» en Actividad; 39/39 tests en
verde (5 nuevos C3); smoke con servidor real (backfill de 3 corridas +
intake nuevo con `processRunId`). Informe en `docs/C3-REPORTE.md`.
Aprobado por Tomás el 26-oct-2026 («continuemos con lo siguiente»).
Evidencia P-C4: tabla `agents` (5 agentes deterministas con sus pasos
reales; QA y políticas sin paso propio), `agent_id` en tareas,
`ensureAgentCatalog` en arranque (siembra, migración portable y
backfill de tareas legado a Seguimiento), `GET /api/agents`,
`GET /api/tasks` con `agent_name`, «Agente:» en la lista de tareas;
44/44 tests en verde (5 nuevos C4); smoke con servidor real sobre
copia pre-C4 (migración, backfill y intake nuevo con agente).
Informe en `docs/C4-REPORTE.md`. Aprobado por Tomás el 26-oct-2026
(«podemos continuar con lo siguiente», sobre el cierre de C3).
Sin push ni merge todavía.
Evidencia P-C5: columna `source_message` en borradores (foto del
mensaje con el que se generó), `ensureDraftSnapshots` en arranque
(migración portable y backfill), controles al aprobar (409
`draft_expired` a los 7 días, 409 `draft_stale` si cambió el mensaje;
rechazar sigue permitido), `expired`/`stale` en `GET /api/drafts`,
marcas «Vencido»/«Desactualizado» y Aprobar deshabilitado en la UI;
49/49 tests en verde (5 nuevos C5); smoke con servidor real sobre
copia pre-C5 (los 4 caminos: vencido, desactualizado, fresco,
rechazo). Informe en `docs/C5-REPORTE.md`. Aprobado por Tomás el
26-oct-2026 («okey podes continuar», sobre el cierre de C4), con la
regla de explicar cada C terminado de forma sencilla y clara.
Sin push ni merge todavía.
Sin push ni merge todavía.

## Deuda y notas

- Búsqueda profunda de trabajo previo en el workspace completada el
  2026-10-25 sin resultados: no existe trabajo previo de SuperInteligent
  System.
- Sin claves de IA (bloqueo explícito, Fase 2). Supabase descartado:
  Neon verificado el 25-oct-2026 y demo pública en Render + Neon.
- Persistencia dual verificada (D14): SQLite local para desarrollo y
  Postgres (Neon) en la demo pública; tests pg-mem en verde y verificación
  real contra Neon completada el 25-oct-2026.
- Worker asíncrono separado NO implementado: la ejecución es síncrona con
  pasos persistidos; el reintento existe y converge por dedup. Es
  endurecimiento posterior, no un hueco en los criterios demostrados.
- La base demo (`app/data/`) está ignorada por git y se regenera con
  `npm run seed`; nunca se commitea con secretos demo.
