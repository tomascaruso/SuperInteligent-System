# R3 — Aprobaciones (vista real) — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local.

## Objetivo

Reemplazar el aviso de migración de `/aprobaciones` por la vista real
de borradores pendientes y decididos, siguiendo al máximo la
composición visual de la referencia entregada por el usuario
(encabezado con contador, filtros segmentados, lista de tarjetas a
la izquierda, panel de revisión a la derecha con contenido exacto,
datos contextuales, riesgos y acciones al pie), con datos 100%
reales y sin inventar ninguna capacidad.

## Acciones

- Nueva vista `app/client/src/features/aprobaciones/ApprovalsView.tsx`
  y ruta real en `App.tsx` (reemplaza el `SectionPlaceholder` de
  aprobaciones; Actividad y Agentes siguen siendo aviso).
- Lista izquierda de tarjetas (no tabla, como la referencia): cada
  tarjeta muestra propuesta para contacto, agente "Respuesta y
  propuesta", cliente, fecha/hora de creación y motivo (categoría ·
  prioridad de la oportunidad), más badge de estado.
- Filtros segmentados (píldoras con `aria-pressed`, componente
  `Segmented` local a la vista porque la `FilterBar` compartida
  solo ofrece selects): Estado (Pendientes / Decididas / Todas,
  por defecto Pendientes), Antigüedad (Todas / Hoy / Esta semana /
  Anteriores, derivada de `created_at` en fecha local), Prioridad
  (Todas / Alta / Media / Baja, por join en cliente con
  oportunidades), más búsqueda (contacto, empresa, texto del
  borrador) y Limpiar. Paginación en cliente (20 por página).
- Panel derecho fijo (`DetailPanel` variante inline): título
  "Revisión: propuesta para {contacto}", badge de estado, sección
  "Contenido exacto del borrador" con el body verbatim en caja,
  sección "Datos contextuales" (cliente, contacto, correo,
  categoría, prioridad, puntaje real desde A1, canal), sección
  "Riesgos y Advertencias" con las advertencias reales, y acciones
  al pie (prop `footer` del panel).
- Acciones reales con diálogos de confirmación (`Dialog` con trampa
  de foco): Aprobar (primario) y Rechazar (variante peligro).
  Rechazar lleva campo de nota opcional (máx. 1000, real) con
  explicación de que con un nuevo ingreso se genera un borrador
  fresco. Tras decidir, feedback de éxito y recarga de la lista.
- Solo admin: el rol se lee de `GET /api/me`; si es member, en vez
  de botones se muestra "Solo un admin puede decidir sobre este
  borrador" (el servidor además lo impone con `requireAdmin`).
- Borradores vencidos (>7 días, C5) o desactualizados (mensaje
  cambiado, C5) muestran su advertencia y las decisiones
  DESHABILITADAS con el motivo (el servidor las rechazaría con 409
  de todos modos).
- Borradores decididos: muestran quién decidió, cuándo y la nota,
  sin acciones.
- Incluido en esta tanda (pendiente prometido): iconos Lucide con
  pastilla tintada en las 3 tarjetas de Tareas (Pendientes:
  `ClipboardList` ámbar; Vencidas: `Clock` rojo; Completadas:
  `CheckCircle2` verde), sin tocar tokens globales ni el resto de
  esa vista.

## Archivos

- Nuevo: `app/client/src/features/aprobaciones/ApprovalsView.tsx`
- Modificados: `app/client/src/App.tsx` (ruta),
  `app/client/src/features/tareas/TasksView.tsx` (solo los iconos
  de las 3 tarjetas).
- Sin cambios en el servidor (los endpoints ya existían) y sin
  cambios en la app vanilla.

## Pruebas

- Suite completa: **139/139** (sin cambio de servidor, no hizo
  falta test nuevo; ningún test existente modificado).
- Build limpio; `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`) y DB
  real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`).
- Smoke propio en copia de DB (puerto 3465, matado por PID
  exacto, nada en pie al terminar): health OK, login demo OK,
  3 borradores pendientes del seed (Ana, Pedro, Lucía, todos
  vigentes); aprobar Ana → `approved`; rechazar Pedro con nota →
  `rejected` con la nota guardada; re-aprobar Ana → 409
  `conflict`; borradores insertados solo en la copia: aprobar
  vencido (10 días) → 409 `draft_expired`, aprobar
  desactualizado → 409 `draft_stale`. El gating por rol member
  no se probó en vivo (no hay usuario member sembrado en local):
  se verifica por código (`GET /api/me` + `requireAdmin` en el
  servidor, ya cubierto por la suite existente).
- Marcadores nuevos en el JS construido: "Aprobaciones",
  "Rechazar"; "Solicitar cambios" NO aparece en el bundle (no
  existe ese botón, a propósito).

## Evidencia

- Encabezado con píldora de pendientes reales (`GET /api/drafts`
  + conteo en cliente) y subtítulo de la referencia.
- Body del borrador verbatim en caja; puntaje real (A1) en datos
  contextuales; advertencias reales vencido/desactualizado.
- Diálogo de aprobar SIN campo de nota (el servidor ignora la
  nota al aprobar: poner el campo prometería algo que no se
  guarda); diálogo de rechazar CON nota opcional máx. 1000.

## Decisiones

- Lista de tarjetas en vez de tabla: la referencia muestra
  tarjetas y el contenido (título + agente + cliente + fecha +
  motivo) calza mejor en tarjeta que en fila de tabla.
- Segmentos en vez de selects para Estado/Antigüedad/Prioridad:
  la referencia los muestra como píldoras y el componente
  compartido no los ofrece; se implementó un `Segmented` local
  sin tocar la `FilterBar`.
- Aprobar sin nota / rechazar con nota: dictado por el contrato
  real del servidor (`decideDraft` ignora la nota al aprobar).
- No se deriva "Proceso padre" ni "Razón del activador": el
  borrador no lleva `execution_id` y no existe un campo de razón;
  lo real que ocupa ese lugar son categoría, prioridad y puntaje.

## Riesgos

- Ninguno funcional nuevo. El único residuo visual heredado: los
  subtítulos de encabezado sobre fondo (4,48:1) quedaron
  pendientes, como se pidió para esta tanda.

## Próximo paso

Aprobar subir y mergear R3 (mismo procedimiento que R2; los PNG
no cambiaron, solo verificación de conservación). Verificación
visual en vivo post-merge (no hay render local): contador de
pendientes, segmentos, tarjetas, panel con contenido exacto,
diálogos de aprobar/rechazar con Cancelar (sin decidir nada en
la demo), y aviso para member si corresponde.

## Autorización requerida

Subir y mergear (decisión del usuario; no se hizo en esta fase).

## Mapeo referencia → real (todo lo omitido y el motivo)

| Referencia | Real en R3 | Motivo si se omite |
|---|---|---|
| Título + "3 pendientes" + subtítulo | Sí, con conteo real | — |
| Filtros Tipo de acción (Email/Data/API) | Omitido | Todos los borradores son propuestas de mensaje; no existen tipos |
| Filtros Antigüedad (Today/This week/Older) | Sí, derivados de created_at | — |
| Filtros Prioridad (High/Medium/Low) | Sí, por join con oportunidad | — |
| Buscador + Filtros + Limpiar | Sí (búsqueda + Limpiar; segmentos en vez de "Filtros" genérico) | No hay más dimensiones reales que filtrar |
| Tarjeta: Agente IA (LegalBot, SalesData…) | "Respuesta y propuesta" | El paso `draft` pertenece a ese agente (registry C4); no hay nombres de producto IA |
| Tarjeta: Proceso (Onboarding, Calificación…) | Omitido | El borrador no lleva execution_id ni process_id |
| Tarjeta: Razón del activador (regla #45, score > 90…) | Categoría · Prioridad (+ puntaje en el panel) | No existe un campo de razón; lo real son esos tres datos |
| Panel: Objetivo | Omitido como sección | No existe un objetivo distinto del body del borrador |
| Panel: Contenido exacto del borrador | Sí, body verbatim | — |
| Panel: Datos contextuales (Cliente, Contacto, Email) | Sí, reales | — |
| Panel: Plan Enterprise, ID cliente, Fecha de inicio, Notas | Omitidos | Sin fuente real |
| Panel: badge v1.0.4 | Omitido | No existe versionado de borradores |
| Panel: Riesgos (correo no verificado, términos estándar) | Solo Vencido/Desactualizado reales; si ninguno aplica: "Sin advertencias: el borrador está vigente" | No existe motor de riesgos; inventarlos sería ficticio |
| Botón "Solicitar cambios" | **NO IMPLEMENTADO (omisión prominente)** | No existe ese endpoint ni ese estado. El equivalente real es Rechazar con nota explicando qué cambiar; con un nuevo ingreso se genera un borrador fresco. Implementarlo exigiría endpoint + estado nuevo y una decisión del usuario |
| Botones Rechazar / Aprobar | Sí, reales, solo admin, con confirmación | — |
| Nota "Aprobar no envía ningún mensaje externo" | Sí, en el panel y en el diálogo | Contrato real del sistema |
| Nav de la referencia (Dashboard, AI Agents, Flujos, Informes, Configuración) | No: nav real de 6 secciones | La referencia no define la navegación del producto |
