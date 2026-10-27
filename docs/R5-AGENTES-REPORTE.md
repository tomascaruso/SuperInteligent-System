# R5 — Agentes + Orquestador Central + separadores en Actividad — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local. Con R5 quedan
las 6 secciones reales implementadas en /v2/ (Inicio, Oportunidades,
Tareas y seguimientos, Aprobaciones, Actividad y ejecuciones,
Agentes); no queda ningún aviso de migración.

**Base:** main `4b934647` (R4b) en el árbol local, rama de trabajo
`ui-fase1-foundations`. Sin pushes, merges, PRs ni despliegues por
instrucción: el upload lo hace el agente principal.

## Objetivo

1. Replicar la estructura visual de la referencia de Agentes
   (3 tarjetas, filtros Función/Estado, lista de tarjetas con
   iconos, panel Detalle con Objetivo, Capacidades, Logs,
   Procesos Activos, Permisos y Límites, Salidas) con DATOS REALES.
2. Sumar al Orquestador Central como coordinación del flujo real,
   sin fingir que es un sexto agente (decisión del usuario
   27-oct-2026 ~17:18: replicar con datos reales y sumar al
   orquestador).
3. Cerrar la corrección chiquita pendiente desde el 27-oct ~17:08:
   separadores visuales en Actividad (tabla e inspector).
4. Mantener la navegación con las 6 secciones reales (NO se copia
   el menú de la referencia: Proyectos, Datos, Análisis y Ajustes
   no existen).

## Acciones

### 1. AgentsView real en /agentes

Archivo nuevo `app/client/src/features/agentes/AgentsView.tsx`;
la ruta en `App.tsx` reemplaza el `SectionPlaceholder` (su import
se eliminó porque ya no se usaba en ningún lado). Patrón de las
vistas anteriores: tarjetas con iconos, `FilterBar` en una sola
fila, lista de tarjetas clicables, panel derecho `DetailPanel`
variante `wide` (480 px).

- **Tarjeta Orquestador Central PRIMERA**, con distintivo Master
  (icono Crown, como la referencia) y tarjetas de los 5 agentes
  reales después, cada una con icono Lucide con pastilla tintada
  (mismo patrón que las tarjetas de Tareas): Orquestación Network
  índigo, Captación Inbox índigo, Calificación Filter celeste,
  Respuesta y propuesta PenLine violeta, Seguimiento ClipboardList
  ámbar, QA y políticas ShieldCheck verde.
- **Filtros:** Función (Todas, Orquestación, Captación,
  Calificación, Respuesta y propuesta, Seguimiento, QA y
  políticas), Estado (Todos, Disponible, Activo, Con incidencias,
  En pausa) y búsqueda por nombre.
- **Acción real por agente:** Pausar/Reanudar solo admin, con
  diálogo de confirmación (mismo texto que en Inicio) y
  `PATCH /api/agents/:id/paused`; el servidor ya lo impone. En
  member no se ofrece (aviso «Solo un admin puede pausar o
  reanudar agentes»). La coordinación NO se pausa (no existe esa
  capacidad) y su detalle lo dice así.

### 2. Orquestador Central, honesto

NO es un sexto agente con pasos propios. Es la coordinación del
flujo real:

- Flujo `opportunity.intake` con su nombre real «Captación de
  oportunidad» (GET /api/workflows) y sus 6 pasos reales como
  capacidades coordinadas.
- Procesos reales desde GET /api/processes (en curso y
  completados); si no hay en curso, «Sin procesos en curso».
- Actividad reciente real (ejecuciones y auditoría).
- Estado derivado y documentado: «Activo» si hubo ejecuciones en
  los últimos 7 días; si no, «Sin actividad reciente» (no es un
  estado fingido: es el mismo criterio de ventana que las
  incidencias).
- Su descripción es texto descriptivo (no un campo del sistema:
  la coordinación no tiene descripción almacenada) y el detalle lo
  presenta como coordinación, no como agente.
- Incidencias de la coordinación = ejecuciones fallidas en los
  últimos 7 días (la coordinación es dueña del resultado del
  flujo); los fallos del paso sintético `intake` (que no pertenece
  a ningún agente) quedan cubiertos por esa misma cuenta, no se
  asignan a un agente.

### 3. Definiciones (las mismas en tarjetas, filtros y detalle)

- **Disponibles** = agentes no pausados (de los 5; la coordinación
  no se cuenta como agente).
- **Activos** = agentes con tareas abiertas (criterio H1: busy).
- **Con incidencias** = agentes con pasos fallidos en los últimos
  7 días. La atribución paso → agente sale de los steps reales de
  cada agente (GET /api/agents); QA no tiene paso propio, así que
  nunca suma incidencias por pasos (su trabajo de revisión no deja
  rastro de paso: su detalle lo dice).
- **Última actividad** = el más reciente entre: último paso del
  agente, última tarea del agente y último evento de auditoría
  sobre el agente; si no hay ninguno, «Sin actividad registrada».
  Se muestra con formato relativo real («Hace X h», «Ayer»).
- **Mini gráficos** = SVG puro (sin librería): pasos ejecutados
  por día, últimos 7 días, por agente; ejecuciones por día para la
  coordinación. Si todo es cero, la línea queda plana (eso es lo
  que los datos dicen). Las tarjetas de estadísticas NO llevan
  gráfico: no hay serie diaria real para esos conteos.
- **Objetivo** = la descripción real del agente (GET /api/agents
  la trae: Captación «Normaliza, deduplica y persiste la
  oportunidad entrante», etc.). No se redactó ninguna frase para
  los 5 agentes.
- **Capacidades y Herramientas Autorizadas** = los pasos reales
  del agente. El sistema no usa herramientas externas (C6): las
  herramientas reales son los pasos del pipeline, y el detalle lo
  dice así en vez de inventar un mapeo por herramienta.
- **Logs de Ejecución** = pasos recientes del agente (con hora y
  resultado) + eventos de auditoría sobre el agente; la
  coordinación muestra sus ejecuciones recientes.
- **Procesos Activos** = tareas abiertas reales del agente (sin
  porcentajes de progreso: no existen); la coordinación muestra
  los procesos en curso reales.
- **Permisos y Límites** = las 4 políticas globales reales de
  GET /api/policies (retry.admin_only, retry.max_attempts,
  draft.approval.admin_only, draft.expiry_days) con su descripción
  y valor reales, rotuladas como políticas del sistema que aplican
  a todos los agentes. NO hay límites por agente (nada de «50
  tareas simultáneas»).
- **Resultados recientes** = «Resultados recientes» (NO «Salidas
  Recientes» con archivos: el sistema no genera PDF, planillas ni
  informes descargables, y el detalle lo dice). Atribución honesta
  por agente: Captación → oportunidades registradas; Calificación
  → oportunidades con su categoría, prioridad y puntaje;
  Respuesta y propuesta → borradores; Seguimiento → tareas;
  QA → texto honesto («no genera salidas propias»); coordinación
  → ejecuciones recientes con su oportunidad vinculada.

### 4. Separadores en Actividad (corrección del 27-oct ~17:08)

Solo separación visual, ningún dato ni texto cambiado:

- Tabla de ejecuciones: divisor `border-b border-border` en cada
  fila (la tabla compartida solo dividía el encabezado).
- Inspector: cada sección después de Metadata (Datos de entrada,
  Cronología de pasos, Decisiones vinculadas, Diagnóstico de
  error, Reintentos, Referencias de auditoría) lleva borde
  superior en el token de borde + aire (`mt-6 border-t
  border-border pt-5`); el Detalle técnico plegado lleva aire
  arriba (`mt-6`, ya tiene su propio borde de caja).
- El detalle de Agentes usa la misma regla entre sus secciones,
  para que el criterio quede parejo en toda la app.

### 5. Solo cliente, sin cambios de servidor

No hizo falta ningún endpoint ni campo nuevo: todo sale de
GET /api/agents, /api/workflows, /api/policies, /api/tasks,
/api/drafts, /api/opportunities, /api/executions (+ steps de las
ejecuciones de los últimos 7 días), /api/processes, /api/audit y
/api/me. Los pasos se traen solo de ejecuciones recientes (la API
lista 100 como máximo); si el fetch de pasos de una ejecución
falla, esa ejecución queda sin pasos pero la vista carga igual.

## Tabla de mapeo referencia → real

| Referencia | Implementado con |
|---|---|
| 3 tarjetas (Disponibles / Activos / Con incidencias) | Conteos reales con las definiciones de arriba; sin gráficos (sin serie real) y con nota que lo explica |
| Filtros Función / Estado | Función real (Orquestación + 5 agentes), Estado real (Disponible / Activo / Con incidencias / En pausa) + búsqueda |
| Lista de tarjetas con iconos | Orquestador Central (Master) + 5 agentes, icono con pastilla tintada, estado, tareas abiertas / procesos en curso, última actividad real, mini gráfico real |
| Detalle: Objetivo | Descripción real del agente (orquestador: texto descriptivo documentado) |
| Detalle: Capacidades y Herramientas | Pasos reales; nota «sin herramientas externas» |
| Detalle: Logs de Ejecución | Pasos y auditoría reales con hora |
| Detalle: Procesos Activos | Tareas abiertas / procesos en curso reales, sin % |
| Detalle: Permisos y Límites | 4 políticas globales reales, sin límites por agente |
| Detalle: Salidas Recientes | «Resultados recientes» reales (borradores, tareas, oportunidades, ejecuciones); sin archivos |
| Orquestador Central Master | Coordinación del flujo real, no un sexto agente; no pausable |
| Números del ejemplo (8, 5, 1, «Hace 2 min») | NO copiados: todos los números y tiempos salen de la API |

## Desviaciones documentadas

- Menú de la referencia no copiado (se mantienen las 6 secciones
  reales).
- Sin gráficos en las tarjetas de estadísticas (sin serie diaria
  real para esos conteos).
- Sin «Solicitar cambios», sin reintento por paso, sin archivos de
  salida, sin límites por agente, sin porcentajes de progreso:
  ninguno existe en el sistema.
- QA y políticas nunca muestra incidencias por pasos ni salidas
  propias: no tiene paso propio en el pipeline (documentado en el
  código del motor, no es una omisión de la vista).
- La coordinación no se cuenta en los conteos de agentes ni se
  puede pausar.

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no hay
  tests nuevos de servidor; el cliente no tiene runner de tests en
  este repo).
- Build limpio (incluye `typecheck:client` limpio);
  `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`); DB
  real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`);
  ningún proceso en pie al terminar.
- Marcadores en el JS construido: «Orquestador Central»,
  «Con incidencias», «Resultados recientes». Ausentes a propósito:
  «Reporte de Eficiencia Global», «50 tareas» y cualquier nombre
  de archivo de salida inventado.
- Smoke propio en copia de DB (puerto 3473, matado por PID
  exacto): health OK, login OK (rol admin), GET /api/agents con
  los 5 agentes (Seguimiento busy con 3 tareas abiertas, resto
  available, ninguno pausado → Disponibles 5, Activos 1, en la
  copia), GET /api/tasks (3 abiertas), GET /api/policies (4),
  GET /api/processes (3 done), GET /api/executions (3) con pasos
  en orden (normalize, dedup, classify, upsert, next_action,
  draft). Los conteos de la vista se derivan de estos mismos
  endpoints, así que en la demo mostrarán sus números reales
  (5 oportunidades, 5 procesos completados, 2 tareas pendientes).

## Evidencia

- Vista: `app/client/src/features/agentes/AgentsView.tsx`
  (nuevo), ruta en `app/client/src/App.tsx`.
- Separadores: `app/client/src/features/actividad/ActivityView.tsx`
  (solo clases de separación, sin cambios de datos ni textos).

## Decisiones

- Orquestador Central como coordinación del flujo real, no como
  sexto agente (decisión del usuario 27-oct-2026 ~17:18).
- Definiciones de Disponibles / Activos / Con incidencias según
  la sección «Definiciones» de arriba.
- Separadores con el token de borde `#E2E8F0` y aire entre
  secciones, mismo criterio en Actividad y en el detalle de
  Agentes.

## Riesgos

- Si una org acumula cerca de 100 ejecuciones en 7 días, la vista
  trae los pasos de todas en paralelo al cargar. En la demo actual
  son 5; si crece mucho, conviene paginar o limitar esa carga (no
  se hizo ahora para no recortar datos reales).
- QA y políticas puede parecer «vacía» (sin pasos, sin tareas,
  sin salidas): es fiel al motor (revisa sin paso propio); su
  detalle lo explica en vez de rellenar con datos.

## Próximo paso

- Ofrecer subir y mergear R5 (mismo procedimiento que R4b, solo
  verificación de conservación de PNG) y verificación en vivo
  post-merge solo lectura (tarjetas, filtros, detalle del
  orquestador y de un agente, diálogo de pausa con Cancelar sin
  pausar nada en la demo, separadores en Actividad).
