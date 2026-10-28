# Informe de fase — Fase A: webhook de WhatsApp (respuestas entrantes)

## Estado general

Estado: PASS (implementación local completa y verificada; merge
pendiente de autorización expresa de Tomás, como siempre).

## Objetivo

Implementar SOLO la Fase A del diseño de respuestas entrantes
(docs/DISENO-RESPUESTAS-ENTRANTES-PLANTILLAS.md, §2, §4, §5 y §6
Fase A): recibir respuestas de WhatsApp por webhook de Meta,
guardarlas, asociarlas a la oportunidad por teléfono, derivar la
ventana de 24 h y mostrarlas, sin responder automáticamente y sin
cambiar ningún comportamiento existente. No se implementaron la
Fase B (Gmail) ni la Fase C (plantillas).

## Acciones

- Servidor (`app/src/`):
  - `db.ts`: tabla nueva `inbound_messages` (CREATE TABLE IF NOT
    EXISTS en `initSchema`, así cubre bases nuevas y existentes)
    con `UNIQUE (org_id, provider_message_id)` para el dedup.
  - `config.ts` / `server.ts` / `index.ts`: secretos nuevos de
    nivel aplicación de Meta, `META_APP_SECRET` y
    `META_WEBHOOK_VERIFY_TOKEN`, leídos de entorno y pasados como
    `opts.metaWebhook`. Sin ellos, el endpoint responde cerrado.
  - `routes.ts`: `GET /api/webhooks/whatsapp` (verificación
    estándar de Meta: responde el `challenge` solo si
    `hub.mode=subscribe` y el token coincide; si no, 403) y
    `POST /api/webhooks/whatsapp` (público por necesidad, sin JWT;
    firma `X-Hub-Signature-256` verificada con la misma función
    `verifySignature` que la ingesta, otra clave; firma inválida,
    ausente o secreto sin configurar → 200 vacío sin guardar
    nada; todo evento procesado responde 200 vacío). Procesa
    solo `field=messages`, solo mensajes `type=text`, ignora
    no-texto y recibos de estado (`statuses`). Enrutado por
    `metadata.phone_number_id` buscado en `org_connections`
    (proveedor `whatsapp`, credenciales descifradas para comparar
    el id; sin clave de cifrado no se puede enrutar y se
    descarta). Dedup por `wamid` por org (reintento → 200 sin
    segundo registro ni segundo evento). Asociación por teléfono
    normalizado con la misma regla que `contactPhone`; si hay
    varias oportunidades, gana la de envío de WhatsApp más
    reciente y, sin envíos, la creada más recientemente; sin
    coincidencia, se guarda con `opportunity_id` NULL, no crea
    nada ni dispara nada. Cada mensaje guardado emite
    `message.received` en `audit_log` (actor `webhook:whatsapp`,
    detalle con `channel`, `opportunityId`, `providerMessageId`,
    `recipient` y `message`: las dos últimas claves ya las
    enmascara `mask.ts` en Actividad). Endpoints con JWT nuevos:
    `GET /api/opportunities/:id/responses` (cuerpo completo, solo
    la org dueña), `GET /api/inbound-messages/unmatched`
    (revisión manual) y `GET /api/opportunities/:id/whatsapp-window`
    (ventana derivada: último entrante de ese contacto en 24 h;
    solo sugerencia, nunca bloquea un envío).
  - `render.yaml`: `META_APP_SECRET` y
    `META_WEBHOOK_VERIFY_TOKEN` con `sync: false` (mismo patrón
    que `CONNECTION_ENCRYPTION_KEY`). Nunca van en el repo.
- Cliente (`app/client/src/`):
  - `lib/api.ts`: tipo `InboundMessage` y funciones
    `getOpportunityResponses`, `getUnmatchedInbound`,
    `getWhatsappWindow`.
  - `lib/format.ts`: etiqueta `message.received` → «Respuesta
    recibida».
  - `features/oportunidades/OpportunitiesView.tsx`: pestaña
    nueva «Respuestas» en el detalle (texto completo, como el
    resto del detalle) y sección «Respuestas sin coincidencia»
    debajo de la grilla (lista enmascarada con `maskPhone` /
    `maskMessage`; texto completo solo al expandir un ítem).
  - `features/aprobaciones/ApprovalsView.tsx`: al abrir el
    diálogo de aprobar con WhatsApp conectado, muestra «Ventana
    abierta» si el contacto respondió en las últimas 24 h. Si la
    consulta falla, no se muestra nada: la sugerencia es
    opcional y nunca bloquea.
- Docs: `docs/SECURITY.md` (fila nueva para el webhook de
  WhatsApp) y este reporte. No se tocó el documento de diseño.
- Sin cambios en: clasificación, dedup, tareas, vencimiento,
  estados de oportunidad, catálogo (ninguna capacidad nueva se
  marca real: recibir no es una capacidad listada) ni app
  vanilla.

## Archivos

- `app/src/db.ts`, `app/src/config.ts`, `app/src/server.ts`,
  `app/src/index.ts`, `app/src/routes.ts`
- `app/client/src/lib/api.ts`, `app/client/src/lib/format.ts`,
  `app/client/src/features/oportunidades/OpportunitiesView.tsx`,
  `app/client/src/features/aprobaciones/ApprovalsView.tsx`
- `app/src/fase-a.test.ts` (nuevo)
- `render.yaml`, `docs/SECURITY.md`,
  `docs/FASE-A-WEBHOOK-REPORTE.md` (nuevo)

## Pruebas

- Suite: 191/191 antes → 206/206 después (15 tests nuevos en
  `app/src/fase-a.test.ts`): verificación GET ok / token
  incorrecto / sin secretos (403), POST sin secretos (200 sin
  guardar), POST válido (registro + evento + coincidencia +
  presencia en la línea de tiempo de la oportunidad), dedup ante
  reintento (un registro, un evento), firma inválida y ausente
  (200 sin guardar), org desconocida (200 sin guardar),
  asociación con varias oportunidades (gana el envío de WhatsApp
  más reciente; sin envíos, la creada más recientemente), sin
  coincidencia (guardado con NULL, sin crear nada, visible en
  revisión), no-texto y recibos ignorados, sin cambio de estado
  de oportunidad ni de entregas, respuestas con cuerpo completo
  para la org dueña y 404 para otra org, ventana derivada
  (abierta tras respuesta reciente, cerrada sin teléfono o sin
  respuestas), y evento con claves `recipient`/`message` para la
  máscara de Actividad.
- Build limpio y typecheck del cliente limpio. Marcadores Fase A
  presentes en el JS construido («Respuestas sin coincidencia»,
  «Ventana abierta», «Sin respuestas recibidas»).
- Vanilla intacta: `app/public/app.js` MD5
  `44ef9ae6daf62c3b9c335f6f2501256a` antes y después. DB real
  local intacta: MD5 `af175edc7673befe9b9f3ace3c556c12` antes y
  después. Sin procesos `node` residuales.
- Smoke propio en copia (`/tmp/fase-a-smoke.db`, puerto 34595,
  copia borrada tras el smoke): health, login demo, alta con
  teléfono, registro de conexión (409 esperado: el token simulado
  no verifica contra Meta real, pero la fila queda guardada y el
  enrutado funciona), GET de verificación (challenge con token
  correcto, 403 con token incorrecto), POST firmado válido →
  respuesta guardada + evento `message.received`, reintento del
  mismo `wamid` sin duplicado, firma inválida sin guardar,
  teléfono sin coincidencia en revisión, y ventana derivada
  (cerrada con un mensaje de hace un año — el `received_at` es
  el timestamp de Meta, no la hora de llegada — y abierta con un
  mensaje de timestamp actual).

## Evidencia

- `npm test`: 15 archivos, 206/206.
- `npm run build` limpio; `npx tsc -p client/tsconfig.json
  --noEmit` limpio.
- MD5 de vanilla y de DB real idénticos antes y después (ver
  arriba). Smoke: todos los pasos con los resultados indicados.

## Decisiones

- Enrutado por `phone_number_id` descifrando las credenciales de
  cada conexión WhatsApp (sin columna nueva): si falta la clave
  de cifrado, el webhook no puede enrutar y descarta (fail-closed
  coherente con F1/F2). No se agregó columna porque el id no es
  secreto pero duplicarlo sería otra fuente de verdad.
- `received_at` es el timestamp de Meta, no la hora de proceso:
  por eso un mensaje viejo no abre la ventana aunque llegue hoy.
  Es el comportamiento correcto (la ventana la define Meta desde
  el último mensaje del usuario).
- Cuerpo malformado o contenido no-JSON: lo rechaza el parser
  compartido (400/415), no el webhook; Meta siempre envía JSON
  válido, así que no afecta al flujo real. Documentado en el
  comentario de la ruta.
- Lista de sin coincidencia enmascarada por defecto con
  expansión explícita al texto completo: equilibra la regla de
  privacidad del diseño («completo solo en el detalle») con que
  la revisión manual sea útil sin oportunidad asociada.
- El catálogo no cambia: recibir no es una capacidad listada hoy
  y no se inventa ninguna. La regla del diseño («real solo con
  verificación que responda») queda como seguimiento para
  cuando se liste la recepción.
- Actor de auditoría `webhook:whatsapp` (distinto de `webhook`
  de ingesta y de `agent:response_proposal` de envío).

## Riesgos

- Meta reintentando por lentitud en plan gratis (sueño de
  Render): el dedup cubre los reintentos; si la latencia real
  fuera un problema, el paso siguiente sería guardar-y-responder
  y procesar después (el diseño ya lo prevé).
- Token de verificación o secreto de app mal cargados en
  Render: el endpoint queda cerrado y Meta no puede verificar;
  el síntoma es visible en la configuración de la app de Meta,
  no en SIS.
- Primer webhook real pendiente de: cuenta de WhatsApp Business
  de prueba, suscripción del webhook en la app de Meta y carga
  de `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` en Render
  (además de la `CONNECTION_ENCRYPTION_KEY` ya pendiente).

## Próximo paso / Autorización requerida

Revisión de Tomás y, con su autorización expresa, snapshot push
+ PR + merge y verificación en vivo solo lectura. La verificación
en vivo de esta fase tiene un límite honesto: sin webhook real
suscrito en Meta no se puede observar un mensaje entrante real
en la demo; lo verificable en vivo es la UI nueva (pestaña
«Respuestas», sección de sin coincidencia y el indicio de
ventana, que sin respuestas se limita a no mostrarse) y que los
indicadores no cambian.

## Preguntas abiertas

- Ninguna nueva de implementación. Sigue abierta la del diseño:
  el nudo window_closed + `UNIQUE(draft_id)` de F2 y la
  notificación al equipo ante una respuesta (esta fase: ninguna,
  por diseño).

## Corrección de verificación (Loki, 28-oct-2026, antes del merge)

La verificación independiente encontró un error real en la asociación: los tests usaban `from` con `+` (`+54 9 11 1234-5678`), pero Meta envía `from` solo con dígitos (`5491112345678`). Como `normalizePhone` solo quitaba espacios, guiones y paréntesis, un mensaje real nunca hubiera igualado al contacto guardado (`+5491112345678`) y todas las respuestas reales habrían caído en «sin coincidencia».

Corrección aplicada en `app/src/routes.ts`: `normalizePhone` ahora normaliza a E.164 (quita espacios/guiones/paréntesis y asegura el `+` inicial). No cambia el formato guardado del contacto ni el envío; solo la comparación. Test nuevo en `app/src/fase-a.test.ts` («POST con formato real de Meta (from sin +) asocia igual a la oportunidad»). Suite tras la corrección: 207/207.

Nota aparte, sin cambio de código por falta de evidencia contra Meta real: el envío de F2 pasa `to` con el teléfono guardado (con `+`); si la API de Meta exigiera el número sin `+`, el primer envío real lo revelaría de inmediato. Queda como punto a confirmar en esa prueba, no como error declarado.
