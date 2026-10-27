# R4 — Actividad y ejecuciones (vista real + inspector) + Datos contextuales en dos columnas — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local.

## Objetivo

El usuario pidió arrancar R4 con la imagen de referencia de
«Actividad y ejecuciones» (tabla Execution Log + inspector
derecho), siguiendo expresamente las reglas de diseño visual, y
aprovechar la tanda para un cambio chiquito pendiente: la sección
Datos contextuales del panel de Revisión de Aprobaciones en DOS
COLUMNAS. La referencia es de diseño, no especificación de
funciones: no se inventó API, integración, métrica ni operación.

## Acciones

### 1. ActivityView real en /actividad (reemplaza el aviso de migración)

Agentes sigue siendo aviso de migración; es la última sección
pendiente (R5).

- Tabla de ejecuciones (`GET /api/executions`, máx. 100, más
  recientes primero) con columnas reales: Ejecución (UUID
  recortado a 8 caracteres, completo en el inspector y en el
  título), Flujo (nombre real del registry), Agente principal,
  Oportunidad, Inicio, Duración, Estado (Completada/Fallida/
  Activa). Filtros en una sola fila (FilterBar `layout="single"`):
  búsqueda por ID u oportunidad, Estado, Agente y Fecha (Hoy /
  Últimos 7 días —default, como la referencia— / Últimos 30 días /
  Todas). Paginación en cliente (20 por página), filas clicables
  con teclado, como Oportunidades/Tareas/Aprobaciones.
- Agente principal (definición documentada): el agente dueño del
  PRIMER paso del flujo, resuelto con el registry de workflows
  (`GET /api/workflows`, pasos ordenados) + el catálogo de agentes
  (`GET /api/agents`, cada agente lista sus pasos). Hoy el único
  flujo es `opportunity.intake` y su primer paso es `normalize`,
  de Captación; la columna sigue siendo correcta si aparece otro
  flujo. El paso sintético `intake` (fallo previo al pipeline) no
  pertenece a ningún agente y muestra «—».
- Oportunidad vinculada: join en cliente con `GET /api/processes`
  (corrida → contacto/empresa) con respaldo en
  `result_json.opportunity` (la ejecución exitosa guarda la
  oportunidad completa, id incluido). Las ejecuciones fallidas no
  crean oportunidad y muestran «—».
- Duración (fórmula documentada): `updated_at − created_at`
  solo para ejecuciones terminadas; el servidor no guarda
  duración y para `running` no es fiable, así que muestra
  «En curso». Formato como la referencia: «2m 15s».
- Inspector (panel derecho `DetailPanel` variante `wide`, 480 px,
  igual que Revisión en Aprobaciones; carga perezosa de pasos y
  de auditoría, con caché por id):
  - Metadata real: flujo + versión, agente principal, inicio,
    fin, duración, oportunidad, ID completo, «Reintento de».
  - Datos de entrada: `input_json` real, con máscara de
    presentación (ver abajo).
  - Cronología de pasos reales (`GET /api/executions/:id/steps`,
    en orden temporal): nombre traducido (solo presentación),
    agente dueño del paso, hora, error del paso si lo hay y
    `output_json` enmascarado.
  - Decisiones vinculadas: aprobaciones/rechazos/ediciones de
    borradores de la oportunidad (`GET /api/audit?opportunityId`),
    o «Sin decisiones vinculadas».
  - Diagnóstico de error: SOLO en ejecuciones fallidas, con el
    `error` real de la ejecución y de sus pasos. Sin códigos
    inventados (no existen «E-504» ni «DB-SOLVENCIA» guardados).
  - Reintento: SOLO el reintento de ejecución completa que
    existe (`POST /api/executions/:id/retry`), solo admin (rol de
    `GET /api/me`; member ve el aviso), con diálogo de
    confirmación que aclara que se vuelve a correr el ingreso
    entero, y con intentos usados/restantes derivados de la cadena
    `retry_of` y de la política real `retry.max_attempts`
    (`GET /api/policies`, default del servidor 3).
  - Reintentos: cadena `retry_of` real (raíz + hijos directos,
    así los cuenta el servidor para el tope).
  - Referencias de auditoría: IDs reales de eventos que citan a
    la ejecución (p. ej. `execution.retried`), o aviso si no hay.
- Máscara de presentación: solo se enmascaran los valores de los
  campos personales de la entrada y de las salidas de pasos
  (`contactName` → iniciales + `***`, `contactEmail` → primera
  letra + `***@dominio`, `company` igual que el nombre,
  `message` → primeros 15 caracteres + «… (enmascarado)»). El
  servidor guarda el texto completo; la máscara vive solo en esta
  vista y no es un dato nuevo.

### 2. Datos contextuales en dos columnas (Aprobaciones)

La sección Datos contextuales del panel de Revisión pasó de
lista vertical a grid de 2 columnas (`grid-cols-2` dentro del
panel de 480 px). Mismos 7 campos, mismo contenido y mismo orden
(Cliente, Contacto, Correo, Categoría, Prioridad, Puntaje, Canal);
solo cambió la disposición, con `break-words` en todos los
valores para que los correos largos no rompan la columna.
Oportunidades y el resto de Aprobaciones no se tocaron.

### 3. Solo cliente, sin cambios de servidor

No hizo falta ningún endpoint ni campo nuevo: ejecuciones,
pasos, workflows, agentes, procesos, oportunidades, auditoría y
políticas ya existían. Se agregaron al cliente tipado
(`lib/api.ts`): `ExecutionFull`, `ExecutionStep`, `WorkflowDef`,
`PolicyEntry`, `getExecutionsFull`, `getExecutionSteps`,
`retryExecution`, `getWorkflows`, `getPolicies`, y se completó
`AuditEntry` con `id` y `entity_id` (el servidor ya los
devolvía). Comentario de `DetailPanel` actualizado: `wide`
ahora lo usan Aprobaciones y Actividad.

## Desviaciones respecto de la referencia (cada omisión con su motivo)

- **IDs `EXEC-2023-1027-003`:** no existen. Los IDs reales son
  UUID; se muestran recortados a 8 caracteres con el completo en
  el inspector (mismo criterio que el vanilla).
- **Filtro de Proceso:** omitido. Hoy existe un único flujo
  (`opportunity.intake`); un filtro de un solo valor no filtra
  nada. La vista lo dice en una línea bajo los filtros.
- **Filtro Tipo de evento:** omitido. No hay una taxonomía real
  de tipos de evento para ejecuciones; las acciones de auditoría
  no son un filtro de la tabla de ejecuciones.
- **Flujos de la referencia** (Aprobación de Crédito,
  Optimización de Logística, etc.): no existen. El único flujo
  real es `opportunity.intake`; la tabla muestra solo
  ejecuciones reales.
- **«Reintentar Paso Fallido», «Omitir y Continuar»,
  «Investigar»:** no existen como operaciones. El único
  reintento real es el de la ejecución completa (diálogo propio).
- **Inputs/outputs con máscara de la referencia:** el contenido
  es real (`input_json` y `output_json` por paso); la máscara es
  solo presentación, con la regla documentada arriba. No se
  inventó ningún JSON de ejemplo.
- **Decision logs con thresholds y scores (0.8/0.92):** no
  existen. Las decisiones reales son las del borrador de la
  oportunidad (aprobar/rechazar/editar) vía auditoría.
- **Códigos de error y «Linked Approval Reference» con formato
  `REQ-APP-…`:** no existen. El diagnóstico usa el mensaje de
  error real y la referencia de aprobación es la decisión
  vinculada real (o su ausencia).
- **Paginación «17» y contadores de la referencia:** no son
  datos; la paginación real es la del cliente sobre las
  ejecuciones devueltas (máx. 100).
- **Panel de la referencia con avatar de usuario y buscador
  superior global:** fuera de la vista; el buscador de la vista
  es el de la barra de filtros y el usuario sigue en la cabecera
  del layout.

## Cumplimiento de las reglas de diseño visual

- Tokens System OS v1.1 sin tocar (fondo `#F7F8FC`, superficies
  `#FFFFFF`, primario `#4F46E5`, hover `#4338CA`, texto
  `#172033`, secundario `#64748B`, bordes `#E2E8F0`, éxito
  `#15803D`, advertencia `#B45309`, error `#B91C1C`, info
  `#1D4ED8`; radios 8/12/16): la vista usa solo las clases
  existentes del sistema; no se agregó ningún token global.
- Patrón Oportunidades/Tareas/Aprobaciones: componentes
  compartidos (Table, DetailPanel wide, FilterBar single,
  Badge, Pagination, Dialog, Card, Alert), tabla 12 px, filtros
  en una sola fila, paginación en cliente, filas con teclado,
  foco visible heredado, contraste de texto ≥4.5:1 (sin tocar
  tokens globales; los subtextos de fila seleccionada ya usan
  tinta desde A1).
- Skills cargadas (por debajo de las decisiones del usuario):
  ui-taste (estados reales, sin datos inventados, foco visible)
  y vercel-react-best-practices en su subconjunto válido para
  Vite SPA + Fastify (imports directos, `Promise.all` en la
  carga, `useCallback`, sin componentes definidos dentro de
  componentes, estado derivado en render con `useMemo`).

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor, no
  hay tests nuevos de servidor que agregar; el cliente no tiene
  runner de tests en este repo). Build limpio (incluye
  `typecheck:client`); `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`); DB
  real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`).
- Marcadores en el JS construido: «Inspector de ejecución»,
  «Datos de entrada», «Cronología de pasos», «Decisiones
  vinculadas», «Diagnóstico de error», «Referencias de
  auditoría», «Reintentar ejecución». Ausentes a propósito:
  «Reintentar paso fallido», «Omitir y Continuar»,
  «Solicitar cambios».
- Smoke propio en copia de DB (puerto 3468, matado por PID
  exacto, nada en pie): health OK, login demo OK,
  `GET /api/executions` (3 ejecuciones del seed, todas
  `opportunity.intake` en `done`), `GET /api/executions/:id/steps`
  (6 pasos en orden: normalize, dedup, classify, upsert,
  next_action, draft), `GET /api/audit` (12 eventos),
  `GET /api/workflows` (primer paso `normalize`),
  `GET /api/policies` (`retry.max_attempts = 3`,
  `retry.admin_only = true`).
- Reintento probado de punta a punta SIN fabricar filas: con un
  agente en pausa (vía API, en la copia) el ingreso real devolvió
  409 `agent_paused` y dejó una ejecución fallida real; tras
  reanudar, el reintento 1/2/3 creó ejecuciones nuevas y el 4.º
  devolvió 409 `retry_limit`; la cadena quedó con 3 hijos y la
  auditoría con 3 eventos `execution.retried`. Reintentar una
  ejecución `done` devolvió 409 `conflict`, como corresponde.
- La verificación visual en vivo queda para después del merge
  (no hay render local en la VM): panel inspector, filtros,
  diálogo de reintento con Cancelar (sin reintentar nada en la
  demo), Datos contextuales en dos columnas en Aprobaciones.

## Archivos

- `app/client/src/features/actividad/ActivityView.tsx` (nuevo)
- `app/client/src/lib/api.ts` (tipos y funciones R4)
- `app/client/src/App.tsx` (ruta `/actividad` → `ActivityView`)
- `app/client/src/features/aprobaciones/ApprovalsView.tsx`
  (Datos contextuales en dos columnas)
- `app/client/src/components/ui/detail-panel.tsx` (comentario)
- `docs/R4-ACTIVIDAD-REPORTE.md` (este informe)

## Riesgos

- La vista carga 7 endpoints en paralelo; si uno secundario
  (p. ej. políticas) fallara, toda la vista mostraría error en
  vez de degradar. Aceptado por simplicidad y porque todos son
  endpoints internos ya probados; si aparece el caso, se puede
  pasar a `Promise.allSettled` para los de enriquecimiento.
- Con más de 100 ejecuciones, la tabla solo ve las 100 más
  recientes (tope del servidor, igual que el resto de las
  vistas). No hay paginación de servidor para ejecuciones.
- La máscara oculta el mensaje completo de entrada; un operador
  que necesite depurar el texto exacto debe leerlo en la
  oportunidad vinculada (sin máscara), no en el inspector.

## Próximo paso

Ofrecer merge de R4 (mismo procedimiento que R3b, solo
verificación de conservación de PNG) y verificación en vivo
post-merge: tabla, inspector, filtros, diálogo de reintento con
Cancelar y Datos contextuales en dos columnas — todo solo
lectura, sin reintentar ni decidir nada en la demo.
