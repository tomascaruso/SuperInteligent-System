# Diagnóstico — 9 referencias visuales nuevas para SIS

**Fecha:** 27-oct-2026 (madrugada, ART)
**Origen:** 9 mockups de alta fidelidad enviados por Tomás el 27-oct-2026
(imágenes originales en la biblioteca de medios; NO copiadas al repo).
**Estado:** DIAGNÓSTICO COMPLETO. Sin cambios de código, sin merges, sin
despliegues. La implementación requiere autorización de Tomás por fase
(ver § D y § E).
**Base verificada:** `main` remoto `42537e6a` (Fases 2–4 mergeadas: cliente
React en `app/client/`, vista Inicio real en `/v2/#/inicio`, resto de
secciones como placeholders honestos). Código leído para este diagnóstico:
`app/src/routes.ts` (contratos API), `app/src/db.ts` (esquema y catálogos),
`app/src/domain.ts` (reglas y borrador), `app/src/engine.ts` (pipeline y
`result_json`), `app/public/app.js` (vistas vanilla reales) y
`app/client/src/` (lo ya construido en React).

## Reglas que rigen este diagnóstico

- Las imágenes son **referencias de diseño, NO especificaciones
  funcionales** (regla restablecida por Tomás). Lo que muestran y no
  existe se documenta como brecha, no se inventa.
- **Todos los números de las imágenes son demostrativos** (42 tareas
  pendientes, $150k, 8 agentes, 25 resultados, etc.). NO son datos del
  sistema y NO se usan como valores en ninguna parte de este documento.
- **Stack confirmado (ya decidido y construido así, no se propone otro):**
  React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React +
  HashRouter + primitivas propias vendorizadas estilo shadcn bajo
  `app/client/src/components/ui/` (hoy: button, input, label, card, badge,
  alert). Sin Radix, sin Recharts, sin React Hook Form instalados.
- Cada endpoint citado fue leído en `routes.ts`. Si algo no existe, dice
  **SIN FUENTE REAL**.

## Resumen ejecutivo

| # | Pantalla de referencia | Veredicto general |
|---|---|---|
| 1 | Procesos | Adaptable en gran parte como vista de `process_runs` + detalle; sin "Nuevo proceso", sin pausar/editar/cancelar, sin logs de nivel INFO/DEBUG |
| 2 | Tareas y seguimientos | La más adaptable: tabla real casi completa; sin prioridad por tarea, sin reasignar, sin comentarios, sin recomendación IA, sin adjuntos |
| 3 | Agentes | Adaptable como supervisión de los 5 agentes reales; sin estados Activo/Disponible/En pausa ni incidencias (no existen como dato) |
| 4 | Clientes | **SIN FUENTE REAL como entidad**: agregación derivable desde oportunidades; sin alta, sin exportar, sin toggles de configuración |
| 5 | Oportunidades | Tabla real + panel de detalle real en gran parte; sin valor estimado, probabilidad, fecha de cierre ni desglose IA |
| 6 | Aprobaciones | La más cercana al sistema real: lista y revisión de borradores existen; sin "Solicitar cambios" como acción propia, sin riesgos calculados |
| 7 | Actividad y ejecuciones | Tabla e inspector reales en gran parte; sin "agente principal" directo, sin duración guardada, sin decision logs ni reintento por paso |
| 8 | Integraciones | **SIN FUENTE REAL**: no existe ninguna integración listable; solo webhook HMAC, alta manual y relay de contacto (ninguno es una "integración" mostrable así) |
| 9 | Orquestador | Adaptable como **vista de detalle** (flujo de una ejecución real), NO como sección propia: no existe entidad orquestador |

El patrón común de las 9 referencias es el mismo: **tabla + panel lateral
de detalle + filtros**. Ese patrón es el aporte de diseño reutilizable
más valioso (ver § C). El patrón de datos común es inverso: las
referencias presuponen entidades y operaciones (clientes, integraciones,
procesos creables y pausables, tareas reasignables, comentarios) que el
backend no tiene.

---

## 1. Procesos

**Composición que aporta:** título + subtítulo, botón primario
"Nuevo proceso", barra de búsqueda ("por nombre, cliente o ID"), filtros
Estado / Tipo de proceso / Fecha, tabla (Nombre del proceso, Cliente,
Categoría, Estado, Etapa actual, Agentes involucrados, Fecha de inicio,
Duración), pie "Mostrando 1 a 5 de 25 resultados" (paginación), y panel
lateral de detalle con: objetivo, diagrama de flujo por etapas con el
agente debajo de cada etapa, cronología de eventos, "Resultados y Logs
de Ejecución" con líneas `[INFO]/[DEBUG]/[WARN]`, y botones
"Pausar Proceso / Editar Flujo / Cancelar Proceso".

**Primitivas reutilizables:** card, badge (estados), input (buscador),
button. **A crear:** Table, Select (filtros), DetailPanel lateral,
FlowDiagram (etapas + agentes), Pagination, EmptyState, Skeleton.

**Mapeo a datos REALES:**

- Tabla: `GET /api/processes` (hasta 100, `created_at` DESC). Campos
  reales: `id`, `workflow`, `workflow_version`, `status`
  (`running`/`done`/`failed` → etiquetas del vanilla: En curso /
  Completada / Fallida), `created_at`, `updated_at`,
  `execution: { id, status }`.
- "Nombre del proceso": NO hay nombre por corrida. Lo real es el nombre
  del workflow: hoy existe **un solo workflow**,
  `opportunity.intake` v1, "Captación de oportunidad". Una tabla real
  mostraría ese nombre repetido; el identificador distintivo es el `id`
  (o sus primeros 8 caracteres, como hace el vanilla).
- "Cliente": NO es campo de `process_runs`. Derivable: la ejecución
  vinculada guarda `result_json` con la oportunidad completa
  (`opportunity.company`, `opportunity.contact_name`) y, si falló antes
  de terminar, `input_json.company`. Es una derivación con costo (una
  lectura por fila o un join en cliente), no un campo.
- "Categoría": NO es campo del proceso. Derivable igual que el cliente
  vía `result_json.opportunity.category`.
- "Etapa actual": derivable de `GET /api/executions/:id/steps`: el
  último paso con `status: done` (o el paso en curso). Los 6 pasos
  reales son normalize, dedup, classify, upsert, next_action, draft.
- "Agentes involucrados": derivable vía `GET /api/tools` (mapa
  paso → `agent_id`/`agent_name`) aplicado a los pasos de la ejecución.
- "Duración": NO guardada. Derivable como `updated_at − created_at`
  para corridas terminadas; para `running` no es fiable (el `updated_at`
  solo se mueve al terminar).
- Detalle: `GET /api/processes/:id` (proceso + ejecución completa:
  `input_json`, `result_json`, `error`, `retry_of`) +
  `GET /api/executions/:id/steps`.
- Cronología de eventos: pasos (`created_at` por paso) + auditoría
  relacionada. La auditoría NO tiene `execution_id`; solo los eventos
  `execution.retried` citan ejecuciones en `detail_json`. La cronología
  real es, por tanto, la lista de pasos, no un event log rico.
- Filtros Estado/Tipo/Fecha y búsqueda: **solo en cliente** (no hay
  query params en `/api/processes`). "Tipo de proceso" hoy tiene un
  único valor posible. La paginación del servidor es un tope fijo
  (100), no hay parámetros de página.

**Brechas honestas y tratamiento:**

- "Nuevo proceso": **SIN FUENTE REAL**. No hay endpoint de creación;
  las corridas nacen solo del intake (alta manual, webhook o job).
  Tratamiento: **omitir el botón**. Habilitarlo exigiría decisión de
  producto + endpoint nuevo (qué workflow, con qué entrada).
- "Pausar / Editar Flujo / Cancelar Proceso": **SIN FUENTE REAL**.
  El pipeline es sincrónico (o un job del worker); no hay estados
  pausado ni cancelado ni edición de flujo en caliente. Tratamiento:
  **omitir los tres botones**. El flujo se edita hoy por código
  (constantes documentadas, ver guía F4-TEMPLATE).
- "Objetivo del Proceso": **SIN FUENTE REAL** como campo (el workflow
  tiene `name` y `steps`, no descripción/objetivo). Tratamiento: usar
  el nombre del workflow + la lista de pasos; un texto de objetivo
  exigiría un campo nuevo en la tabla `workflows` (o texto estático
  documentado por workflow, decisión de producto).
- Logs `[INFO]/[DEBUG]/[WARN]`: **SIN FUENTE REAL**. Los pasos guardan
  `status`, `output_json` y `error`, no un stream de logs. Tratamiento:
  mostrar los pasos reales con su salida/error (como el "Ver pasos"
  del vanilla), sin inventar líneas de log.
- "Requiere atención" como estado: no existe. Lo más cercano real es
  `failed` (Fallida) o un borrador vencido/desactualizado asociado.
  Tratamiento: no usar esa etiqueta; mapear solo los 3 estados reales.

## 2. Tareas y seguimientos

**Composición que aporta:** 4 tarjetas de resumen (Pendientes,
Vencidas, En curso, Completadas, con variación % vs. período anterior),
buscador, filtros Estado / Prioridad / Responsable / Fecha / "Más
filtros" / "Limpiar", botón "Crear tarea", tabla (Título, Proceso
relacionado, Cliente, Responsable, Prioridad, Fecha límite, Status) y
panel lateral de detalle con: objetivo, contexto del proceso padre
(breadcrumb), historial de cambios, entregable esperado, evidencia/logs
disponibles (archivos descargables) y "Recomendación del siguiente
paso", con botones "Completar tarea / Reasignar / Añadir comentario /
Cancelar tarea".

**Primitivas reutilizables:** card, badge, input, button.
**A crear:** StatCard (composición sobre card), Table, Select,
DetailPanel lateral, FilterBar, Pagination.

**Mapeo a datos REALES:**

- Tabla: `GET /api/tasks` (opcional `?status=open|done`). Campos
  reales: `title` (es el texto del próximo paso: "Llamar en menos de
  24 h", "Enviar propuesta en 48 h" o "Enviar mensaje de
  calificación"), `agent_id` + `agent_name`, `assigned_to` (hoy siempre
  "Seguimiento"), `contact_name`, `company`, `status` (`open`/`done`),
  `due_at`, `created_at`, `updated_at`, `opportunity_id`.
- Tarjetas de resumen: derivables en cliente desde `/api/tasks` y
  `/api/stats` (`openTasks`): pendientes = `status: open`; vencidas =
  `open` con `due_at` anterior a hoy (fecha local, misma regla que
  Inicio); completadas = `status: done`. "En curso" NO existe como
  estado de tarea (solo `open`/`done`): la tarjeta "En curso" debe
  omitirse o redefinirse (por ejemplo, abiertas no vencidas), nunca
  mostrarse con un conteo inventado.
- Variación % de las tarjetas: **SIN FUENTE REAL** (no hay serie
  temporal guardada; mismo veredicto que el diagnóstico anterior).
  Tratamiento: tarjetas sin variación.
- "Proceso relacionado": derivable vía la oportunidad (`opportunity_id`
  → workflow `opportunity.intake`); no hay nombre de proceso por
  tarea. El breadcrumb "Procesos > Comercial > Onboarding > …" de la
  referencia NO existe: el único proceso es la captación.
- "Responsable": el único valor real es el agente Seguimiento
  (`assigned_to`/`agent_name`); NO hay usuarios responsables
  asignables. Las personas de la imagen (Juan Pérez, María López) son
  demostrativas.
- "Prioridad" por tarea: **SIN FUENTE REAL**. La tarea no tiene
  columna de prioridad; la prioridad vive en la oportunidad
  (`GET /api/opportunities/:id` → `priority`, `score`). Derivable con
  un join en cliente (tarea → oportunidad), no directo.
- Detalle: la tarea + su oportunidad (contacto, empresa, mensaje,
  categoría, prioridad) + su auditoría (`GET /api/audit?opportunityId=`
  filtra eventos que la citan). El "objetivo" real es el título de la
  tarea; no hay campo de descripción.
- "Completar tarea": REAL — `PATCH /api/tasks/:id` con
  `{ status: "done" }` (y reabrir con `"open"`). Es la única acción de
  escritura real sobre tareas.

**Brechas honestas y tratamiento:**

- "Crear tarea": **SIN FUENTE REAL**. Las tareas solo las crea el
  intake. Tratamiento: **omitir el botón**. Habilitarlo exigiría
  endpoint nuevo + decisión de producto (¿tarea libre o ligada a
  oportunidad?).
- "Reasignar": **SIN FUENTE REAL** (no hay endpoint; `assigned_to`
  no se edita). Tratamiento: **omitir**. 
- "Añadir comentario": **SIN FUENTE REAL** (no hay comentarios en
  ninguna tabla). Tratamiento: **omitir**. La vía real de registro es
  la auditoría (automática, no comentable).
- "Cancelar tarea": **SIN FUENTE REAL** (no hay estado cancelado;
  lo más cercano es completarla). Tratamiento: **omitir**; no
  disfrazar "done" de cancelación.
- "Historial de cambios": parcial. La auditoría registra
  `task.updated` (cambio de estado, actor, fecha) pero NO asignaciones
  ni cambios de responsable (no existen). Tratamiento: mostrar solo
  los eventos reales de auditoría.
- "Entregable esperado" y "Evidencia/logs (PDF, .log descargables)":
  **SIN FUENTE REAL**. No se generan archivos. Tratamiento:
  **omitir**; el entregable real es el borrador de la oportunidad
  (ver § 5 y § 6).
- "Recomendación del siguiente paso": **SIN FUENTE REAL** como
  recomendación (sería IA; veredicto F2-AI: DISCARD). Lo real es el
  próximo paso determinista: el título de la tarea abierta de la
  oportunidad. Tratamiento: mostrar ese título como "Próximo paso",
  sin presentarlo como recomendación generada.

## 3. Agentes

**Composición que aporta:** 3 tarjetas de resumen (Agentes
disponibles, Activos, Con incidencias, con mini-gráficos), filtros por
Función (Todas / Comercial / Análisis / Calidad / Soporte /
Orquestación) y por Estado (Todos / Disponible / Activo / Con
incidencias / En pausa), lista de agentes con icono, nombre, función,
badge de estado, "procesos asignados" y "hace X", y panel de detalle
con: objetivo, capacidades y herramientas autorizadas, logs de
ejecución, procesos activos con %, permisos y límites, y salidas
recientes (archivos).

**Primitivas reutilizables:** card, badge, button.
**A crear:** StatCard, FilterBar (chips + select), AgentCard,
DetailPanel lateral.

**Mapeo a datos REALES:**

- Catálogo: `GET /api/agents` — exactamente **5 agentes** (no 8):
  Captación (`intake`, pasos normalize/dedup/upsert), Calificación
  (`qualification`, classify), Respuesta y propuesta
  (`response_proposal`, draft), Seguimiento (`follow_up`,
  next_action), QA y políticas (`qa_policy`, sin pasos propios).
  Cada uno trae `description` real (texto de negocio del catálogo).
- "Procesos asignados" por agente: derivable en cliente — tareas
  abiertas por `agent_id` (`GET /api/tasks`) y pasos por agente
  (`GET /api/tools` da paso → agente). Hoy, en la práctica, casi
  todas las tareas son de Seguimiento; QA tiene 0 pasos y 0 tareas.
- "Capacidades y herramientas autorizadas": REAL como lista de pasos
  (`steps` del agente) + `GET /api/tools`. No hay permisos por agente
  más allá de eso.
- "Logs de ejecución" por agente: derivable — pasos de ejecuciones
  cuyo `step` pertenece al agente (vía `/api/tools`), con
  `output_json`/`error`/`created_at`. No hay un log dedicado por
  agente.
- "Procesos activos" por agente: derivable igual (ejecuciones con
  pasos de ese agente). Los % de avance de la imagen NO existen
  (un paso no tiene %; tiene estado done/failed).
- Filtros por función: redefinibles con los 5 nombres reales
  (Captación, Calificación, Respuesta y propuesta, Seguimiento, QA y
  políticas). "Orquestación" como función NO es un agente: es el
  pipeline completo (ver § 9).

**Brechas honestas y tratamiento:**

- Estados Activo / Disponible / Con incidencias / En pausa:
  **SIN FUENTE REAL**. Los agentes son reglas deterministas, no
  procesos en ejecución; no hay heartbeat, ni estado, ni incidencias
  registradas. Tratamiento: **no mostrar badges de estado**; mostrar
  "Determinista: actúa cuando el pipeline ejecuta su paso" o
  equivalente honesto, y conteos reales (pasos que posee, tareas
  abiertas asignadas). Definir "activo" exigiría una definición de
  producto + un dato nuevo (por ejemplo, última ejecución con pasos
  suyos) — y aun así no sería un estado del agente.
- "Agentes disponibles: 8" y "Orquestador Central Master": la imagen
  muestra 8 agentes y un orquestador con corona Master. Lo real son
  5, sin jerarquía master/subordinado. Tratamiento: lista de 5, sin
  corona Master, sin inventar 3 agentes más.
- "Hace 2 min / Hace 10 min" (última actividad por agente):
  **SIN FUENTE REAL** directa (la auditoría no lleva `agent_id`).
  Derivable parcial: última tarea actualizada de ese agente, o
  último paso suyo en ejecuciones recientes. Tratamiento: omitir el
  "hace X" o derivarlo solo de tareas, etiquetado como tal.
- "Permisos y límites" (máx. tareas simultáneas, acceso
  lectura/escritura, decisión autónoma): **SIN FUENTE REAL** por
  agente. Lo real y global: `GET /api/policies` (reintento solo
  admin, tope 3, borradores 7 días, solo admin aprueba). Tratamiento:
  mostrar las políticas globales como tales, no como permisos del
  agente.
- "Salidas recientes" (PDF/XLSX/log descargables): **SIN FUENTE
  REAL**. No se generan archivos. Tratamiento: **omitir**; las
  salidas reales son el borrador y la tarea creados por el pipeline.

## 4. Clientes

**Composición que aporta:** tabla de organizaciones (Organización,
Contactos clave, Estado, Procesos activos, Última actividad, Fecha de
incorporación), botones "Exportar / Agregar cliente", paginación, y
panel lateral de detalle con: perfil (industria, tamaño, sede,
descripción), estado de la relación (barra + "Premium Partner" +
antigüedad + "Cuenta manager"), flujos de trabajo activos con %,
oportunidades vinculadas con montos, tareas abiertas con checks,
registro de actividad reciente, y configuración personalizada con
toggles (notificaciones, beta features, reportes automáticos).

**Primitivas reutilizables:** card, badge, button.
**A crear:** Table, DetailPanel lateral, Pagination, Toggle
(solo si se habilita algo real que conmutar; hoy nada).

**Mapeo a datos REALES:**

- NO existe endpoint de clientes ni tabla de clientes. La única
  "empresa" del sistema es `opportunities.company` (campo de texto
  libre) y la propia organización del tenant (`GET /api/me` →
  `org.name`). Esto es una diferencia de modelo, no de presentación:
  en SIS, el cliente de PENSIA es la organización que usa el sistema;
  las "empresas" de la referencia serían, como mucho, las empresas
  de las oportunidades captadas.
- Agregación derivable (solo si Tomás la pide): agrupar
  `GET /api/opportunities` por `company` — contactos
  (`contact_name` por empresa), fecha de primera oportunidad
  (aproximación honesta a "incorporación"), cantidad de
  oportunidades, tareas abiertas por empresa (join con
  `/api/tasks` por `opportunity_id`), última actividad (último
  evento de auditoría que cite una oportunidad de esa empresa).
  Todo es derivación en cliente, sin endpoint propio.

**Brechas honestas y tratamiento:**

- "Agregar cliente" y "Exportar": **SIN FUENTE REAL** (no hay alta
  ni exportación). Tratamiento: **omitir ambos botones**. El alta
  real de una empresa ocurre captando una oportunidad
  (`POST /api/opportunities`).
- "Estado: Activo / En Riesgo", "Premium Partner", antigüedad,
  "Cuenta manager": **SIN FUENTE REAL** (no hay estado de relación,
  ni planes, ni managers). Tratamiento: **no mostrarlos**. Un estado
  de salud del cliente exigiría campos nuevos + criterio de
  producto.
- "Flujos de trabajo activos con %": derivable solo en parte
  (procesos cuyas ejecuciones citan a esa empresa vía
  `result_json`/`input_json`); el % de avance NO existe.
  Tratamiento: conteo de procesos, sin %.
- "Oportunidades vinculadas con montos ($150.000, $50.000)":
  **SIN FUENTE REAL** para los montos. Las oportunidades no tienen
  valor estimado. Tratamiento: listar oportunidades reales sin
  montos.
- "Configuración personalizada con toggles": **SIN FUENTE REAL**
  (no hay settings por empresa; las políticas son globales y de
  solo lectura por API). Tratamiento: **omitir la sección**.
- **Conclusión de la pantalla:** es la de menor cobertura real de
  las 9. Implementarla como sección implicaría inventar una entidad
  o mostrar una agregación derivada con muchas celdas vacías. Se
  recomienda NO implementarla como sección (ver § B y § E); si
  Tomás quiere una vista de "Empresas", que sea la agregación
  derivada explícitamente etiquetada, sin estado, sin montos y sin
  configuración.

## 5. Oportunidades

**Composición que aporta:** título + subtítulo, botón "Nueva
oportunidad", buscador, filtros Estado / Prioridad / Fuente / "Más
filtros", tabla (Nombre, Estado, Prioridad, Fuente, Agente IA
Asignado, Atención Humana, Próximo Paso) y panel lateral de detalle
con pestañas (Overview / AI Breakdown / Classification / Interaction
Log / Related Tasks) y: valor estimado, probabilidad, fecha de
cierre, "AI Drafts" (borrador + próximo paso recomendado), desglose
generado por IA (factores clave, riesgos), razón de clasificación,
registro de interacciones y audit trail.

**Primitivas reutilizables:** card, badge, input, button.
**A crear:** Table, Select, DetailPanel lateral con Tabs,
FilterBar.

**Mapeo a datos REALES:**

- Tabla: `GET /api/opportunities` (100, `created_at` DESC). Campos
  reales: `contact_name`, `contact_email`, `company`, `message`,
  `source` (manual/webhook/otro), `status` (`new`/`proposal_draft`/
  `in_follow_up`), `category` (marketing/desarrollo/automatización/
  consultoría/diseño/general), `priority` (high/medium/low), `score`,
  `created_at`, `updated_at`. "Nombre de Oportunidad" no existe como
  campo: lo real es contacto + empresa (como muestra el vanilla).
- "Nueva oportunidad": REAL — `POST /api/opportunities` (alta manual
  con contacto, correo, empresa, mensaje; 201 si crea, 200 si es
  duplicado, 429 si se alcanzó el límite diario). Es el mismo flujo
  del vanilla.
- "Fuente": REAL (`source`). "Estado" y "Prioridad": REALES (con
  etiquetas de negocio del vanilla).
- "Próximo Paso": REAL y derivable — el título de la tarea abierta
  de esa oportunidad (`GET /api/tasks`, filtro en cliente por
  `opportunity_id`).
- "Atención Humana": derivable con honestidad — existe un borrador
  `pending_approval` para esa oportunidad (`GET /api/drafts`,
  filtro en cliente) significa que falta decisión humana. No es un
  campo, es una derivación etiquetable.
- Detalle Overview: contacto, empresa, mensaje, fuente, estado,
  categoría, prioridad, `score`, fechas — todo REAL.
- "AI Drafts": el borrador existe (`GET /api/drafts`), pero NO es
  IA: es plantilla determinista (`draftBody` en `domain.ts`) y el
  veredicto F2-AI fue DISCARD. Tratamiento: llamarlo "Borrador",
  nunca "Borrador IA", y mostrar su `body` real + `expired`/`stale`.
- "Classification": categoría/prioridad/`score` son REALES; la
  "razón" textual NO está guardada (el `score` no guarda su
  desglose). Tratamiento: mostrar categoría, prioridad y puntaje;
  el desglose (urgencia +2, presupuesto +1, empresa +1, dominio no
  gratuito +1, categoría +1) solo puede mostrarse como explicación
  de la regla documentada, no como dato guardado por oportunidad.
- "Interaction Log" y "Audit Trail": REAL en parte —
  `GET /api/audit?opportunityId=` da los eventos del sistema sobre
  esa oportunidad (creación, tarea, borrador aprobado/rechazado,
  reintento). NO hay correos, llamadas ni notas humanas registradas.
  Tratamiento: mostrar solo eventos de auditoría reales.
- "Related Tasks": REAL — tareas de la oportunidad (mismo join
  anterior).

**Brechas honestas y tratamiento:**

- "Agente IA Asignado" (Agente X-1, Y-2, Z-3): **SIN FUENTE REAL**.
  Las oportunidades no tienen agente asignado; el único agente
  vinculado es Seguimiento vía la tarea. Tratamiento: **omitir la
  columna** o mostrar "Seguimiento" solo cuando hay tarea abierta
  (derivado, etiquetado).
- "Valor estimado ($150k), Probabilidad (70%), Fecha de cierre":
  **SIN FUENTE REAL**. Tratamiento: **omitir los tres**. Añadirlos
  exigiría campos nuevos + decisión de producto (¿quién los carga?).
- "AI-generated deal breakdown" (factores clave, riesgos):
  **SIN FUENTE REAL** (sería análisis IA; descartado en F2-AI).
  Tratamiento: **omitir**; la explicación honesta es la regla
  determinista documentada.
- "En Progreso / Propuesta Enviada" como estados: los estados
  reales son `new` / `proposal_draft` / `in_follow_up`. Tratamiento:
  usar las etiquetas reales del vanilla, no las de la imagen.

## 6. Aprobaciones

**Composición que aporta:** título + contador "3 pendientes",
subtítulo, filtros por Tipo de acción (chips: Email draft / Data
update / API call), Antigüedad (Today / This week / Older) y
Prioridad (High / Medium / Low), buscador, lista de acciones
propuestas (título, agente IA, proceso, cliente, timestamp, razón del
activador) y panel de revisión con: objetivo, "Contenido exacto del
borrador", datos contextuales/evidencia, riesgos y advertencias, y
botones "Rechazar / Solicitar cambios / Aprobar".

**Primitivas reutilizables:** card, badge, input, button.
**A crear:** FilterBar (chips + select), DetailPanel lateral
(esta pantalla es, en el fondo, el diálogo de revisión del vanilla
llevado a panel lateral), Pagination.

**Mapeo a datos REALES:**

- Lista: `GET /api/drafts` — pendientes (`pending_approval`) y
  decididas (`approved`/`rejected`), con `contact_name`, `company`,
  `opportunity_message`, `opportunity_source`, `created_at`,
  `decided_by`, `decided_at`, `note`, `expired`, `stale`. El contador
  de pendientes es REAL (`GET /api/stats` → `pendingDrafts`).
- Panel de revisión: `body` del borrador (texto exacto, REAL),
  contacto/empresa/mensaje de la oportunidad (REAL), estado
  vencido/desactualizado (REAL, con sus mensajes del servidor).
- "Aprobar": REAL — `POST /api/drafts/:id/approve` (solo admin;
  409 `draft_expired` / `draft_stale` / `conflict`). Al aprobar, la
  oportunidad pasa a `in_follow_up`. **Aprobar NO envía ningún
  mensaje externo** (regla vigente del sistema, no un faltante de
  la UI).
- "Rechazar": REAL — `POST /api/drafts/:id/reject` (solo admin,
  nota opcional ≤1000 caracteres; la oportunidad vuelve a `new`).
- Filtros: en cliente (no hay query params en `/api/drafts`).
  Antigüedad derivable de `created_at`; prioridad derivable de la
  oportunidad (join en cliente).

**Brechas honestas y tratamiento:**

- "Tipo de acción" (Email draft / Data update / API call):
  **SIN FUENTE REAL** como tipos. El único tipo de acción
  aprobable es el borrador de respuesta. Tratamiento: **omitir el
  filtro por tipo** (o dejarlo con un único valor real: "Borrador
  de respuesta").
- "Agente IA" (LegalBot, SalesData, FinanceOps): **SIN FUENTE
  REAL** por borrador. El paso `draft` pertenece al agente
  "Respuesta y propuesta" (`GET /api/tools`). Tratamiento: mostrar
  ese agente como origen del paso, sin nombre de producto IA.
- "Proceso" (Onboarding Cliente, Calificación de Lead):
  **SIN FUENTE REAL** por borrador (el borrador no lleva
  `execution_id` ni `process_id`). Derivable con costo vía la
  oportunidad y su ejecución de intake. Tratamiento: omitir o
  derivar solo si se documenta el costo.
- "Razón del activador" (regla #45, puntuación > 90, factura
  vencida): **SIN FUENTE REAL** como campo. Lo real: categoría,
  prioridad y `score` de la oportunidad. Tratamiento: mostrar
  esos tres datos, no una regla inventada.
- "Solicitar cambios": **SIN FUENTE REAL** como acción. El flujo
  real es rechazar con nota (la nota queda guardada y un intake
  nuevo genera un borrador fresco). Tratamiento: el botón puede
  existir solo como "Rechazar con nota" honesto; NO como estado
  intermedio nuevo (exigiría endpoint + estado nuevo).
- "Riesgos y Advertencias" (correo no verificado, términos
  estándar): **SIN FUENTE REAL** como motor de riesgos. Lo real
  que ocupa ese lugar: las advertencias de vencido/desactualizado
  del servidor. Tratamiento: mostrar esas advertencias reales; no
  inventar riesgos.
- "Plan Enterprise / Fecha de inicio / Notas / v1.0.4":
  **SIN FUENTE REAL**. La versión real cercana es
  `workflow_version` ("v1") de la ejecución de intake, no del
  borrador. Tratamiento: omitir; si se muestra versión, que sea
  la del workflow, etiquetada.

## 7. Actividad y ejecuciones

**Composición que aporta:** título + subtítulo, buscador, filtros
Process / Agent / Status / Date / Event Type + "Filtrar / Limpiar",
tabla "Execution Log Table" (Execution ID, Workflow, Primary Agent,
Timestamp, Duration, Status), paginación, e inspector lateral con:
metadata de ejecución, cronología de pasos, inputs/outputs con
máscara de protección, decision logs, referencia de aprobación
vinculada, diagnóstico de error con "Reintentar Paso Fallido /
Reintentar Flujo Completo / Omitir y Continuar / Investigar",
timeline de reintentos y "Audit Log Reference IDs".

**Primitivas reutilizables:** card, badge, input, button.
**A crear:** Table, Select, DetailPanel lateral (inspector),
Pagination, FilterBar.

**Mapeo a datos REALES:**

- Tabla: `GET /api/executions` (100, `created_at` DESC). Campos
  reales: `id`, `workflow`, `workflow_version`, `status`
  (`running`/`done`/`failed`), `created_at`, `updated_at`,
  `retry_of`, `error`, `input_json`, `result_json`.
  Los IDs reales son UUID (no `EXEC-2023-1027-003`); se muestran
  completos o recortados a 8 caracteres con título completo, como
  el vanilla.
- "Primary Agent": NO es columna directa. Derivable: el agente del
  primer paso (o el de más pasos) vía `GET /api/tools` +
  `GET /api/executions/:id/steps`. Tratamiento: derivarlo solo
  con esa definición documentada, o omitir la columna y mostrar
  el workflow (que es lo que identifica el trabajo).
- "Duration": NO guardada; derivable `updated_at − created_at`
  para terminadas (el vanilla muestra "Fin" solo cuando difiere
  del inicio). Para `running`, no fiable.
- Inspector: `GET /api/executions/:id/steps` (pasos reales con
  `step`, `status`, `output_json`, `error`, `created_at`) +
  ejecución completa. La metadata real: workflow, versión, inicio,
  fin, estado, error, `retry_of`, resultado (oportunidad creada:
  contacto/empresa desde `result_json.opportunity`).
- "Inputs/Outputs con máscara": REAL como contenido
  (`input_json` con los datos de la oportunidad,
  `output_json` por paso); la máscara es solo presentación
  (ocultar correo/nombre parciales) y puede hacerse en cliente.
  Ojo: `input_json` contiene datos personales reales — la máscara
  es una decisión de presentación, no un dato nuevo.
- "Diagnóstico de error": REAL en parte — `error` de la ejecución
  y `error` por paso. No hay códigos tipo "E-504" ni
  "DB-SOLVENCIA" guardados; el texto de error es el del motor.
- "Reintentar Flujo Completo": REAL —
  `POST /api/executions/:id/retry` (solo fallidas; solo admin
  salvo que la política diga lo contrario; tope 3 por cadena;
  409 `retry_limit`). Es reintento del intake completo, no por
  paso. El vanilla ya lo expone con diálogo de confirmación.
- "Retry sub-events timeline": derivable — cadena `retry_of` +
  eventos `execution.retried` de la auditoría.
- Filtros: en cliente sobre el tope de 100 (ejecuciones) y 200
  (auditoría). No hay query params de filtro en estos endpoints
  (salvo `opportunityId` en auditoría).

**Brechas honestas y tratamiento:**

- "Reintentar Paso Fallido", "Omitir y Continuar (Manual)",
  "Investigar": **SIN FUENTE REAL** (no hay reintento parcial,
  ni omisión de pasos, ni flujo de investigación). Tratamiento:
  **omitir los tres**; el único reintento real es el completo.
- "Decision Logs" (umbrales, scores de decisión):
  **SIN FUENTE REAL**. No hay tabla de decisiones; la
  clasificación guarda solo `category`/`priority`/`score` en la
  oportunidad. Tratamiento: mostrar los pasos con sus salidas
  (que incluyen categoría/prioridad en el paso `classify`),
  sin inventar un log de decisiones.
- "Linked Approval Reference" (aprobación pendiente asignada):
  derivable en parte — el borrador de la oportunidad de esa
  ejecución (`GET /api/drafts`, filtro en cliente). No es una
  referencia guardada. Tratamiento: mostrar el borrador
  vinculado solo si existe, etiquetado como derivado.
- "Audit Log Reference IDs / Security IDs": **SIN FUENTE REAL**
  con ese formato. Las filas de auditoría tienen `id` UUID.
  Tratamiento: mostrar el `id` real o nada; no inventar IDs
  con formato.
- "Event Type" como filtro y "Process" con muchos valores: hoy
  hay un solo workflow y los tipos de evento son las acciones
  de auditoría reales (`task.updated`, `draft.approved`,
  `execution.retried`, etc.). Tratamiento: filtros con valores
  reales, no con la lista de la imagen.

## 8. Integraciones

**Composición que aporta:** título + subtítulo, pestañas por
categoría (Comunicación / CRM y ventas / Gestión de datos /
Automatización / API & Webhooks), tarjetas por herramienta (logo,
nombre, estado Conectado / Sin conectar / Disponible
próximamente, "Última sinc." y botón Configurar / Conectar /
Notificar) y panel lateral de detalle con: salud de conexión
(%, "Saludable"), capacidades (lista con checks), logs de
eventos recientes, tokens y credenciales enmascarados
(Client ID / Client Secret con Mostrar / Copiar) y permisos de
seguridad (lista con checks).

**Primitivas reutilizables:** card, badge, button.
**A crear:** Tabs, DetailPanel lateral (si alguna vez hay algo
real que detallar). Nada de esto debería crearse para mostrar
integraciones ficticias.

**Mapeo a datos REALES:**

- **Ninguna** de las herramientas de la imagen (Slack, Teams,
  Gmail, Zoom, Salesforce, HubSpot, Pipedrive) existe en el
  sistema. No hay tabla, endpoint ni credencial de
  integraciones. **SIN FUENTE REAL** para toda la pantalla.
- Lo único real y cercano, que NO debe presentarse como
  "integraciones":
  - Alta manual: `POST /api/opportunities` (entrada por
    formulario, no una integración).
  - Webhook HMAC: `POST /api/ingest/:orgId` con secreto por
    organización (visible solo para admin en `GET /api/me` →
    `org.webhook_secret`). Es un canal de entrada, no una
    herramienta conectable; su secreto NO debe mostrarse
    enmascarado como "token de integración" (eso lo
    tergiversaría y expondría un secreto operativo en una
    pantalla de catálogo).
  - Relay de contacto: `GET /api/contact/status` →
    `{ enabled: true|false }` (configuración del servidor,
    no por org, no listable como herramienta).
- "Última sinc.", "% de salud", "capacidades", "logs de
  eventos", "tokens": **SIN FUENTE REAL** en todos los casos.

**Brechas honestas y tratamiento:**

- Tratamiento: **no implementar la pantalla**. Mostrar tarjetas
  de Slack/Salesforce/etc. con "Conectado" o "Sin conectar"
  sería inventar un estado de conexión que no existe, y
  violaría la regla de no capacidades ficticias y el System OS.
- Habilitarla exigiría, como mínimo, decisión de producto
  (¿qué integraciones reales ofrece PENSIA a sus clientes?)
  + backend nuevo completo: registro de integraciones por
  organización, almacenamiento seguro de credenciales (nunca
  en texto plano ni en el repo), health checks, logs de
  sincronización y permisos. Es trabajo de núcleo/producto,
  no de presentación.
- Si Tomás quiere conservar el diseño, lo único honesto
  reutilizable es la composición (tarjetas por categoría) para
  un futuro real, documentada como tal, sin publicarla con
  datos.

## 9. Orquestador

**Composición que aporta:** cabecera de proceso (título,
badge "En ejecución", ID `#PROC-9402`, inicio, organización),
diagrama de flujo con nodos numerados (1. Entrada del proceso →
2. Orquestador MASTER → 3. Agente de Análisis, 4. Agente
Comercial/Ejecución, 5. Agente de Validación → 6. Aprobación
humana con botones Aprobar/Rechazar → 7. Resultado), panel
lateral de detalles (objetivo, etapa actual, agente activo,
próxima acción permitida, políticas/restricciones activas,
aprobaciones pendientes, event log) y línea de tiempo del
proceso en la parte inferior.

**Primitivas reutilizables:** card, badge, button.
**A crear:** FlowDiagram (nodos + flechas + estado por nodo),
DetailPanel lateral, Timeline.

**Mapeo a datos REALES:**

- El flujo real es el pipeline `opportunity.intake` v1 (6
  pasos) y NO tiene la forma de la imagen: entrada (oportunidad
  cruda) → normalize → dedup → classify → upsert → next_action
  → draft → (aprobación humana del borrador) → oportunidad en
  `in_follow_up` + tarea abierta. Mapeo paso → agente real vía
  `GET /api/tools`: normalize/dedup/upsert = Captación,
  classify = Calificación, draft = Respuesta y propuesta,
  next_action = Seguimiento. QA y políticas NO tiene paso
  (revisa, no ejecuta) y NO es un nodo del flujo.
- "Orquestador MASTER" como nodo con corona: NO existe como
  entidad. El "orquestador" es la secuencia fija `runIntake`
  en `engine.ts` (hallazgo del diagnóstico C1: no hay
  orquestador como entidad). Tratamiento: el nodo central
  puede representarse como "Pipeline: Captación de
  oportunidad" (el workflow real), sin corona Master y sin
  presentarlo como agente.
- "Etapa actual": REAL y derivable — último paso `done` de
  `GET /api/executions/:id/steps` (o el estado del proceso).
- "Agente activo": derivable — agente del paso en curso o del
  último paso ejecutado. Para una ejecución terminada, no hay
  "agente activo" (terminó); mostrar el último.
- "Próxima acción permitida" (revisar/aprobar/rechazar):
  REAL como acciones del borrador (`POST /api/drafts/:id/
  approve|reject`, solo admin). No hay "próxima acción" del
  flujo más allá de la aprobación.
- "Políticas activas": REALES — `GET /api/policies` (reintento
  solo admin, tope 3, borradores 7 días, solo admin aprueba).
  Las de la imagen (umbral de $50k, GDPR) NO existen.
  Tratamiento: mostrar las políticas reales, no las de la
  imagen.
- "Aprobaciones pendientes": REAL — `GET /api/drafts`
  filtrado a `pending_approval` (o `GET /api/stats` →
  `pendingDrafts` para el conteo).
- "Event Log": REAL en parte — pasos con `created_at` +
  auditoría. Los textos de la imagen ("Agente de Validación
  en espera") no existen como eventos; no copiarlos.
- "Línea de tiempo": REAL como secuencia de pasos con
  `created_at` (más la auditoría relacionada). Los hitos de
  la imagen (09:30 Inicio, 09:32 Entrada…) se reemplazan por
  los timestamps reales de los pasos.
- "Resultado": REAL — `result_json.opportunity` (oportunidad
  creada/duplicada) + tarea + borrador, o `error` si falló.
- "En ejecución" como badge del proceso: solo real mientras
  `status: running` (transitorio; una corrida puede quedar
  así si el servidor cae a mitad del intake). No es un estado
  permanente del orquestador.

**Brechas honestas y tratamiento:**

- No implementar "Orquestador" como sección propia del menú:
  no hay entidad que supervisar ahí y duplicaría Actividad.
  Tratamiento recomendado: el diagrama de flujo vive como
  **vista de detalle de un proceso/ejecución** (dentro de
  Actividad, o como detalle de la pantalla Procesos si se
  implementa), con datos reales de esa ejecución.
- "Agente de Validación", "Agente Comercial/Ejecución" como
  nodos separados con % y estados propios: NO existen así.
  Los nodos reales son los 6 pasos con sus 4 agentes
  (Captación ×3 pasos, Calificación, Seguimiento, Respuesta
  y propuesta). Tratamiento: diagrama con los 6 pasos
  reales, sin nodos inventados.
- Botones Aprobar/Rechazar dentro del nodo de aprobación:
  REALES como endpoints (solo admin, con sus 409). Pueden
  ofrecerse en el detalle, no como acción directa sin
  confirmación (el vanilla usa diálogo de confirmación para
  el reintento; para aprobar/rechazar, el diálogo con nota
  ya existe en el vanilla y debe replicarse).
- "Organización: InnovaCorp", "#PROC-9402": IDs y nombres
  demostrativos. Lo real: `id` UUID del proceso y
  `org.name` de `GET /api/me`.

---

## B. Navegación: conciliar las referencias con las 6 secciones reales

Las 9 referencias usan, entre sí, navegaciones distintas e
incompatibles: Dashboard / Análisis / Procesos / Agentes IA /
Integraciones / Configuración / Centro de ayuda (img 1); Inicio /
Tareas / Procesos / Clientes / Informes / Configuración / Ayuda
(img 2); Inicio / Proyectos / Datos / Agentes / Análisis / Ajustes /
Ayuda (img 3); Inicio / Clientes / Flujos de Trabajo /
Oportunidades / Tareas / Reportes / Ajustes / Ayuda (img 4);
Dashboard / Oportunidades / Contactos / Empresas / Proyectos /
Reportes / Ajustes (img 5); Dashboard / AI Agents / Flujos de
trabajo / Aprobaciones / Informes / Configuración (img 6); Actividad
y ejecuciones / Panel de control / Agentes de IA / Flujos de trabajo
/ Configuración / Seguridad / Ayuda (img 7); Dashboard /
Integraciones / Proyectos / Automatización / Reportes / Ajustes
(img 8); Dashboard / Procesos / Orquestador / Agentes /
Configuración / Reportes / Ayuda (img 9). Ninguna coincide con la
navegación real, y ninguna coincide con las demás. No se puede
adoptar ninguna tal cual sin romper la arquitectura.

**Las 6 secciones reales (ya construidas en `AppLayout.tsx`, no se
tocan):** Inicio, Oportunidades, Tareas y seguimientos,
Aprobaciones, Actividad y ejecuciones, Agentes.

**Mapa de conciliación (sin inventar secciones):**

| Pantalla de referencia | Destino real | Nota |
|---|---|---|
| Procesos (img 1) | Dentro de **Actividad y ejecuciones** como vista de procesos, o sección nueva solo si Tomás la aprueba (ver § E) | Los procesos son corridas del pipeline; hoy viven como tarjeta en Actividad (vanilla). No es una de las 6 secciones, pero es la única pantalla "nueva" con datos reales suficientes para justificar una entrada |
| Tareas y seguimientos (img 2) | **Tareas y seguimientos** (directo) | Es la sección real; la referencia aporta tabla + panel de detalle |
| Agentes (img 3) | **Agentes** (directo) | Es la sección real; la referencia aporta tarjetas + filtros + detalle |
| Clientes (img 4) | **Ninguna (fuera de alcance)** | Sin entidad cliente (ver § 4). No se crea sección; la agregación derivada, si se pide, iría como vista secundaria dentro de Oportunidades, no como sección propia |
| Oportunidades (img 5) | **Oportunidades** (directo) | Es la sección real; la referencia aporta tabla + panel con pestañas |
| Aprobaciones (img 6) | **Aprobaciones** (directo) | Es la sección real; la referencia aporta lista + panel de revisión (evolución del diálogo actual) |
| Actividad y ejecuciones (img 7) | **Actividad y ejecuciones** (directo) | Es la sección real; la referencia aporta tabla de ejecuciones + inspector |
| Integraciones (img 8) | **Ninguna (fuera de alcance)** | Sin backend de integraciones (ver § 8). No se crea sección ni se muestra catálogo ficticio |
| Orquestador (img 9) | **Detalle dentro de Actividad** (no sección) | El flujo es la vista de detalle de una ejecución/proceso real (ver § 9). No se crea sección "Orquestador" |

**Elementos de navegación de las referencias que se descartan en
todos los casos (sin dato que los respalde):** Dashboard como
duplicado de Inicio (Inicio YA es el dashboard real),
Proyectos, Datos, Contactos, Empresas, Informes, Reportes,
Análisis, Automatización, Configuración (no hay panel de
configuración; las políticas son de solo lectura por API),
Seguridad, Centro de ayuda, campana de notificaciones y buscador
global (el buscador solo es honesto si filtra de verdad la tabla
en pantalla, como en § 1/2/5/7; nunca como caja decorativa
global). El usuario y el "Cerrar sesión" del pie de la barra
lateral SÍ existen (chip de `/api/me` + logout real, ya
construidos en la Fase 3).

## C. Sistema de diseño compartido

**Tokens ya existentes (no se tocan):** fondo `#f7f8fc`,
superficies `#ffffff`, primario `#4f46e5`, hover `#4338ca`,
sutil `#eef2ff`, texto `#172033`, secundario `#64748b`,
atenuado `#94a3b8`, bordes `#e2e8f0`, éxito `#15803d`,
advertencia `#b45309`, error `#b91c1c`, info `#1d4ed8`;
radios 8/12/16 px; fuente system stack; foco visible global
(`index.css`, `@theme` Tailwind v4). Las 9 referencias usan
esta misma familia (fondo claro, acento índigo, tarjetas
blancas redondeadas, badges de color por estado), así que el
tema actual las absorbe sin cambios de paleta. Diferencias
menores a normalizar, no a copiar: algunas referencias usan
azul marino casi negro para la barra lateral activa y otras
lavanda; la barra real es clara con ítem activo en sutil
(`primary-subtle`) — se mantiene la real.

**Elementos que aportan las referencias y su reutilización:**

| Elemento | Estado | Reutilización |
|---|---|---|
| Panel lateral de detalle (derecho, con cierre X, secciones apiladas, acciones abajo) | **Nuevo, reutilizable tal cual** | Un `DetailPanel` compartido para las 6 secciones: título, subtítulo/ID, secciones, acciones al pie. Es el componente de mayor valor del set: unifica Oportunidades, Tareas, Aprobaciones, Actividad, Agentes y Procesos |
| Tablas con cabecera, badges de estado/prioridad y fila seleccionable | **Nuevo, reutilizable tal cual** | Un `Table` compartido (cabecera fija, celdas, badge, fila clicable que abre el DetailPanel). Las columnas varían por sección; el componente no |
| Filtros (buscador + selects + chips + "Limpiar") | **Nuevo, reutilizable tal cual** | Un `FilterBar` compartido; los valores de cada filtro son los reales de cada sección (nunca listas copiadas de la imagen). Todos los filtros son en cliente (no hay query params) |
| Tarjetas de resumen (número grande + etiqueta + icono) | **Composición nueva sobre `card`** | `StatCard` compartida; SIN variación % (no hay serie temporal). Los conteos son siempre derivables de endpoints reales |
| Badges de estado/prioridad | **Existe (`badge.tsx`)**, ampliar variantes | Los colores ya existen (éxito/advertencia/error/info); faltan variantes por estado real (`new`/`proposal_draft`/`in_follow_up`, `running`/`done`/`failed`, `pending_approval`/`approved`/`rejected`) mapeadas 1 a 1, sin inventar estados |
| Diagrama de flujo (nodos + flechas + estado por nodo) | **Nuevo, específico** | `FlowDiagram` para el detalle de proceso/ejecución: nodos = pasos reales, estado por nodo = estado del paso, agente debajo = mapa paso → agente (`/api/tools`). Sin librería de grafos: SVG/divs con tokens |
| Línea de tiempo | **Nuevo, específico** | `Timeline` para pasos (`created_at`) + eventos de auditoría relacionados. Sin hitos inventados |
| Pestañas en el panel de detalle | **Nuevo, reutilizable** | `Tabs` compartido (Overview / Borrador / Tareas / Actividad, según la sección, solo con contenido real) |
| Paginación ("Mostrando 1 a 5 de N", anterior/siguiente) | **Nuevo, en cliente** | `Pagination` sobre los topes reales del servidor (100/200). No es paginación de servidor: lo documenta el componente |
| Toggle / Switch | **No crear** | No hay nada real que conmutar (ni settings por cliente, ni integraciones). Crear el componente para una pantalla ficticia sería el primer paso hacia mostrarlo con datos falsos |
| Diálogo de confirmación | **Existe en vanilla, falta en React** | El vanilla tiene diálogo propio con trampa de foco para aprobar/rechazar y reintentar. En React hay que construir `Dialog` (con la misma trampa de foco con filtro de no visibles) antes de migrar Aprobaciones y Actividad |
| Estados carga / vacío / error / éxito / denegado | **Parcialmente existen** | Inicio ya los tiene (cargando, `role="alert"` + Reintentar, vacíos con textos del vanilla, 401 → acceso). El patrón se replica en cada vista; "éxito" solo tras confirmación del backend; "denegado" = 403 real (member que aprueba/reintenta) con su mensaje |

## D. Propuesta de fases pequeñas y ordenadas

Compatible con lo construido: Inicio real ya mergeado (NO se rehace);
las 5 secciones restantes siguen como placeholders y se reemplazan
una por una, cada una con su verificación y su merge (mismo ritmo
que Fases 2–4). El orden prioriza cobertura real y reutilización de
componentes: primero lo que más datos reales tiene y más componentes
compartidos deja listos.

**Fase R1 (recomendada primera): Oportunidades + componentes
compartidos (Table, DetailPanel, Tabs, FilterBar).**
Por qué primera: es la vista con mayor cobertura real del set
(tabla completa, alta manual real, detalle con borrador/tareas/
auditoría reales), y deja construidos los 4 componentes que usan
todas las demás. Datos reales: `GET /api/opportunities`,
`POST /api/opportunities`, `GET /api/drafts`, `GET /api/tasks`,
`GET /api/audit?opportunityId=`. Explícitamente fuera: valor
estimado, probabilidad, fecha de cierre, desglose IA, "Agente IA
Asignado", montos, pestaña "AI Breakdown" (se reemplaza por
"Borrador" real). Incluye: tabla con buscador y filtros reales
(estado/prioridad/fuente, en cliente), panel de detalle con
pestañas Overview / Borrador / Tareas / Actividad, y alta manual
con el formulario real del vanilla.

**Fase R2: Tareas y seguimientos.**
Datos reales: `GET /api/tasks`, `PATCH /api/tasks/:id`
(completar/reabrir), joins en cliente a oportunidades.
Explícitamente fuera: crear tarea, reasignar, comentar, cancelar,
prioridad por tarea (se muestra la de la oportunidad, etiquetada),
entregables/adjuntos, recomendación IA, tarjeta "En curso" como
estado (se redefine o se omite). Incluye: tarjetas de resumen
reales (pendientes/vencidas/completadas, sin %), tabla, panel de
detalle (objetivo = título, oportunidad, auditoría real).

**Fase R3: Aprobaciones + Dialog.**
Datos reales: `GET /api/drafts`, approve/reject (admin, con
409 `draft_expired`/`draft_stale`). Incluye: construcción del
`Dialog` con trampa de foco (requisito previo, no opcional),
lista con filtros reales, panel de revisión lateral (evolución
del diálogo vanilla) con advertencias reales de vencido/
desactualizado. Explícitamente fuera: "Solicitar cambios" como
acción (rechazar con nota es el flujo real), tipos de acción
distintos del borrador, riesgos calculados, plan/versión.

**Fase R4: Actividad y ejecuciones + inspector.**
Datos reales: `GET /api/executions`, `GET /api/executions/:id/
steps`, `POST /api/executions/:id/retry`, `GET /api/audit`,
`GET /api/processes` (tarjeta de procesos, como el vanilla).
Incluye: tabla de ejecuciones, inspector lateral (metadata,
pasos, inputs/outputs con máscara opcional en cliente, error,
reintento completo con confirmación). Explícitamente fuera:
reintento por paso, omitir/investigar, decision logs, IDs con
formato inventado, duración guardada (se deriva solo para
terminadas).

**Fase R5: Agentes.**
Datos reales: `GET /api/agents`, `GET /api/tools`,
`GET /api/tasks` (conteos por agente). Incluye: lista de los 5
agentes reales con descripción y pasos, panel de detalle
(capacidades = pasos, procesos/tareas derivadas, políticas
globales como tales). Explícitamente fuera: estados
Activo/Disponible/En pausa/Con incidencias, "hace X" sin fuente,
permisos por agente, salidas descargables, orquestador Master.

**Fase R6 (opcional, solo si Tomás la aprueba): Procesos como
vista + FlowDiagram.**
Datos reales: `GET /api/processes`, `GET /api/processes/:id`,
steps, tools, policies. Incluye: tabla de corridas (nombre =
workflow, cliente/categoría derivados y etiquetados),
FlowDiagram con los 6 pasos reales y panel de detalle.
Explícitamente fuera: "Nuevo proceso", pausar/editar/cancelar,
objetivo guardado, logs INFO/DEBUG, estado "Requiere atención".
Si Tomás no aprueba la sección, el FlowDiagram vive igual como
detalle dentro de Actividad (R4) y esta fase no se hace.

**No fases (fuera de alcance hasta decisión de producto):**
Clientes como sección, Integraciones como sección, Orquestador
como sección, buscador global, campana de notificaciones,
panel de configuración, reportes. Ver § E.

## E. Decisiones que necesita Tomás antes de implementar

1. **Clientes:** ¿se descarta la sección Clientes (recomendado,
   sin entidad real) o se pide una vista derivada de "Empresas"
   desde oportunidades (sin estado, sin montos, sin
   configuración)? No se implementa nada de Clientes sin esta
   respuesta.
2. **Integraciones:** ¿se descarta la pantalla (recomendado,
   sin backend real) o se define qué integraciones reales
   ofrecería PENSIA? Sin definición de producto + backend
   (registro, credenciales seguras, health checks), no hay
   nada que mostrar.
3. **Procesos como sección:** ¿Procesos merece una entrada
   propia en la navegación (R6) o queda como tarjeta dentro
   de Actividad (como hoy en el vanilla) + detalle con
   diagrama? La navegación real tiene 6 secciones; añadir una
   séptima es decisión de producto, no de implementación.
4. **Orquestador:** ¿el diagrama de flujo vive como detalle
   de ejecución dentro de Actividad (recomendado) o se quiere
   alguna vista propia? En ningún caso se crea un agente
   "Master" ni nodos que no sean los 6 pasos reales.
5. **Panel lateral vs. diálogo:** en Aprobaciones, ¿el panel
   lateral de revisión reemplaza al diálogo actual del
   vanilla, o conviven (panel para ver, diálogo para decidir)?
   La recomendación es panel para ver + diálogo de
   confirmación para aprobar/rechazar (con nota al rechazar),
   preservando la trampa de foco y los 409.
6. **"En curso" en Tareas:** ¿se omite la tarjeta (recomendado,
   no es estado real) o se redefine como "abiertas no vencidas"
   con esa etiqueta exacta? No se muestra un conteo con un
   nombre que el backend no tiene.
7. **"Atención Humana" y "Agente Asignado" en Oportunidades:**
   ¿se aceptan las derivaciones honestas propuestas (borrador
   pendiente = atención humana; Seguimiento solo si hay tarea
   abierta) o se omiten ambas columnas? No se inventa un
   agente por oportunidad.
8. **Filtros y paginación en cliente:** ¿se acepta que todos
   los filtros y la paginación sean en cliente sobre los
   topes del servidor (100 oportunidades/tareas/ejecuciones/
   procesos, 200 eventos de auditoría), o se pide paginación
   y filtros en el servidor (trabajo de backend, fuera de
   estas fases)? Con volúmenes demo no se nota; con volumen
   real sí.
9. **Máscara de datos en el inspector:** ¿los inputs/outputs
   de ejecuciones se muestran completos o enmascarados
   (correo/nombre parciales)? Contienen datos personales
   reales de oportunidades; es decisión de presentación con
   implicancia de privacidad, no técnica.
10. **Orden de fases:** ¿se aprueba el orden R1 → R6
    (Oportunidades primero por cobertura real y componentes
    compartidos) o se prefiere otro orden (por ejemplo,
    Aprobaciones antes, por ser la más cercana al flujo
    comercial)? Cada fase se autoriza y mergea por separado,
    como hasta ahora.
