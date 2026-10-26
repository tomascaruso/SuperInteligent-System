# Fase 3 — Informe (UI/UX System OS v1.1: Oportunidades y tareas)

**Fecha:** 26-oct-2026 (mañana, ART)
**Rama:** `ui-fase1-foundations` (commit local `031cd5a`, sobre `4bdb55f` informe Fase 2)
**Estado de la fase:** PASS
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, sección Fase 3
(Oportunidades y tareas), con criterios UX-002, UX-003 y RWD-001 parcial

## Estado de la fase

- Fase y objetivo: Oportunidades y tareas — lista de oportunidades, formulario
  de creación, estados vacíos y de error, tareas y seguimientos, feedback de
  operaciones y diseño responsive de tablas y listas.
- Estado: PASS.
- Archivos modificados: `app/public/index.html`, `app/public/app.js`,
  `app/public/styles/components.css`, `app/public/styles/layout.css`,
  `app/src/server.test.ts` (203 inserciones, 31 eliminaciones).
- Archivos creados: ninguno. No hizo falta tocar `routes.ts`: no hay archivos
  nuevos que agregar a la lista blanca de estilos.
- Funcionalidades afectadas: ninguna rota. Los endpoints, la autenticación y
  los datos son los mismos; cambia solo la presentación y el feedback de las
  operaciones de oportunidades y tareas.
- Decisiones tomadas: ver abajo.
- Pruebas ejecutadas: typecheck, build, suite completa (26/26) y smoke con
  servidor real, incluyendo dos operaciones reales (crear oportunidad y marcar
  una tarea como hecha).
- Resultados reales: ver abajo.
- Riesgos detectados: verificación visual en navegador real pendiente del
  despliegue aprobado (el navegador en vivo no abre localhost), igual que en
  las Fases 1 y 2.
- Limitaciones pendientes: diálogos de confirmación (Fase 4), estados de
  actividad y ejecuciones (Fase 5), marcas de tiempo de auditoría/ejecuciones
  y auditoría de accesibilidad completa (Fase 6).
- Próximo paso recomendado: decidir si se sube la Fase 3 a la rama remota
  `ui-fase1-foundations` (sin mergear a `main`) o se continúa la Fase 4 en local.

## Resumen de cambios

### Implementado
- `index.html`: zonas de feedback por sección (`#opp-feedback` en la vista de
  oportunidades, `#task-feedback` en la de tareas), con la clase `alert`
  (vacía se oculta sola vía `:empty`, como en la Fase 1). La lista de tareas
  pasa a tener clase `task-list`.
- `app.js`: etiquetas legibles solo de presentación para prioridad
  (`Alta`/`Media`/`Baja`) y estado (`Borrador de propuesta`/`En seguimiento`/
  `Nueva`); los valores sin mapear se muestran tal cual y los colores de los
  badges no cambian. Esto cierra la nota cosmética del post-merge para la
  vista de oportunidades (los estados en inglés crudo); las marcas de tiempo
  de auditoría/ejecuciones quedan para la Fase 5.
- `app.js`: cada celda de la tabla de oportunidades lleva `data-label`
  (Contacto, Empresa, Categoría, Prioridad, Estado), base del responsive.
- `app.js`: estados vacíos diseñados. Sin oportunidades: mensaje con el
  siguiente paso (usar el formulario de alta manual). Sin tareas abiertas:
  mensaje que explica que los seguimientos aparecen cuando llega una
  oportunidad.
- `app.js`: feedback de operaciones. Crear oportunidad informa
  «Oportunidad creada.» y limpia el formulario; marcar una tarea informa
  «Tarea marcada como hecha.». Los errores de cada operación se muestran en
  la zona de su sección (no solo en el error global) y, en el caso de la
  tarea, sin recargar la lista: la tarea sigue abierta y se puede reintentar
  (error recuperable, criterio UX-003).
- `app.js`: estado de envío cableado (`withLoading`): el botón queda
  deshabilitado y con `.is-loading` (definido en la Fase 1 y hasta ahora sin
  cablear) mientras la operación está en curso, lo que evita dobles envíos.
- `components.css`: estilos `.empty-state` y `.task-list` (filas con botón a
  la derecha en escritorio).
- `layout.css`: tablas responsive (≤767 px): el encabezado se oculta y cada
  fila pasa a ser una tarjeta con etiqueta (`attr(data-label)`) y valor; la
  fila de estado vacío queda exenta. En móvil (≤640 px) el botón de cada
  tarea ocupa todo el ancho. Se actualizó el comentario que anunciaba que el
  responsive de tablas llegaba en la Fase 3.
- `server.test.ts`: 4 tests nuevos (zonas de feedback en la raíz; etiquetas,
  `data-label`, `is-loading` y estados vacíos en `app.js`; tabla responsive
  en `layout.css`; estados vacíos y lista de tareas en `components.css`).

### No tocado a propósito (alcance de otras fases)
- Aprobar/rechazar borradores (Fase 4) y reintentos de ejecuciones (Fase 5):
  sus handlers quedan como estaban, sin feedback por sección ni loading.
- Marcas de tiempo de auditoría y ejecuciones (formato ISO con `T`): quedan
  para la Fase 5.
- Botones de acceso/registro: sin loading (fuera del alcance de esta fase).

## Decisiones

- Las etiquetas legibles son solo de presentación: no cambian el valor que
  guarda ni devuelve el servidor, así que no alteran el significado técnico
  de los estados.
- El feedback de sección no lo borra `refresh()`: describe la última
  operación de esa sección y sobrevive a la recarga de datos que sigue a una
  operación exitosa. Solo la siguiente operación de la sección lo reemplaza.
- El error global `#error` sigue existiendo para acceso y errores de carga
  general; los errores de operación de oportunidades y tareas van a su zona.
- No se inventó ningún estado: los vacíos y los errores usan solo datos y
  respuestas reales del servidor.

## Evidencia

- Typecheck (`tsc --noEmit`) limpio y build (`tsc`) limpio.
- Suite: 26/26 tests en verde (22 previos + 4 nuevos de la Fase 3).
- Smoke con servidor real en puerto 3213, contra una COPIA de la base local
  en /tmp (la base local no se tocó; servidor apagado y temporales eliminados
  al final):
  - `/health` ok; la raíz sirve `opp-feedback` y `task-feedback`;
  - `/app.js` sirve «Borrador de propuesta»; `/styles/layout.css` sirve
    `attr(data-label)`;
  - login demo ok; crear oportunidad por API ok (oportunidades 3 → 4, la
    nueva presente en la lista);
  - tareas abiertas 4 → 3 tras marcar una como hecha por API (el alta genera
    su seguimiento, por eso el conteo inicial era 4 y no 3).
- NO verificado: renderizado visual en navegador real (misma limitación que
  en las Fases 1 y 2: el navegador en vivo no abre localhost). Queda pendiente
  del próximo despliegue aprobado.

## Criterios (sección 11 de la especificación)

- UX-002 (flujos críticos preservados): PASS — crear oportunidad y completar
  tarea verificados con servidor real; suite en verde.
- UX-003 (errores recuperables): PASS — el error de marcar tarea se muestra
  en su sección sin perder la tarea; el error de crear oportunidad se muestra
  en su sección sin perder el formulario.
- RWD-001 (layout adaptable): PASS parcial — tablas y listas responsive
  implementadas y servidas; la prueba en varios viewports reales queda para
  la Fase 6.
- DS-003 (estados de componentes definidos): PASS parcial — loading, vacío,
  éxito y error definidos para oportunidades y tareas; faltan los de
  aprobaciones y actividad (Fases 4 y 5).
- QA-002 (sin acciones falsas): PASS — el feedback solo se muestra tras la
  respuesta real del servidor; sin refresh en el camino de error de tareas.
