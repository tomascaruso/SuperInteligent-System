# R3b — Borrador editable + plantilla humanizada + panel de Revisión más ancho — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local.

## Objetivo

El usuario pidió tres cosas sobre Aprobaciones (tras ver R3 en vivo):
que el humano pueda editar el borrador y escribir algo distinto
(porque "Propuesta de siguiente paso: enviar mensaje de
calificación" sonaba poco humano), que el texto sea lo más humano
posible, y que el panel derecho de Revisión sea más ancho para
replicar mejor su imagen de referencia. Diseño aprobado por el
usuario en chat antes de implementar; no se re-litiga acá.

## Acciones

### 1. Backend: PATCH /api/drafts/:id (editar, solo admin)

- Ruta nueva `PATCH /api/drafts/:id` con `requireAdmin` (igual que
  aprobar/rechazar). Body validado con `draftEditSchema` nuevo en
  `domain.ts`: `{ body }` no vacío, **máximo 5000 caracteres**
  (cubre con holgura un mensaje comercial y evita cuerpos
  absurdos; el rechazo sigue con su máximo propio de 1000 para
  la nota).
- Solo si está `pending_approval`: ya decidido → 409 `conflict`
  ("El borrador ya fue decidido"); vencido (>7 días, mismo
  chequeo C5 que al aprobar) → 409 `draft_expired`; mensaje
  cambiado (mismo chequeo C5) → 409 `draft_stale`. Inexistente →
  404. Los mensajes de error dicen "ya no se puede editar"
  (distintos de los de aprobar, que dicen "ya no se puede
  aprobar").
- Al editar: reemplaza `body`, marca `edited = 1` y
  `edited_at = ahora`, y registra `draft.edited` en la auditoría
  con `opportunityId` y el cuerpo anterior (`previousBody`) para
  trazabilidad. La etiqueta "Borrador editado" se agregó al mapa
  de la actividad, así que el evento aparece en la línea de
  tiempo de la oportunidad.
- Editar NO cambia el vencimiento (sigue contando desde
  `created_at`) ni afecta la desactualización (que compara el
  mensaje de la oportunidad con `source_message`, no con `body`):
  solo reemplaza el texto. El borrador sigue pendiente hasta que
  se apruebe o rechace, y aprobar un borrador editado funciona
  igual (verificado en smoke: editado → aprobado, marca
  conservada).
- Migración portable (patrón C4/C5/C6 y A1): `edited INTEGER
  NOT NULL DEFAULT 0` y `edited_at TEXT` en `drafts`, con
  `ensureDraftEditedColumns` en `initSchema` (probar columna,
  ALTER solo si falta; SQLite y Postgres). **Corre sola al
  arrancar: no hay ningún paso manual en Render/Neon.** Las
  filas viejas quedan en 0/NULL (nunca editadas) y no necesitan
  backfill. El DDL base no se tocó, igual que con el puntaje de
  A1. `GET /api/drafts` ya hacía `SELECT d.*`, así que las
  columnas nuevas fluyen solas; la salida se normaliza con
  `draftOut` (0/1 → booleano) en la lista, en la respuesta del
  PATCH y en la de aprobar/rechazar.

### 2. Plantilla humanizada (¡revisar las palabras antes del merge!)

El usuario quiere revisar los textos exactos. Comparación, caso
por caso (los tres `nextAction` reales del clasificador; no se
inventó ninguno nuevo):

**Caso llamada (prioridad alta, ej. Lucía, Empresa Ejemplo):**

Viejo:
> Hola Lucía Fernández,
>
> Gracias por contactarnos de Empresa Ejemplo. Entendemos que
> buscan apoyo en automatización y queremos ayudarlos a avanzar
> sin demoras.
>
> Propuesta de siguiente paso: llamar en menos de 24 h.
>
> Quedamos atentos a tu respuesta para agendar una breve llamada
> y definir el alcance.
>
> Saludos,
> Equipo comercial

Nuevo:
> Hola Lucía Fernández,
>
> Gracias por contactarnos de Empresa Ejemplo. Entendemos que
> buscan apoyo en automatización y queremos ayudarlos a avanzar
> sin demoras.
>
> ¿Te parece si agendamos una breve llamada en las próximas 24
> horas para definir el alcance?
>
> Quedamos atentos a tu respuesta.
>
> Saludos,
> Equipo comercial

**Caso propuesta (prioridad media, ej. Pedro, Negocio SRL):**

Viejo: misma estructura, con "Propuesta de siguiente paso:
enviar propuesta en 48 h."

Nuevo: la línea pasa a ser "En las próximas 48 horas te vamos a
enviar una propuesta para que la revises con calma."

**Caso calificación (prioridad baja, ej. Ana, sin empresa):**

Viejo:
> Hola Ana Ruiz,
>
> Gracias por contactarnos. Entendemos que buscan apoyo en
> general y queremos ayudarlos a avanzar sin demoras.
>
> Propuesta de siguiente paso: enviar mensaje de calificación.
>
> Quedamos atentos a tu respuesta para agendar una breve llamada
> y definir el alcance.

Nuevo:
> Hola Ana Ruiz,
>
> Gracias por contactarnos. Entendemos que buscan apoyo con su
> negocio y queremos ayudarlos a avanzar sin demoras.
>
> Te escribo para conocer un poco mejor lo que necesitan y ver
> cómo podemos ayudarlos.
>
> Quedamos atentos a tu respuesta.

Cambios, en resumen: la línea "Propuesta de siguiente paso: …"
desaparece y cada próximo paso tiene su frase humana; el cierre
pasa de "para agendar una breve llamada y definir el alcance" a
"Quedamos atentos a tu respuesta." (el cierre viejo duplicaba la
llamada en los tres casos); y la categoría "general" ya no dice
"apoyo en general" sino "apoyo con su negocio".

**Alcance del cambio de plantilla:** solo afecta a borradores
NUEVOS. Los borradores ya existentes conservan su texto viejo;
el editor del punto 3 permite corregirlos a mano uno por uno.
Ninguna aserción vieja de tests mencionaba el texto del
borrador (verificado por búsqueda: cero coincidencias), así que
no hubo que actualizar tests existentes por la plantilla.

### 3. Frontend: editar en el panel de Aprobaciones

- Botón "Editar borrador" en el pie del panel (solo admin, solo
  pendiente; en vencidos/desactualizados deshabilitado con el
  mismo motivo que las decisiones, y la nota al pie ahora dice
  "Las decisiones y la edición están deshabilitadas").
- Diálogo con textarea prefillado con el body actual, contador
  "X / 5000 caracteres", Guardar (PATCH) / Cancelar, feedback
  de éxito ("Borrador editado. Sigue pendiente hasta que lo
  apruebes o rechaces.") y de error (el mensaje del servidor:
  409/400/403). Tras guardar, la lista se recarga y la selección
  se mantiene (el borrador sigue pendiente).
- Tras editar, el panel muestra la marca "Editado por un humano"
  (+ fecha si hay `edited_at`) sobre la caja del contenido
  exacto, que sigue mostrando el texto vigente (editado o no).
- En member no se ofrece el botón (el pie solo existe para
  admin) y el servidor además impone 403.

### 4. Panel de Revisión más ancho

- Variante `wide` nueva del `DetailPanel` compartido: panel
  inline de **480 px** (cerca del 40% del contenido, como la
  referencia). La usa SOLO Aprobaciones: su grilla pasó a
  `minmax(0,1fr)_auto` y el panel fija su ancho; la lista de
  tarjetas es flexible y no se rompe.
- **Oportunidades queda en 360 px, sin cambios**: su grilla y su
  uso del panel no se tocaron (verificado: ningún cambio visual
  en esa vista más allá de lo ya aprobado).

## Archivos

- Nuevos: `app/src/r3b.test.ts` (11 tests),
  `docs/R3B-BORRADOR-EDITABLE-REPORTE.md` (este informe).
- Modificados: `app/src/domain.ts` (`draftEditSchema` + plantilla
  humanizada), `app/src/db.ts` (migración `edited`/`edited_at`),
  `app/src/routes.ts` (PATCH + `draftOut` + respuestas),
  `app/client/src/lib/format.ts` (etiqueta `draft.edited`),
  `app/client/src/lib/api.ts` (`DraftFull.edited`/`edited_at`),
  `app/client/src/components/ui/detail-panel.tsx` (prop `wide`),
  `app/client/src/features/aprobaciones/ApprovalsView.tsx`
  (botón, diálogo, marca, grilla ancha).
- Sin cambios en la app vanilla, en tokens globales ni en
  Oportunidades (salvo nada: su panel sigue en 360 px).

## Pruebas

- Suite completa: **150/150 en 10 archivos** (139 previos + 11
  nuevos en `r3b.test.ts`; ningún test existente modificado).
  Los 11 nuevos: editar OK (body + flag + auditoría + sigue
  pendiente), editar decidido → 409, editar vencido → 409
  `draft_expired`, editar desactualizado → 409 `draft_stale`,
  member → 403, body vacío → 400, body >5000 → 400, borrador
  inexistente → 404, plantilla para los 3 nextAction reales, y
  alta nueva con plantilla humanizada.
- Build limpio; `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`) y DB
  real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`).
- Smoke propio en copia de DB (puerto 3467, matado por PID
  exacto, nada en pie al terminar): health OK, login demo OK,
  alta nueva en la copia con plantilla humanizada ("apoyo con su
  negocio" + "En las próximas 48 horas te vamos a enviar una
  propuesta"), PATCH con body + flag + fecha verificados,
  aprobar el borrador editado → `approved` con la marca
  conservada, `draft.edited` presente en `/api/audit`.
- Marcadores nuevos en el JS/CSS construido: "Editar borrador",
  "Editado por un humano", `lg:w-[480px]`; "Solicitar cambios"
  sigue ausente del bundle (no existe esa acción, a propósito).

## Evidencia

- El endpoint responde 200 con `{ draft: { edited: true,
  edited_at } }` y 409/400/403 en cada caso borde (tests + smoke).
- La plantilla nueva se verifica contra el clasificador real
  (los 3 nextAction) y contra un alta real en la copia.
- El panel ancho es solo Aprobaciones: la clase de 480 px está
  en el CSS construido y Oportunidades no la usa.

## Decisiones

- Máximo 5000 para el body editado (vs 1000 de la nota de
  rechazo): un mensaje comercial es más largo que una nota.
- `draft.edited` guarda el cuerpo anterior en `previousBody`:
  la tabla de auditoría ya soporta detalles libres
  (`detail_json`) y la línea de tiempo solo renderiza etiquetas,
  así que no ensucia ninguna vista.
- Editar no reabre ni reinicia nada: el borrador sigue
  pendiente, con su mismo vencimiento y su misma vigencia. Si
  el usuario quiere un borrador fresco tras un rechazo, el
  camino sigue siendo un nuevo ingreso (como en R3).
- La plantilla mapea por `nextAction` exacto con fallback
  genérico: si algún día aparece un cuarto próximo paso, el
  borrador no se rompe (usa "Quedamos atentos a tu respuesta.").
- `draftOut` en el borde: un solo lugar normaliza 0/1 a
  booleano para las tres salidas de borrador.

## Riesgos

- Ninguno funcional nuevo. Residuos que siguen pendientes (no
  eran parte de esta tanda): subtítulos de encabezado sobre
  fondo (4,48:1) y el evento `task.updated` sin vínculo con la
  oportunidad (solo afectaría eventos futuros).

## Próximo paso

Aprobar subir y mergear R3b (mismo procedimiento que R3; los PNG
no cambiaron, solo verificación de conservación). Verificación
visual en vivo post-merge (no hay render local): panel de
Revisión más ancho, diálogo de editar con Cancelar (sin editar
nada en la demo), marca de editado tras editar (solo si el
usuario decide probarlo en la demo; si no, queda para cuando
edite un borrador real), y plantilla nueva en el próximo
borrador que se cree.

## Autorización requerida

Subir y mergear (decisión del usuario; no se hizo en esta fase).
