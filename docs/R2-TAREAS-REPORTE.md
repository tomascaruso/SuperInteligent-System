# R2 — Tareas y seguimientos (vista real en React)

## Estado general
COMPLETO EN LOCAL, sin merge ni despliegue. La ruta `/tareas` deja de
ser el aviso de migración de la Fase 3 y pasa a ser la vista real con
datos de `GET /api/tasks` + `GET /api/opportunities`. Aprobaciones,
Actividad y Agentes siguen siendo aviso de migración (no se tocaron).

## Objetivo
Reproducir el diseño de la referencia de Tareas entregada por el
usuario el 27-oct-2026 (imagen `61f05789…bebbe.jpg`) con datos reales
exclusivamente, siguiendo el patrón de Oportunidades (R1) y aplicando
ui-taste operate/craft + el subconjunto válido de
vercel-react-best-practices para Vite + Fastify.

## Acciones
- Nueva vista `app/client/src/features/tareas/TasksView.tsx` y ruta
  real en `App.tsx` (`/tareas` → `TasksView`).
- Nuevo helper de API `updateTask(id, 'open' | 'done')` en
  `lib/api.ts` (el contrato `PATCH /api/tasks/:id` ya existía; no
  hubo cambios de servidor).
- Componente `Tabs`: variante con scroll ahora usa la clase
  `scrollbar-none` (barra oculta, desplazamiento intacto) y la
  pestaña enfocada con teclado entra a la vista con `scrollIntoView`
  (`block/inline: nearest`, sin animación).
- Nueva clase `.scrollbar-none` en `client/src/index.css`
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- `DetailPanel`: subtítulo en `text-secondary` en ambas variantes
  (antes `text-muted` 2,56:1; mejora compartida que también beneficia
  al panel de Oportunidades, en la línea de A1 P1-3).
- Tarjetas de resumen clicables: fijan el filtro de Estado
  correspondiente (comportamiento real, sin navegación inventada).

## Archivos
- `app/client/src/features/tareas/TasksView.tsx` (nuevo)
- `app/client/src/App.tsx` (ruta `/tareas`)
- `app/client/src/lib/api.ts` (`updateTask`)
- `app/client/src/components/ui/tabs.tsx` (`scrollbar-none` + foco)
- `app/client/src/index.css` (clase `.scrollbar-none`)
- `app/client/src/components/ui/detail-panel.tsx` (subtítulo secondary)

## Mapeo referencia → real (todo lo omitido y el motivo)

| Referencia | Real en R2 | Motivo de lo omitido |
|---|---|---|
| Título + subtítulo | "Tareas y seguimientos" + "Controla las próximas acciones y los compromisos pendientes" (textual) | — |
| Tarjetas Pendientes / Vencidas / En curso / Completadas + % | Solo 3 tarjetas con conteos disjuntos: Pendientes (abiertas no vencidas), Vencidas (abiertas con `due_at` anterior a hoy, fecha local), Completadas (`done`) | "En curso" no existe como estado (solo `open`/`done`); no hay serie temporal para los % |
| Menú Procesos / Clientes / Informes / Configuración / Ayuda | No se reproduce | La navegación real sigue siendo la de 6 secciones |
| Tabla: Título / Proceso relacionado / Cliente / Responsable / Prioridad / Fecha límite / Status | Tarea / Oportunidad / Cliente / Agente / Prioridad / Vencimiento / Estado | "Proceso relacionado" no existe como entidad: la oportunidad es el vínculo real. "Responsable" real = agente Seguimiento (`agent_name` o `assigned_to`); las personas de la imagen son demostrativas |
| Prioridad por tarea | Prioridad de la oportunidad por join en cliente (como Oportunidades hace con tareas/borradores) | La tarea no tiene columna de prioridad |
| Filtros Estado / Prioridad / Responsable / Fecha / "Más filtros" / "Limpiar" / buscador | Buscador (título/contacto/empresa) + Estado (Todos/Pendientes/Vencidas/Completadas) + Agente (valores reales) + Prioridad + Limpiar, en una sola fila (patrón R1d) | Sin filtro por fecha separada (el orden por vencimiento ya pone las vencidas primero); "Más filtros" no aporta nada real |
| Panel: objetivo | Título de la tarea + contexto (oportunidad, cliente, agente, vencimiento, prioridad, categoría, creada, actualizada) | La tarea no tiene descripción propia; el mensaje de la oportunidad se muestra etiquetado como tal |
| Panel: contexto del proceso padre (breadcrumb) | Omitido | No existe proceso padre con nombre ni breadcrumb; el único proceso es la captación |
| Panel: historial de cambios | Pestaña Actividad con la línea de tiempo de la oportunidad (`GET /api/audit?opportunityId=`): incluye creación de la tarea, del borrador y eventos de la oportunidad | El evento de completar (`task.updated`) no cita a la oportunidad en el servidor, así que no aparece en esa línea de tiempo; la fecha de actualización sí se muestra en Resumen. Cambiar el detalle de auditoría del servidor quedó fuera de esta tanda (ver Riesgos) |
| Panel: entregable esperado, evidencias/archivos | Omitidos | No existen entregables ni archivos por tarea |
| Panel: recomendación del siguiente paso (IA) | Omitida | No hay recomendación IA (F2-AI DISCARD: las reglas siguen, sin IA) |
| Acciones: Completar / Reasignar / Añadir comentario / Cancelar / Crear tarea | Solo "Completar tarea" real (`PATCH /api/tasks/:id` con `{ status: "done" }`), con diálogo de confirmación y feedback de éxito/error | No existe `POST /api/tasks` (las tareas solo las crea el intake), ni reasignar, ni comentarios, ni cancelar. En tareas completadas no se ofrece acción (la vista no ofrece reabrir, aunque el servidor lo admite) |
| Orden | Vencimiento ascendente (lo da el servidor) | — |

## Pruebas
- Suite completa: **139/139 en 9 archivos** (sin cambios de
  servidor, no hizo falta test nuevo; ningún test existente
  modificado).
- Build limpio (Vite 333,67 KB JS, gzip 102,30 KB).
- `node --check public/app.js` OK; MD5 de vanilla intacto
  (`44ef9ae6daf62c3b9c335f6f2501256a`); MD5 de la DB real local
  intacto (`af175edc7673befe9b9f3ace3c556c12`).
- Smoke propio en copia de DB (puerto 3463, matado por PID exacto,
  ningún proceso en pie al terminar): health OK, login demo OK,
  `GET /api/tasks` con 3 tareas abiertas (vencimientos 27/10, 28/10,
  29/10), `PATCH` de una tarea a `done` verificado y conteo de
  completadas = 1 en la copia.
- Grep en el JS/CSS construido: `scrollbar-none`,
  "Completar tarea", "Tareas y seguimientos" presentes; assets del
  logo de A1 sin cambios.

## Evidencia
- La vista no se pudo verificar visualmente en local (no hay
  Chromium/Playwright en la VM): la verificación visual queda para
  el post-merge en la demo pública, como en todas las fases R/H.
- Contrastes: subtextos de fila en tinta cuando está seleccionada
  (11,94:1, lección A1) y `group-hover:text-ink` en hover, lo que
  cierra el residuo de hover 4,26:1 **dentro de esta vista** (en
  Oportunidades el hover sigue en 4,26:1; no se tocó esa vista).
  Secundario sobre fondo blanco 4,76:1; subtítulos del panel ya no
  usan muted.

## Decisiones
- Filtro de Estado con valores disjuntos (Pendientes/Vencidas/
  Completadas) en vez de "Abiertas", para que las 3 tarjetas y el
  filtro coincidan exactamente.
- Confirmación con diálogo antes de completar: en esta vista no se
  ofrece reabrir, así que un toque accidental no tiene vuelta atrás
  desde la UI; el diálogo lo previene (patrón de decisión de R3, sin
  trampa de foco adicional: usa el `Dialog` existente).
- Actividad = línea de tiempo de la oportunidad, etiquetada como
  tal, no "historial de la tarea": es lo que la auditoría expone
  realmente.
- Los subtítulos de encabezado sobre fondo (4,48:1) NO se tocaron,
  como pidió la tanda: quedan pendientes.

## Riesgos
- `task.updated` no cita a la oportunidad: la finalización de una
  tarea no aparece en la línea de tiempo de su oportunidad. Si se
  quiere completa, hay que agregar `opportunityId` al detalle de
  auditoría en `PATCH /api/tasks/:id` (cambio de servidor con test;
  solo afectaría a eventos futuros).
- La barra de pestañas oculta depende de `scrollbar-width` y del
  pseudo-elemento webkit: en navegadores viejos podría verse la
  barra. La verificación en vivo post-merge debe confirmarlo en la
  pantalla del usuario (donde se vio la barra originalmente).
- Las tareas de la demo pública (Laura, Fernando) no existen en la
  DB local: el smoke local solo cubre las 3 del seed.

## Próximo paso
- Aprobación del usuario para subir y mergear R2 (rama
  `ui-fase1-foundations`, mismo procedimiento que A1: snapshot de
  texto; los PNG no cambiaron en esta tanda, así que no hace falta
  subida por web salvo verificación).
- Verificación en vivo post-merge: tarjetas con conteos reales,
  filtros, completar una tarea de prueba o solo lectura, pestañas
  sin barra visible, panel y contraste de fila seleccionada.

## Autorización requerida
- Subir y mergear R2 (decisión del usuario).
