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

## Fase 1 — MVP Core (completada 25-oct-2026, salvo CI y TENANT)

| ID | Prioridad | Objetivo | Dependencias | Criterio de aceptación | Riesgo | Estado |
|---|---|---|---|---|---|---|
| F1-SCAFF | Alta | Scaffold TS + Fastify + estructura modular | G0-D1, G0-D3 | `npm run dev` y `npm test` funcionan en local | Bajo | PASS |
| F1-CI | Media | CI básica (lint, tipos, tests) | F1-SCAFF, G0-D3 | PR en verde antes de merge | Bajo | PLANNED |
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

## Deuda y notas

- Búsqueda profunda de trabajo previo en el workspace completada el
  2026-10-25 sin resultados: no existe trabajo previo de SuperInteligent
  System.
- Sin claves de IA ni acceso verificado a Supabase: ambos son bloqueos
  explícitos, no supuestos.
- Persistencia local con SQLite (node:sqlite, D14) y adaptador
  PostgreSQL implementado en la rama `d14-postgres` (DATABASE_URL elige
  Postgres, con tests pg-mem en verde); falta la verificación contra un
  Postgres real (Neon, G0-D3).
- Worker asíncrono separado NO implementado: la ejecución es síncrona con
  pasos persistidos; el reintento existe y converge por dedup. Es
  endurecimiento posterior, no un hueco en los criterios demostrados.
- La base demo (`app/data/`) está ignorada por git y se regenera con
  `npm run seed`; nunca se commitea con secretos demo.
