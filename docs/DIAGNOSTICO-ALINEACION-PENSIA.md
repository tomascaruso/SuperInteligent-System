# DIAGNÓSTICO DE ALINEACIÓN ESTRATÉGICA — PENSIA / SUPERINTELIGENT SYSTEM

Fecha: 26-oct-2026. Fases A (diagnóstico) y B (brechas) de la Directiva de
Alineación Estratégica PENSIA / SuperInteligent System.

Método: solo lectura de código, documentación y estado del repositorio. No se
modificó ningún archivo del proyecto durante el diagnóstico y no se
re-ejecutaron pruebas (para no escribir archivos); se cita la última
verificación real, del 26-oct-2026 a la mañana (Fase 5 de UI: 31/31 tests en
verde, build y typecheck limpios, smoke OK, verificación visual en vivo OK).

Aprobación: diagnóstico y plan aprobados por Tomás el 26-oct-2026. La Fase D
(implementación) arranca con C1 (este commit, solo documentación). Cada paso
posterior con código, cada merge a `main` y cada despliegue requieren
aprobación explícita por separado.

## 1. Estado real del proyecto

- Repo: `tomascaruso/SuperInteligent-System`. Rama local
  `ui-fase1-foundations` (limpia, `fc2b532`); `main` en `2523e7c6` tras el
  merge de la Fase 5 de UI (PR #4, 26-oct-2026).
- Demo pública viva en Render + Neon (plan gratis, duerme a los 15 min):
  https://superinteligent-system-demo-9e49.onrender.com/
- Stack real: TypeScript + Fastify 5 + Node 24, persistencia dual
  SQLite/Postgres (D14), bcrypt, JWT (12 h), zod, vitest. 11 tablas, 3
  archivos de test, UI en 5 vistas con sistema de tokens propio.
- Documentación: 12 documentos de Gate 0 + especificación UI/UX v1.1 + 6
  informes de fase (Fase 0 a 5). Gate 0 sigue sin aprobación formal (falta
  G0-D1, confirmación del stack) y la decisión multi-tenant vs. instancia por
  cliente (F1-TENANT) sigue abierta.
- PENSIA no aparece en ningún archivo del repo, ni en docs, ni en código, ni
  en la UI. La jerarquía nueva es, hasta este documento, solo la directiva.

## 2. Funcionalidades existentes y evidencia (verificada en código)

- **Auth y multi-tenant:** registro (crea org + admin), login, roles
  admin/member, todas las lecturas filtradas por `org_id`. Test de sistema:
  una org no ve datos de otra.
- **Ingesta:** alta manual + webhook con HMAC (comparación en tiempo
  constante) + idempotencia (tabla `idempotency_keys`, por header o hash del
  cuerpo).
- **Pipeline `opportunity.intake` v1:** normalización determinista, dedup por
  hash, clasificación por reglas explícitas (6 categorías, puntaje,
  prioridad, próxima acción, vencimiento 24/48/72 h). Sin IA.
- **Tareas y borradores:** tarea automática por oportunidad, borrador por
  plantilla, aprobación/rechazo solo admin con 409 si ya fue decidido, tabla
  `approvals` + auditoría. Aprobar solo cambia el estado a
  «En seguimiento»: **no envía ningún mensaje**, y el propio código lo aclara.
- **Ejecuciones:** workflow versionado, pasos persistidos en
  `execution_steps`, estados `done`/`failed` (más `running` transitorio),
  reintento manual de fallidas, límite de 100 oportunidades/día/org con 429.
- **Auditoría:** 11 acciones reales, consultable por oportunidad.
- **UI:** 5 vistas (inicio, oportunidades, tareas, aprobaciones, actividad),
  sin secciones ficticias: no muestra agentes, ni métricas inventadas, ni
  estados que no existen.

## 3. Diferencias respecto de la visión oficial

- **No hay orquestador como entidad.** Lo que hoy coordina es `runIntake`:
  una secuencia fija de pasos hardcodeada, no un proceso consultable,
  versionable ni reasignable.
- **No hay agentes como entidades.** Los 5 agentes de `WORKFLOWS.md`
  (Intake, Qualification, Response, Follow-up, QA) son nombres conceptuales
  sobre pasos del pipeline. No hay tabla, registro, ni permisos por agente.
  `tasks.assigned_to` es el texto fijo «Fundador», no una asignación.
- **Un solo workflow.** No hay Workflow Registry: `opportunity.intake` es un
  string literal en el código, no una definición versionada gestionable.
- **No hay Tool Registry ni Policy Engine.** No existen herramientas
  externas; la «política» actual son los roles + el límite diario.
- **No hay ejecución externa.** El paso Execute del flujo objetivo no
  existe: aprobar no dispara ninguna acción fuera del sistema. Es honesto
  hoy, pero es la brecha más grande hacia la visión.
- **Aprobaciones sin expiración.** El doc propone 7 días; el código no tiene
  expiración ni invalidación por cambio de contenido.
- **Sin worker asíncrono.** La ejecución es síncrona dentro de la request;
  sin cola, sin backoff, sin tope de reintentos.
- **Trazabilidad parcial.** `execution_steps` y `events` se escriben en base
  de datos pero ningún endpoint ni la UI los expone: la trazabilidad existe
  bajo tierra, no frente al operador.
- **La UI es una consola de CRM, no de agentes.** Muestra oportunidades,
  tareas, aprobaciones y actividad, pero no procesos activos, agentes
  asignados, resultados verificados vs. propuestos, ni intervenciones
  pendientes más allá de los borradores.
- **Modelo de cliente sin decidir.** Hoy es multi-tenant por `org_id` con
  registro público auto-servicio. La visión PENSIA (empresa que opera
  sistemas de clientes) exige decidir instancia por cliente vs. multi-tenant
  y alta operada, no auto-servicio.
- **Deuda de documentación.** `ARCHITECTURE.md` todavía dice que falta
  D14/Supabase (ya hecho: Neon verificado) y `WORKFLOWS.md` describe
  detalles que el código no tiene (teléfono normalizado, expiración de
  aprobaciones, estados de oportunidad no implementados). Decidir sobre docs
  desactualizados es un riesgo en sí mismo.

## 4. Qué conservar, qué adaptar, qué falta construir

- **Conservar:** todo el intake (validación, normalización, dedup,
  idempotencia, reglas), el sistema de aprobaciones con 409 + `approvals` +
  auditoría, el aislamiento multi-tenant, el HMAC, los tests y la base de UI
  con tokens.
- **Adaptar (sin reescribir):** exponer `execution_steps` por API y en la UI
  (el dato ya existe); convertir `assigned_to` en asignación explícita;
  agregar expiración/invalidación de aprobaciones; reintento con tope y
  backoff; reencuadrar la UI con el proceso como eje.
- **Construir, en orden:** (1) proceso como entidad + Workflow Registry
  mínimo, envolviendo `runIntake` sin tocarlo por dentro; (2) Agent Registry
  mínimo con los 5 agentes actuales, todavía deterministas; (3) Tool
  Registry + Policy Engine mínimo; (4) worker asíncrono (la tabla `events`
  hoy sin uso es candidata a outbox); (5) endurecimiento de producción;
  (6) recién después, IA medida (solo si supera a las reglas en evaluación)
  y envío real (solo tras aprobación, con idempotencia propia). Esos dos
  últimos ya estaban en el roadmap como Fase 2 y Fase 3; ahora quedan
  subordinados a la visión PENSIA.

## 5. Riesgos técnicos y de seguridad

- **JWT en la demo, bajo control:** `render.yaml` genera el secreto en
  Render, así que la demo pública no usa el secreto de desarrollo. El riesgo
  queda en despliegues fuera de Render sin `JWT_SECRET` (el arranque solo
  advierte, no falla) y en local, donde el default es esperable.
- **Token en `localStorage`:** documentado como demo; ante XSS, un script
  podría robarlo. Pendiente: cookie httpOnly + HTTPS, ya anotado en el
  propio código.
- **Registro público abierto:** cualquiera puede crear una org en la demo
  pública y consumir recursos de Neon. Aceptable para demo, inaceptable para
  clientes: el alta debe ser por invitación operada por PENSIA.
- **Aprobación desincronizada (hallazgo del código):** un intake duplicado
  actualiza el mensaje de la oportunidad pero no regenera el borrador
  pendiente. Un admin podría aprobar un texto viejo. Es el hueco más
  concreto contra la regla de «invalidar si cambia el contenido».
- **Reintento sin tope y no restringido a admin:** cualquier miembro puede
  re-ejecutar una ejecución fallida cuantas veces quiera. El dedup lo hace
  converger, pero el permiso y el tope faltan.
- **Auditoría por `LIKE` sobre JSON:** funciona hoy, es frágil ante cambios
  de formato; al escalar conviene una columna `opportunity_id`.
- **Sin rate limit en login ni headers de seguridad;** sin rotación expuesta
  del secreto de webhook.
- **Infra gratis:** sueño de Render, sin backups gestionados declarados.
  Demo, no producción de clientes.
- **Demo ya no prístina:** el borrador de Ana Ruiz lo aprobó Tomás probando;
  no debe usarse como evidencia de comportamiento inicial.

## 6. Plan incremental recomendado (Fase C, sin implementar salvo C1)

1. **C1 — Alineación nominal y documental, sin código:** PENSIA en README y
   docs, glosario (orquestador, agente, proceso, cliente), y corrección de
   los docs desactualizados. Criterio: que los docs digan lo que el código
   hace. (Ejecutado en este commit, tras la aprobación.)
2. **C2 — Trazabilidad expuesta:** endpoint de pasos por ejecución + detalle
   en la UI, con datos ya guardados. Criterio: ver los pasos reales de una
   ejecución en la demo.
3. **C3 — Proceso como entidad:** `process_runs` + Registry mínimo, sin
   cambiar `runIntake` por dentro.
4. **C4 — Agentes como entidades:** tabla de agentes (los 5 actuales,
   deterministas) y asignación real en tareas.
5. **C5 — Aprobaciones con expiración (7 días, propuesta del doc) +
   invalidación si cambia el mensaje.**
6. **C6 — Policy/Tool Registry mínimo + reintento con tope y solo admin.**
7. **C7 — Worker asíncrono + endurecimiento** (httpOnly, headers, rate
   limit, arranque que falle sin secreto en producción).
8. **C8 — Decisión TENANT + alta operada por PENSIA**, antes de cualquier
   cliente real.
