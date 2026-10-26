# Fase 5 — Informe (UI/UX System OS v1.1: Actividad y ejecuciones)

**Fecha:** 26-oct-2026 (mañana, ART)
**Rama:** `ui-fase1-foundations` (commit local `85dbfca`, sobre `a911318` informe Fase 4)
**Estado de la fase:** PASS
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, sección Fase 5
(Actividad y ejecuciones) y 4.5, con criterio QA-002 y UX-003

## Estado de la fase

- Fase y objetivo: Actividad y ejecuciones — estado de ejecución, historial
  de actividad, detalle de pasos cuando exista, errores comprensibles,
  reintentos autorizados y estados vacíos y de carga.
- Estado: PASS.
- Archivos modificados: `app/public/index.html`, `app/public/app.js`,
  `app/src/server.test.ts` (149 inserciones, 31 eliminaciones).
- Archivos creados: ninguno. No hizo falta tocar `routes.ts` ni los estilos:
  no hay archivos nuevos, cambios de API ni componentes visuales nuevos.
- Funcionalidades afectadas: ninguna rota. Los endpoints, la autenticación y
  los datos son los mismos; cambia solo la presentación y el flujo de
  reintento de la vista de actividad.
- Decisiones tomadas: ver abajo.
- Pruebas ejecutadas: typecheck, build, suite completa (31/31) y smoke con
  servidor real, incluyendo el reintento rechazado por el servidor (409).
- Resultados reales: ver abajo.
- Riesgos detectados: verificación visual en navegador real pendiente del
  despliegue aprobado (el navegador en vivo no abre localhost), igual que en
  las fases anteriores.
- Limitaciones pendientes: auditoría de accesibilidad completa y pruebas en
  varios viewports reales (Fase 6); el detalle de pasos no existe en el
  backend (ver abajo).
- Próximo paso recomendado: decidir si se sube la Fase 5 a la rama remota
  `ui-fase1-foundations` (sin mergear a `main`) o se continúa la Fase 6 en local.

## Resumen de cambios

### Implementado
- `index.html`: zona de feedback por sección (`#activity-feedback` en la
  tarjeta de ejecuciones) y estados de carga iniciales («Cargando
  actividad…», «Cargando ejecuciones…») que la primera carga reemplaza por
  datos o por el estado vacío.
- `app.js`: etiquetas legibles solo de presentación para ejecuciones
  («Completada»/«Fallida» con badge de color; los estados reales son solo
  `done` y `failed`, así que no se muestran pendiente, en ejecución ni
  reintentando) y para auditoría (11 acciones reales mapeadas, p. ej.
  «Inicio de sesión», «Oportunidad creada», «Borrador aprobado»,
  «Ejecución reintentada»; entidades «usuario», «oportunidad», «tarea»,
  «borrador», «ejecución», «organización»). Los códigos sin mapear se
  muestran tal cual.
- `app.js`: fechas y horas con espacio en vez de `T` (reutiliza el
  `formatDateTime` de la Fase 4), en auditoría y en ejecuciones. Esto cierra
  la nota cosmética del post-merge para la vista de actividad.
- `app.js`: detalle real por ejecución: workflow y versión, identificador
  corto (8 caracteres, con el completo en el título), inicio y fin cuando
  difieren, resultado (oportunidad creada, extraída de `result_json`) o
  error cuando la ejecución falló. Sin pasos en el backend: no se inventan
  pasos ni se muestra un detalle de pasos ficticio.
- `app.js`: detalle legible por evento de auditoría, solo con datos reales:
  si el detalle cita una oportunidad, se resuelve a su contacto y empresa;
  si trae categoría o prioridad, se muestran con etiquetas. El resto del
  detalle no se renderiza.
- `app.js`: reintento con confirmación (reutiliza el diálogo de la Fase 4):
  el diálogo dice qué ejecución se repetirá y que el resultado puede
  depender del estado actual del sistema; el botón de confirmación queda
  deshabilitado con `.is-loading` durante la operación (sin dobles envíos).
  El botón Reintentar sigue apareciendo solo en ejecuciones fallidas, como
  exige el servidor. Tras la respuesta, feedback en la sección y recarga:
  éxito («Ejecución reintentada. Se creó una nueva ejecución; revisá la
  lista.») o error sin éxito falso.
- `app.js`: estados vacíos diseñados («Sin registros de actividad
  todavía.», «Sin ejecuciones todavía.») en auditoría, actividad reciente y
  ejecuciones.
- `server.test.ts`: 2 tests nuevos (zona de feedback y estados de carga en
  la raíz; etiquetas y confirmación de reintento en `app.js`).

### No mostrado a propósito (sin soporte real)
- Pasos de ejecución: no existe tabla ni campo de pasos en el backend; el
  detalle que se muestra es el real (workflow, versión, id, inicio/fin,
  resultado o error).
- Estados pendiente, en ejecución y reintentando: no existen en el backend
  (los estados reales son `done` y `failed`).
- Reintento en ejecuciones no fallidas: el servidor lo rechaza con 409; la
  interfaz no ofrece el botón en esos casos.

## Decisiones

- Las etiquetas son solo de presentación y mapean 1:1 los códigos reales;
  cualquier código futuro sin mapear se muestra tal cual, no se oculta.
- El `result_json` completo no se vuelca en la interfaz: solo se extrae la
  oportunidad creada, que es el dato comprensible para el usuario.
- El `detail_json` de auditoría no se vuelca crudo: solo se resuelven la
  oportunidad citada y la categoría/prioridad, que son los datos legibles.
- El feedback de reintento va a `#activity-feedback` (no a
  `#draft-feedback`): el handler de confirmación del diálogo elige la zona
  según la acción.
- No se cambió ningún contrato de API ni se agregó ningún endpoint: la
  autorización del reintento la impone el servidor (cualquier miembro
  autenticado de la organización puede reintentar; solo fallidas).

## Evidencia

- Typecheck (`tsc --noEmit`) limpio y build (`tsc`) limpio.
- Suite: 31/31 tests en verde (29 previos + 2 nuevos de la Fase 5).
- Smoke con servidor real en puerto 3215, contra una COPIA de la base local
  en /tmp (la base local no se tocó; servidor apagado y temporales eliminados
  al final):
  - `/health` ok; la raíz sirve `activity-feedback`, «Cargando actividad» y
    «Cargando ejecuciones»; `/app.js` sirve «Completada» y «Reintentar
    ejecución»;
  - login demo ok; auditoría con 12 eventos (acciones reales del seed y de
    logins); ejecuciones 3, todas `done` y todas con `result_json`;
  - reintentar una ejecución completada → 409 «Solo se pueden reintentar
    ejecuciones fallidas» (autorización del servidor verificada; la
    interfaz no ofrece ese botón en ese caso).
- NO verificado: renderizado visual en navegador real (misma limitación que
  en las fases anteriores: el navegador en vivo no abre localhost). Queda
  pendiente del próximo despliegue aprobado.

## Criterios (sección 11 de la especificación)

- QA-002 (sin acciones falsas): PASS — ningún éxito aparece antes de la
  respuesta real; el reintento informa su error sin declarar éxito.
- UX-003 (errores recuperables): PASS — el 409 del reintento se informa en
  la sección y la recarga muestra el estado real.
- UX-002 (flujos críticos preservados): PASS — auditoría y ejecuciones se
  siguen sirviendo del mismo contrato; suite en verde.
- Salida de la fase (la información mostrada coincide con la del servidor):
  PASS — etiquetas 1:1, detalle extraído de los campos reales, sin pasos ni
  estados inventados.
