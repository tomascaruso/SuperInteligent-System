# H1 — Vista Inicio como dashboard de referencia + flujo de 5 etapas + pausa de agentes — REPORTE

**Fecha:** 27-oct-2026
**Base:** main `2fdd952a` (R1i) en el árbol local, rama de trabajo
`ui-fase1-foundations`. **Sin pushes, merges, PRs ni despliegues**
por instrucción: el upload lo hace el agente principal. La demo
pública no cambia y la DB real local no se escribió (ver
Pruebas/Evidencia).

## Estado general

IMPLEMENTADO EN LOCAL. La vista Inicio de React (`/v2/#/inicio`)
se rediseñó como el dashboard de la referencia (Centro de
operaciones, 4 tarjetas, tabla de Procesos en ejecución,
Actividad reciente en línea de tiempo, Estado de los agentes y
Orquestador con el flujo de 5 etapas), el sistema se adaptó al
flujo Recepción → Análisis → Validación → Aprobación →
Resultado como derivación de datos reales, y se creó la pausa
real de agentes (solo admin, con bloqueo efectivo de nuevos
ingresos). Suite **135/135** (123 previos + 12 nuevos), build
limpio, smoke con servidor real sobre copia de DB en verde.

## Objetivo

1. Que Inicio se vea como la referencia dashboard, sin ningún
   dato inventado (sin 99,9%, sin 12/142, sin ACME Corp, sin
   fotos de personas para agentes).
2. Adaptar el sistema al flujo de 5 etapas de la referencia,
   derivado de lo que el sistema realmente hace.
3. Crear la pausa de agentes como funcionalidad real (no solo
   visual): pausar bloquea los ingresos nuevos y reanudar los
   restaura, para que los clientes puedan pausar al agente en
   cuestión.

## Acciones

### Backend

- **Etapas (`app/src/stages.ts`, nuevo, cálculo puro sin base):**
  `deriveStages()` devuelve las 5 etapas en orden, cada una con
  id, nombre, estado (`pending | done | failed | rejected |
  paused`), agente (o null en Aprobación, con etiqueta
  "Aprobación humana"), detalle breve, pasos con etiquetas
  legibles (Normalizar, Deduplicar, Guardar, Clasificar) y, en
  Validación, la lista de chequeos con pass/fail. Mapeo:
  Recepción = normalize/dedup/upsert (Captación); Análisis =
  classify (Calificación); Validación = chequeos deterministas
  de QA y políticas sobre oportunidad y borrador reales
  (datos presentes, borrador existe, borrador actualizado
  contra su foto, borrador vigente a 7 días, categoría y
  prioridad válidas; agente QA y políticas); Aprobación =
  estado del borrador vigente; Resultado = oportunidad en
  seguimiento tras aprobar + tarea abierta (Seguimiento).
  La etapa actual es la primera etapa bloqueante
  (fallida/rechazada/pausada) si la hay, si no la primera
  pendiente, si no Resultado. El borrador vigente es el último
  por creación DESC, igual que en Oportunidades.
- **Pausa de agentes:** columna `agents.paused` (migración
  portable con el patrón C4/C5: probar y ALTER solo si falta;
  en bases nuevas viene del DDL con DEFAULT 0).
  `GET /api/agents` suma por agente `paused`, `openTasks` y
  `status` derivado (`paused` si el flag está activo; si no,
  `busy` si tiene tareas abiertas; si no, `available`).
  `PATCH /api/agents/:id/paused` con `{ paused: boolean }`
  (solo admin: 403 member, 404 inexistente, 400 body
  inválido), registra `agent.paused` / `agent.resumed` en
  auditoría y devuelve el agente actualizado.
- **Pre-chequeo de pausa en el intake:** en `runIntake`, ANTES
  de escribir cualquier dato de negocio (oportunidad, tarea,
  borrador, evento, auditoría) y después de crear la ejecución
  y la corrida (para que el intento quede visible), si algún
  agente del roster del workflow (los 5) está en pausa, se
  escribe un paso `intake` fallido, la ejecución y la corrida
  quedan fallidas y se lanza `AgentPausedError`. Las rutas de
  alta manual, webhook y reintento lo traducen a **409**
  `{ error: 'agent_paused' }` con un mensaje que nombra al
  agente. El worker pasa por `runIntake`, así que un job con
  un agente en pausa queda fallido con el mismo error, sin
  crear nada. No se guarda clave de idempotencia del intento
  bloqueado en webhook: al reanudar, el mismo webhook vuelve a
  ingresar sin quedar marcado como duplicado.
- **Vínculo corrida–oportunidad:** columna nueva
  `process_runs.opportunity_id` (misma migración portable).
  `runIntake` la escribe al terminar con éxito; un backfill en
  arranque la completa para corridas viejas parseando
  `result_json` en código (sin SQL JSON, que difiere entre
  SQLite y Postgres) y, si no hay resultado, el evento de
  intake de esa ejecución. Corridas sin vínculo (fallidas antes
  de crear la oportunidad) quedan en NULL y la UI muestra "—".
- **Procesos:** `GET /api/processes` suma la oportunidad
  vinculada (contacto/empresa) por JOIN barato y portable; la
  etapa actual NO va en la lista (se deriva en el detalle y la
  vista carga el detalle solo de las filas que muestra, máx.
  8). `GET /api/processes/:id` suma el campo aditivo `stages`
  (derivación completa), `currentStageId` y la oportunidad
  resumida; el contrato anterior `{ process, execution }` no
  cambia.
- **Stats:** `GET /api/stats` suma `runningProcesses` y
  `doneProcesses` (por org); los campos existentes no cambian.

### Frontend (solo Inicio)

- **Encabezado:** título "Centro de operaciones", subtítulo
  de la referencia ("Supervisa los procesos y agentes de tu
  organización") y nombre real de la organización (de
  `/api/me`, texto, NO un selector falso). La píldora "Sistema
  operativo" vive en `AppLayout` (sin porcentaje, porque no
  existe medición de uptime) y NO se duplicó en la vista.
- **4 tarjetas:** Procesos activos (`runningProcesses`),
  Tareas pendientes (`openTasks`), Aprobaciones pendientes
  (`pendingDrafts`), Procesos completados (`doneProcesses`).
  Sin flechas de tendencia (no hay historia). Tareas y
  Aprobaciones enlazan a sus vistas; las de procesos hacen
  scroll a la tabla de Procesos de esta misma vista.
- **Tabla "Procesos en ejecución":** últimas 8 corridas con
  Proceso (nombre del workflow + id corto), Cliente
  (empresa/contacto o "—"), Estado (En curso/Completada/
  Fallida), Agente activo (agente de la etapa actual o
  "Aprobación humana"), Etapa actual y Última actualización
  relativa (helper nuevo `formatRelative`). Clic (o Enter/
  Espacio) en una fila abre el diálogo del proceso. Sin barra
  interna: tabla 12 px como en R1i, celdas que envuelven.
- **Actividad reciente en línea de tiempo:** mismos 5 eventos
  comerciales de antes (sin inicios de sesión), ahora con
  icono Lucide por acción (incluye `agent.paused` /
  `agent.resumed`, con sus etiquetas nuevas en `format.ts`).
- **Estado de los agentes:** los 5 agentes reales con avatar
  de iniciales + color (CAP/CAL/RES/SEG/QA, nunca fotos de
  personas: los agentes son software), nombre, descripción,
  punto de estado + etiqueta (Disponible/Ocupado/En pausa) y
  cantidad de tareas abiertas. El botón Pausar/Reanudar solo
  lo ve un admin (el member ve el estado sin botón) y pide
  confirmación con el `Dialog` reutilizable: pausar no se hace
  por accidente con un clic. Al confirmar hay feedback en la
  vista y refresco; un 403 se muestra legible.
- **Orquestador a todo el ancho:** el flujo de 5 etapas de la
  corrida seleccionada (por defecto la más reciente), cada
  etapa con su estado, su agente (o "Aprobación humana") y
  resaltada la etapa actual; botón "Ver proceso" que abre el
  diálogo con el detalle por etapa (pasos con ✓/✗/○,
  chequeos de validación con su detalle, estado del borrador
  y oportunidad vinculada).
- **Eliminada la sección "Acciones prioritarias"** de Inicio
  (pedido del usuario: la vista es la de la referencia; las
  tareas siguen viviendo en la vista Tareas).

### Tests

- `app/src/stages.test.ts` (nuevo, 7 tests): derivación de
  etapas — corrida hecha con borrador pendiente, todas hechas
  tras aprobar, borrador rechazado, corrida fallida por límite
  (etapa actual fallida con el error traducido), corrida
  bloqueada por pausa (Recepción pausada y nombra al agente),
  validación con borrador desactualizado/vencido, borrador
  decidido que no vence.
- `app/src/h1.test.ts` (nuevo, 5 tests): estado derivado de
  agentes, PATCH solo admin + 404 + body inválido + auditoría,
  alta manual bloqueada sin crear nada y restaurada al
  reanudar (con ejecución/corrida fallidas visibles y etapa
  pausada en el detalle), webhook bloqueado con 409 y sin
  clave de idempotencia, stats con los dos campos nuevos y
  detalle de proceso con etapas y cliente.
- Ajuste con criterio del test marcador de la Fase 4 en
  `server.test.ts`: la vista Inicio ya no llama a
  `/api/tasks?status=open`, `/api/drafts` ni `/api/executions`
  (se eliminó Acciones prioritarias por pedido del usuario),
  así que esos marcadores se reemplazaron por las APIs y los
  textos reales de H1 (`/api/processes`, `/api/agents`,
  "Procesos en ejecución", "Estado de los agentes",
  "Orquestador", el subtítulo de la referencia). No se borró
  cobertura a escondidas: el comportamiento nuevo está
  cubierto por `h1.test.ts` y `stages.test.ts`.

## Archivos

Creados:
- `app/src/stages.ts` (derivación de etapas)
- `app/src/stages.test.ts` (7 tests)
- `app/src/h1.test.ts` (5 tests)
- `docs/H1-INICIO-REPORTE.md` (este informe)

Modificados:
- `app/src/db.ts` (columnas `agents.paused` y
  `process_runs.opportunity_id` + migraciones portables y
  backfill en arranque)
- `app/src/engine.ts` (`AgentPausedError`, pre-chequeo de
  pausa en `runIntake`, `opportunity_id` al terminar)
- `app/src/routes.ts` (GET/PATCH de agentes, procesos con
  cliente y etapas, stats con procesos, 409 `agent_paused` en
  alta manual, webhook y reintento; ningún contrato existente
  cambia de forma ni de comportamiento salvo el pre-chequeo)
- `app/client/src/lib/api.ts` (tipos y fetchers H1)
- `app/client/src/lib/format.ts` (etiquetas de proceso/etapa/
  agente, acciones de pausa en auditoría, `formatRelative`)
- `app/client/src/features/inicio/HomeView.tsx` (reescritura
  completa de la vista)
- `app/src/server.test.ts` (solo el test marcador de la Fase
  4, ajustado con criterio documentado arriba)

No tocados (verificables): `app/public/app.js` (MD5 abajo),
navegación (las 6 secciones reales), `render.yaml`,
`.github/workflows`, resto de vistas React.

## Pruebas

- `npm run build` (tsc servidor + cliente Vite): limpio. El
  JS construido contiene "Procesos en ejecución" y
  "Orquestador".
- `npm test`: **135/135 en verde** (123 previos + 12 nuevos;
  8 archivos de test). Dos fallos intermedios, ambos
  corregidos con causa: (1) la regla de fallo de etapas
  marcaba Resultado en vez de la primera etapa incompleta —
  se corrigió la derivación, no el test; (2) `GET /api/agents`
  daba 500 en pg-mem por una subconsulta correlacionada (el
  mismo límite del emulador documentado en C3) — se reemplazó
  por una consulta agrupada separada.
- Smoke con servidor real sobre COPIA de la DB en /tmp
  (puerto libre, proceso matado por PID exacto, copia
  borrada al final, ningún servidor quedó corriendo):
  `/health` 200, `/v2/` 200, `/` 200 (vanilla intacto), login
  demo 200; `GET /api/stats` con `runningProcesses: 0` y
  `doneProcesses: 3`; `GET /api/agents` con Seguimiento
  `busy` (3 tareas abiertas) y el resto `available`; `GET
  /api/processes` con 3 corridas y cliente real (el backfill
  funcionó en la copia: Ana Ruiz, Pedro Gómez/Negocio SRL,
  Lucía Fernández/Empresa Ejemplo); detalle de la primera
  corrida con etapas hecha/hecha/hecha/pendiente/pendiente y
  etapa actual Aprobación; crear member 201; member PATCH
  paused **403**; admin pausa Captación 200; alta manual con
  Captación en pausa **409 `agent_paused`** nombrando a
  Captación, con oportunidades sin cambio (3 antes y 3
  después); reanudar 200 y alta manual posterior **201** con
  tarea y borrador.
- `app/public/app.js` MD5: `44ef9ae6daf62c3b9c335f6f2501256a`
  (idéntico a la referencia).
- DB real local `app/data/superinteligent.db` MD5 antes y
  después: `af175edc7673befe9b9f3ace3c556c12` (sin cambios;
  solo se usaron copias en /tmp y bases en memoria).

## Evidencia

- Números del smoke (copia de la DB local, 3 oportunidades
  seed): stats `{"opportunities":3,"openTasks":3,
  "pendingDrafts":3,"failedExecutions":0,
  "runningProcesses":0,"doneProcesses":3}`; agentes
  `follow_up busy/3 tareas`, resto `available/0`; detalle de
  proceso con etapas `recepcion done, analisis done,
  validacion done, aprobacion pending, resultado pending`.
- El alta bloqueada por pausa devolvió
  `{"error":"agent_paused","message":"El agente Captación
  está en pausa; el ingreso quedó bloqueado hasta que se
  reanude."}` y no creó oportunidad, tarea ni borrador.

## Decisiones

- **Semántica de pausa (bloqueo de nuevos intakes):** pausar
  bloquea alta manual, webhook, reintento y worker (todos
  pasan por `runIntake`); no afecta corridas ya terminadas ni
  borra nada. Es la semántica que pidió el usuario ("para que
  los clientes tengan la posibilidad de pausar al agente en
  cuestión") y la única honesta sin reescribir el motor: el
  pipeline es sincrónico y no hay trabajadores de fondo que
  detener.
- **Pausa global, no por organización:** el catálogo de
  agentes es global (C4), así que pausar un agente lo pausa
  para todas las orgs. La auditoría del cambio queda en la org
  del admin que lo hizo (la tabla de auditoría es por org).
  Si PENSIA quiere pausa por cliente, es otro modelo de datos
  (pausa por org), no un ajuste visual.
- **Validación como cálculo, no paso de motor:** no se agregó
  ningún paso al pipeline; los chequeos se calculan sobre los
  datos actuales de oportunidad y borrador. Consecuencia: la
  validación de una corrida vieja puede cambiar si el borrador
  vence después (hoy ya no es aprobable) — eso es correcto
  para supervisión, pero no es una foto histórica.
- **Cliente "—" si no hay vínculo:** corridas fallidas antes
  de crear la oportunidad no tienen cliente y muestran "—";
  nunca se inventa un nombre.
- **Borrador vigente = último por creación DESC:** igual que
  en Oportunidades; si un borrador aprobado viejo convive con
  uno pendiente nuevo, el vigente es el nuevo.
- **Punto de fallo:** en una corrida fallida, la etapa que se
  marca fallida es la primera no hecha entre Recepción y
  Aprobación (Resultado es consecuencia, no punto de fallo).
- **Píldora "Sistema operativo" en AppLayout:** ya existía
  sin porcentaje y se deja ahí; duplicarla en HomeView sería
  ruido visual.
- **Layout vs. referencia:** la referencia pone Procesos,
  Actividad y Agentes en 3 columnas; acá Procesos va a todo
  el ancho (su tabla tiene 6 columnas y en 3 columnas quedaría
  apretada, el mismo problema que motivó R1i), luego Actividad
  + Agentes en 2 columnas y el Orquestador a todo el ancho.
  Los bloques son los mismos, en otro orden de composición.
- **Avatares:** iniciales CAP/CAL/RES/SEG/QA con colores
  pasteles (evitan la colisión CAP/CAL entre Captación y
  Calificación) en vez de fotos de personas.
- **409 para `agent_paused`:** conflicto de estado, como los
  409 de conflictos del repo (borrador ya decidido, reintento
  no permitido), no 400 ni 500.
- **Etapa actual en la lista:** no se calcula en
  `GET /api/processes` (costaría pasos+borrador+tarea por
  fila); la vista carga el detalle solo de las 8 filas que
  muestra.

## Riesgos

- **Sin verificación visual local (sin navegador en la VM):**
  el click-through de Inicio (tarjetas, filas clicables,
  diálogos de proceso y de pausa, botón solo para admin),
  los anchos reales de la tabla de 6 columnas y el aspecto de
  la línea de tiempo y del flujo del Orquestador solo se
  confirman en la verificación en vivo post-merge. En móvil
  angosto la tabla envuelve sus celdas (sin barra interna, por
  decisión) y puede crecer en alto; es el compromiso elegido
  frente a la regla contra barras internas.
- **Pausa global multi-tenant** (ver Decisiones): un admin de
  una org pausa el agente para todas. En la demo de una sola
  org no se nota; en producción con varios clientes, conviene
  decidir la pausa por org antes de ofrecerla como capacidad
  comercial.
- **Validación sobre datos actuales** (ver Decisiones): no es
  una foto histórica de la corrida.
- **Iconos Lucide:** verificados por tipos en el build
  (`tsc`), no visualmente; si algún icono no renderiza como
  se espera, se ve en la verificación en vivo.
- **Dist del cliente:** `client/dist` está gitignorado y no
  forma parte del snapshot; el despliegue lo reconstruye con
  `npm run build` (las herramientas del cliente están en
  `dependencies`, no en `devDependencies`).

## Próximo paso

Verificación independiente del agente principal y, si la
aprueba, ofrecimiento del merge al usuario (subida por
snapshot de texto + verificación de PNG del logo conservados
+ PR + merge + verificación en vivo post-merge con la fila de
Laura y Fernando presentes, que no debe tocarse: solo lectura,
salvo abrir diálogos y cerrarlos con Cancelar, sin pausar
ningún agente en la demo pública durante la verificación).

## Autorización requerida

- Subir y mergear H1 (decisión del usuario, vía el agente
  principal). Nada de esta fase se subió, mergeó ni desplegó.
