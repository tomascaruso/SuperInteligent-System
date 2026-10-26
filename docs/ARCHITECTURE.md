# ARCHITECTURE — SuperInteligent Core + Business Operations Orchestrator

## Decisión base (propuesta, pendiente de confirmación humana)

**Monolito modular en TypeScript + Node.js 24**, sin microservicios
prematuramente. Un solo despliegue para API + web, módulos con límites
explícitos y contratos internos versionados. Si un módulo demuestra necesitar
escala independiente, se extrae entonces, con evidencia.

## Stack propuesto (ver `docs/DECISIONS.md` para alternativas)

| Capa | Propuesta | Estado de verificación |
|---|---|---|
| Lenguaje/runtime | TypeScript, Node 24 (disponible: v24.22.1) | Verificado en VM |
| API | Fastify + validación por esquemas JSON (Zod en el borde) | A instalar en Fase 1 |
| Base de datos | PostgreSQL vía Supabase en producción; SQLite local (node:sqlite) en el MVP | Adaptador Postgres NO verificado (D14) |
| Ejecución durable | Patrón outbox en Postgres + worker (sin cola externa en MVP) | Diseño |
| IA | Abstracción de proveedor (interfaz + stub; compatible OpenAI) | Sin claves; stub en MVP |
| Auth | JWT del lado del servidor + `org_id` obligatorio en cada consulta | Diseño |
| Frontend MVP | Web server-rendered o SPA ligera sobre la misma API | A decidir en Fase 1 |
| Hosting candidato | Vercel (cuenta negociodigital ya conectada para otros proyectos) | Sin despliegue en Gate 0 |

## Módulos del núcleo (límites)

1. **Event Ingestion:** recibe eventos (webhook firmado / alta manual), valida
   esquema, asigna `event_id` e `Idempotency-Key`, descarta duplicados.
2. **Workflow Registry:** definiciones versionadas (`workflow_id`, `version`).
3. **Execution Engine:** ejecuta pasos en orden, con estado persistido por paso.
4. **State Management:** tablas `executions`, `execution_steps`, `events`;
   transiciones solo por estados permitidos (ver `docs/WORKFLOWS.md`).
5. **Dispatcher:** elige agente/función según el paso; nunca según texto libre
   sin validar.
6. **Policy Engine:** permisos por rol y organización, límites de coste y
   frecuencia; el planificador NO puede modificar sus propias políticas.
7. **Agent Registry:** agentes con responsabilidad, entradas/salidas y
   herramientas autorizadas (ver directiva, sección 7).
8. **Tool Registry:** herramientas declaradas con permisos explícitos; ninguna
   herramienta arbitraria.
9. **Approval Manager:** aprobaciones humanas con expiración y registro.
10. **Retry and Recovery:** reintentos con backoff y tope; fallos a estado
    `failed` con causa, nunca reintentos infinitos.
11. **Audit and Observability:** log de auditoría sin secretos; métricas por
    ejecución (latencia, coste, fallos).
12. **Evaluation Layer:** casos de prueba para clasificación y borradores;
    la IA solo se adopta si supera a las reglas en esos casos.

## Modelo de datos mínimo (MVP)

- `organizations(id, name)` · `users(id, org_id, role)` · `contacts`,
  `opportunities(id, org_id, source, status, priority, dedup_key, ...)`,
  `tasks(id, org_id, opportunity_id, owner, due_at, status)`,
  `drafts(id, org_id, opportunity_id, body, status)` — `pending_approval`,
  `approved`, `rejected` — `executions`, `execution_steps`, `events`,
  `audit_log`, `approvals`.
- **Aislamiento:** toda consulta filtra por `org_id` del token; RLS en
  Supabase como segunda barrera; test de escape multiempresa obligatorio.

## Flujo de una ejecución

Evento → validación → normalización → dedup → upsert oportunidad →
clasificación (reglas; IA solo con eval) → siguiente acción → tarea +
borrador → aprobación humana → (acción externa solo si está aprobada y
dentro de límites) → registro + auditoría. Detalle en `docs/WORKFLOWS.md`.

## Idempotencia

- `Idempotency-Key` por evento entrante; reenvíos devuelven el resultado
  original sin efectos nuevos.
- `dedup_key` por oportunidad (correo/dominio normalizado + nombre
  normalizado); colisión → actualización, no duplicado.
- Acciones externas: solo tras aprobación y con clave de idempotencia
  propia; nunca reenviar una acción externa por un reintento ciego.

## Modelo de plantilla reutilizable (D13)

El Core es la plantilla; cada cliente es una ADAPTACIÓN, no una bifurcación:

- **Núcleo (no cambia por cliente):** ingestion, registry, engine, state,
  dispatcher, policy, approvals, retry, audit, eval.
- **Configuración por cliente (sí cambia):** definiciones de workflows,
  agentes y sus herramientas autorizadas, políticas y límites, integraciones
  de entrada, plantillas de borradores y textos.
- **Regla:** una adaptación de cliente nunca modifica el núcleo; si algo
  falta en el núcleo, se agrega como capacidad general con pruebas, no como
  parche del cliente.
- **Despliegue por cliente (D16, decidida en C8):** multi-tenant
  confirmado: un despliegue, un tenant por cliente, aislamiento por
  `org_id` en cada consulta. La instancia dedicada por cliente (un
  despliegue por cliente, más aislamiento, más operación) se descarta por
  ahora: multiplica costo y operación y el plan gratis no la sostiene; se
  revisa si un cliente exige aislamiento más allá del filtrado por
  `org_id` (RLS queda como endurecimiento futuro, no implementado).
- **Demo:** el tenant ficticio de la agencia de Martín es la vidriera de la
  plantilla: demuestra el flujo completo sin exponer datos de clientes.

## Límites y riesgos conocidos

- Sin claves de proveedor de IA: el MVP funciona con reglas + stub; la IA
  real es Fase 2 y requiere aprobación y claves.
- Persistencia dual verificada (D14, actualización 26-oct-2026, C1): el
  adaptador Postgres está implementado y verificado contra Neon; la demo
  pública corre en Render + Neon y SQLite local queda solo para desarrollo.
  Supabase fue sustituido por Neon por decisión de Tomás (25-oct-2026);
  G0-D3 queda pendiente solo del proveedor de IA (Fase 2).
- Ejecución síncrona con pasos persistidos y worker asíncrono (C7): el
  alta manual y el webhook siguen sincrónicos (su contrato devuelve la
  oportunidad creada); el worker (`app/src/worker.ts`, `npm run worker`,
  `--once` para una pasada) procesa jobs de ingesta encolados vía
  `POST /api/jobs` y reconcilia huérfanos de caídas en cada arranque.
  Migrar el alta a este camino exige UI con espera/consulta y queda como
  paso posterior, no se hizo en silencio. El despliegue del worker como
  servicio separado en Render queda pendiente de decisión (plan gratis).
