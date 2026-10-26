# Fase 4 — Informe (UI/UX System OS v1.1: Centro de aprobaciones)

**Fecha:** 26-oct-2026 (mañana, ART)
**Rama:** `ui-fase1-foundations` (commit local `b7528cf`, sobre `d0e8c75` informe Fase 3)
**Estado de la fase:** PASS
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, sección Fase 4
(Centro de aprobaciones), 4.4 y 5.7, con criterios IA-001, IA-002 y UX-003

## Estado de la fase

- Fase y objetivo: Centro de aprobaciones — panel de revisión, contexto del
  borrador, contenido íntegro, confirmación de acciones, estados pendientes,
  aprobados, rechazados y fallidos según soporte real, y tratamiento de
  conflictos y estados obsoletos.
- Estado: PASS.
- Archivos modificados: `app/public/index.html`, `app/public/app.js`,
  `app/public/styles/components.css`, `app/src/server.test.ts`
  (211 inserciones, 4 eliminaciones).
- Archivos creados: ninguno. No hizo falta tocar `routes.ts`: no hay archivos
  nuevos ni cambios de API; todo el trabajo usa el contrato ya existente.
- Funcionalidades afectadas: ninguna rota. Los endpoints, la autenticación y
  los datos son los mismos; cambia solo la presentación y el flujo de
  decisión de la vista de aprobaciones.
- Decisiones tomadas: ver abajo.
- Pruebas ejecutadas: typecheck, build, suite completa (29/29) y smoke con
  servidor real, incluyendo aprobar, reintentar aprobar (conflicto 409) y
  rechazar con motivo.
- Resultados reales: ver abajo.
- Riesgos detectados: verificación visual en navegador real pendiente del
  despliegue aprobado (el navegador en vivo no abre localhost), igual que en
  las fases anteriores.
- Limitaciones pendientes: estados de actividad y ejecuciones (Fase 5),
  auditoría de accesibilidad completa y pruebas en varios viewports reales
  (Fase 6).
- Próximo paso recomendado: decidir si se sube la Fase 4 a la rama remota
  `ui-fase1-foundations` (sin mergear a `main`) o se continúa la Fase 5 en local.

## Resumen de cambios

### Implementado
- `index.html`: zona de feedback por sección (`#draft-feedback`, mismo
  patrón de la Fase 3), nueva tarjeta «Borradores decididos» (`#decided`) y
  esqueleto estático del diálogo de confirmación (`#dialog-overlay`,
  `role="dialog"`, `aria-modal`, título `#dialog-title`, texto
  `#dialog-text`, motivo opcional `#dialog-reason` y botones Confirmar /
  Cancelar).
- `app.js`: panel de revisión por borrador pendiente con etiqueta
  «Pendiente de aprobación», oportunidad relacionada (contacto y empresa del
  join de `/api/drafts`, más categoría de la lista ya cargada), canal
  «No disponible» (no existe ese campo en el backend), alcance real de la
  decisión («actualiza el estado de la oportunidad y registra la decisión en
  la auditoría. No envía ningún mensaje.») y contenido íntegro del borrador.
- `app.js`: diálogo de confirmación (5.7) sin genéricos: el título y el texto
  dicen qué acción, sobre qué oportunidad y qué ocurrirá después, incluyendo
  qué no ocurrirá («No se enviará ningún mensaje.»). Aprobar usa botón
  primario; rechazar, botón de peligro y campo opcional de motivo (el
  backend lo acepta opcional, máximo 1000 caracteres; vacío se guarda nulo).
  Esto reemplaza la nota fija «Rechazado desde la demo» que se enviaba antes.
- `app.js`: comportamiento del diálogo: foco inicial en Cancelar, cierre con
  Escape y con clic en el fondo, trampa de foco con Tab dentro del diálogo y
  restauración del foco al botón que lo abrió. Durante la operación, el botón
  de confirmación queda deshabilitado con `.is-loading` (no hay dobles envíos).
- `app.js`: feedback por sección y estados obsoletos. Tras decidir, el
  mensaje describe el efecto real («Borrador aprobado. La oportunidad pasó a
  seguimiento; no se envió ningún mensaje.» / «Borrador rechazado. La
  oportunidad volvió a nueva.»). Si el servidor responde conflicto (409, «El
  borrador ya fue decidido»), se cierra el diálogo, se informa el error en la
  sección y se recarga para mostrar el estado real: la validación definitiva
  es del backend.
- `app.js`: lista de borradores decididos (aprobados y rechazados, del mismo
  `GET /api/drafts`): etiqueta de decisión, oportunidad relacionada, quién
  decidió y cuándo (fecha y hora con espacio, solo presentación), motivo si
  lo hay, y contenido íntegro. Estado vacío: «Aún no hay borradores
  decididos.»
- `app.js`: roles sin cambios: solo admin ve Aprobar/Rechazar (el servidor ya
  lo exigía); los demás ven la nota explicativa y el panel completo.
- `components.css`: estilos del diálogo (superposición fija con fondo
  oscuro, tarjeta centrada de 520 px máximo).
- `server.test.ts`: 3 tests nuevos (panel y diálogo en la raíz; estados,
  contexto y confirmación con efecto real en `app.js`; estilos del diálogo
  en `components.css`).

### No mostrado a propósito (sin soporte real)
- «Solicitar revisión» o «solicitar cambios»: no existe endpoint; no se
  muestra la acción.
- Estado «fallido» para borradores: el backend solo tiene pendiente,
  aprobado y rechazado. Los fallos existen en ejecuciones, que son Fase 5.
- Tipo de acción propuesta más allá de «borrador de propuesta» y canal: no
  existen esos campos en el backend; el canal se muestra «No disponible» en
  vez de inventarse uno.

## Decisiones

- El diálogo es propio (no `confirm()` del navegador) para cumplir 5.7:
  título descriptivo, efecto real, acciones diferenciadas y gestión de foco.
- El motivo de rechazo es opcional, como lo define el esquema del backend;
  no se exige un texto para poder rechazar.
- El feedback de sección no lo borra `refresh()`, igual que en la Fase 3:
  describe la última decisión y sobrevive a la recarga posterior.
- No se cambió ningún contrato de API ni se agregó ningún endpoint: la
  verificación del contrato (IA-002) se hizo leyendo `routes.ts` y el
  smoke confirma que aprobar mueve la oportunidad a seguimiento, rechazar la
  devuelve a nueva, y decidir dos veces da 409.

## Evidencia

- Typecheck (`tsc --noEmit`) limpio y build (`tsc`) limpio.
- Suite: 29/29 tests en verde (26 previos + 3 nuevos de la Fase 4).
- Smoke con servidor real en puerto 3214, contra una COPIA de la base local
  en /tmp (la base local no se tocó; servidor apagado y temporales eliminados
  al final):
  - `/health` ok; la raíz sirve `draft-feedback`, «Borradores decididos» y
    `dialog-overlay`; `/app.js` sirve «Pendiente de aprobación»;
    `components.css` sirve `.dialog-overlay`;
  - login demo ok; `GET /api/drafts` devuelve 3 pendientes, todos con
    contacto y empresa del join;
  - aprobar un borrador → estado `approved` y su oportunidad en
    `in_follow_up`;
  - aprobar el mismo borrador otra vez → 409 «El borrador ya fue decidido»;
  - rechazar otro con motivo → estado `rejected` con la nota guardada;
  - estado final: 1 pendiente, 2 decididos.
- NO verificado: renderizado visual en navegador real y navegación por
  teclado con lector (misma limitación que en las fases anteriores: el
  navegador en vivo no abre localhost). Queda pendiente del próximo
  despliegue aprobado.

## Criterios (sección 11 de la especificación)

- IA-001 (borradores y acciones diferenciados): PASS — panel con contexto,
  contenido íntegro y acciones solo para admin; decididos separados de
  pendientes.
- IA-002 (aprobación asociada a una acción concreta): PASS — el diálogo
  nombra la oportunidad y el efecto exacto; el smoke confirma la transición
  de la oportunidad y la auditoría del backend.
- UX-002 (flujos críticos preservados): PASS — aprobar y rechazar
  verificados con servidor real; suite en verde.
- UX-003 (errores recuperables): PASS — el 409 se informa en la sección y
  la recarga muestra el estado real; ningún error deja un éxito falso.
- QA-002 (sin acciones falsas): PASS — ningún mensaje de éxito aparece
  antes de la respuesta real del servidor; la aprobación nunca se presenta
  como envío de mensaje.
