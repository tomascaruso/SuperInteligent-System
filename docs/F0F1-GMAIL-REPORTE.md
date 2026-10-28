# F0 base + F1 Gmail — Informe de fase

## Estado general

**PASS (local, sin merge ni despliegue).** F0 base y F1 Gmail del diseño
(`docs/DISENO-ENVIO-GMAIL-WHATSAPP.md`) están implementados en local,
con suite completa en verde, build limpio, typecheck del cliente
limpio, vanilla intacta y base real local sin tocar. No se hizo
ningún envío real: todos los envíos de pruebas y smoke usan un
proveedor simulado. El merge NO está autorizado todavía: este
informe es la entrega para verificación independiente y oferta de
merge aparte.

## Objetivo

Que, tras aprobar un borrador, el agente «Respuesta y propuesta»
pueda enviar el mensaje por el canal que el admin elige al aprobar
(decisión de Tomás, 28-oct-2026: variante explícita, no automática),
empezando por Gmail. WhatsApp todavía no envía: en F1 elegirlo da
409 `channel_unavailable`, como pide el diseño.

## Acciones

### F0 base

- `contact_phone` nullable en `opportunities`, vía migración portable
  (`ensureOpportunityPhoneColumn`: prueba la columna y hace ALTER
  solo si falta; corre sola al arrancar, sin paso manual en
  Render/Neon). Llega a alta manual, webhook y jobs por el esquema
  compartido (`opportunityInputSchema`).
- Normalización mínima: se quitan espacios, guiones y paréntesis;
  se exige `+` opcional + 7–15 dígitos (mensaje de error propio);
  máx. 30 caracteres. Sin backfill ni números inventados.
- La clave de dedup (`email|empresa|nombre`) NO cambió: el mismo
  contacto con otro teléfono sigue dando `duplicate: true` con el
  mismo id (cubierto por test).
- Tabla `message_deliveries` con `UNIQUE(draft_id)` y estados
  `pending/sent/failed`, más `attempts`, `provider_message_id`,
  `error_code`, `error`.
- Máscara de Actividad extendida: `lib/mask.ts` (extraído de
  `ActivityView.tsx` sin cambiar su comportamiento) agrega
  `maskPhone` (código de país y últimos 4 visibles, resto `*`) y
  las claves `contactPhone` y `recipient` (correo → regla de correo,
  teléfono → regla de teléfono). Sin esto, el destinatario de un
  envío se filtraría en el bloque técnico plegado: era el punto de
  verificación obligatorio del diseño.
- Vistas de trabajo: Oportunidades muestra «Teléfono» en el detalle
  y campo opcional en el alta; Aprobaciones muestra «Teléfono» en
  Datos contextuales. En ambos, `—` si falta.

### F1 Gmail

- Tabla `org_connections` (org, proveedor, estado real, `display_account`
  no secreto, credenciales cifradas, `UNIQUE(org_id, provider)`).
- Cifrado AES-256-GCM (`sending.ts`, sin dependencias nuevas):
  clave derivada con SHA-256 de la frase del operador; formato
  `v1:iv:tag:data` en hex. Sin `CONNECTION_ENCRYPTION_KEY`, el
  módulo queda cerrado (fail-closed): aprobar con canal deja la
  entrega en `failed` con `connection_error` y 0 llamadas al
  proveedor (cubierto por test).
- OAuth de Google por organización, alcance mínimo solo
  `gmail.send` (`access_type=offline`, `prompt=consent`); state
  anti-CSRF sin estado en servidor (HMAC-SHA256 con JWT_SECRET,
  10 min). Sin credenciales de Google configuradas, el inicio
  responde 503 `not_configured`, no un flujo fingido.
- Flujo de aprobar reescrito (`decideDraft`): si hay canal, ANTES
  de decidir se verifica pausa de `response_proposal` (409
  `agent_paused`, sin decidir ni guardar), WhatsApp (409
  `channel_unavailable`), y Gmail sin conexión `connected` (409
  `channel_unavailable`). Solo después se decide (mismas reglas de
  siempre: 404/409 conflict/vencido/desactualizado) y, si aprobó
  con canal, se crea la entrega `pending` ANTES de llamar al
  proveedor y se intenta el envío sincrónico (sin worker en plan
  gratis). La respuesta de aprobar es `{draft, delivery}`
  (`delivery` null sin canal; el rechazo no crea entrega).
- Envío a cargo del agente `Respuesta y propuesta` con paso nuevo
  `send` (el catálogo pasa de 6 a 7 pasos; su descripción se
  sincroniza en cada arranque). Asunto `Respuesta de {nombre de la
  organización}`; cuerpo = borrador aprobado vigente, incluido si
  fue editado por admin bajo R3b (máx. 5000). Timeout 15 s.
- Auditoría: eventos `message.sent` / `message.failed`
  (`entity='delivery'`, actor `agent:response_proposal`, detalle
  `{channel, draftId, opportunityId, providerMessageId, recipient}`
  + `errorCode` en fallo). La línea de tiempo por `opportunityId`
  los muestra. «Comunicada» NO es un estado de oportunidad: solo
  una entrega `sent` permite mostrar «Enviado por {canal}»; si
  falló, la oportunidad sigue en `in_follow_up` y la UI muestra
  «Envío fallido» con motivo y reintento.
- Reintento: `POST /api/deliveries/:id/retry`, solo admin, solo
  sobre `failed`, con políticas nuevas `send.retry.admin_only=true`
  y `send.retry.max_attempts=3` (el intento inicial cuenta como
  attempts 1). Nunca reenvía una `sent`. También verifica pausa
  del agente y conexión vigente antes de reintentar.
- Catálogo de Integraciones: Gmail sigue `coming_soon` en el
  catálogo estático, pero la vista muestra su estado REAL de
  `GET /api/connections`: sin conexión sigue próximamente; con
  conexión verificada muestra «Disponible» con la cuenta
  conectada (nunca «Conectado» inventado); con error, el error.
  Botón «Conectar con Google» (solo admin) y «Desconectar» (solo
  admin). WhatsApp entra como entrada nueva `coming_soon` en
  Comunicación (icono genérico Lucide, sin logos de marcas).
- Comentario viejo de `decideDraft` («Sin aprobación no hay acción
  externa… El envío real es Fase 3») reemplazado por la regla F1,
  y `docs/SECURITY.md` actualizado: «Envíos externos solo tras
  aprobación humana y por canales conectados (F1, decisión
  28-oct-2026)… Nunca hay envíos autónomos sin aprobación previa.»
- `render.yaml`: agregadas como texto sin valores, todas
  `sync: false`: `CONNECTION_ENCRYPTION_KEY`,
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REDIRECT_URI`.

## Archivos

Servidor (nuevos): `app/src/sending.ts` (proveedor Gmail real por
API REST con fetch de Node 24, cifrado, OAuth state, errores
tipados), `app/src/f0f1.test.ts` (15 tests).

Servidor (modificados): `app/src/db.ts` (teléfono, `org_connections`,
`message_deliveries`, 2 políticas nuevas, paso `send` en
`response_proposal`), `app/src/domain.ts` (`contactPhone` en el
esquema y la normalización; `OpportunityInput` pasó de `z.infer` a
`z.input` porque los campos con default son opcionales al construir
el objeto), `app/src/engine.ts` (INSERT con teléfono; camino
duplicado sin tocar el teléfono), `app/src/routes.ts`
(`decideDraft` con canal, `attemptDelivery`, `GET /api/connections`,
OAuth start/callback de Gmail, verify, disconnect, retry de entrega,
`delivery` en `GET /api/drafts`), `app/src/config.ts`,
`app/src/server.ts`, `app/src/index.ts` (pasan clave y OAuth),
`app/src/server.test.ts` y `app/src/postgres.test.ts` (conteos
actualizados por el cambio legítimo: 4→6 políticas, 6→7 pasos).

Cliente: `app/client/src/lib/mask.ts` (nuevo) y
`app/client/src/lib/mask.test.ts` (nuevo),
`app/client/src/lib/api.ts` (`contact_phone`, `contactPhone`,
tipos `Connection`/`Delivery`, `getConnections`, `retryDelivery`),
`app/client/src/lib/format.ts` (etiquetas `message.sent`,
`message.failed`, entidad `delivery`),
`app/client/src/features/actividad/ActivityView.tsx` (importa la
máscara; sin cambios de comportamiento),
`app/client/src/features/oportunidades/OpportunitiesView.tsx`
(detalle y alta con teléfono),
`app/client/src/features/aprobaciones/ApprovalsView.tsx` (selector
de canal en el diálogo de aprobar, preselección de Gmail si está
conectada, feedback según la entrega, bloque de envío con
reintento, teléfono en contexto, textos viejos actualizados),
`app/client/src/features/integraciones/IntegrationsView.tsx`
(entrada WhatsApp, estado real de Gmail, conectar/desconectar).

Documentos: `docs/SECURITY.md`, `render.yaml`, este informe.

## Pruebas

- Suite completa: **177/177** (13 archivos). Antes de F0F1 era
  158/158; los 19 nuevos son 15 de `f0f1.test.ts` + 4 de
  `mask.test.ts`. Los tests F0F1 cubren: teléfono (normalización,
  inválido 400, sin teléfono null, dedup sin cambios), aprobar con
  Gmail conectado (entrega `sent` + `providerMessageId` + evento
  `message.sent` + segundo aprobar 409 con una sola llamada),
  aprobar sin canal (sin envío, comportamiento actual), Gmail sin
  conexión y conexión en `error` (409 sin decidir), WhatsApp
  (409 sin decidir), agente pausado (409 sin decidir ni entrega),
  sin clave de cifrado (entrega `failed` `connection_error`, 0
  llamadas), fallo del proveedor (entrega `failed` +
  `message.failed`, oportunidad en `in_follow_up` sin
  `message.sent`, entrega visible en `GET /api/drafts`),
  reintento (member 403, admin tras arreglar el proveedor `sent`,
  enviada 409 `conflict`, tope con max 2 → tercer intento 409
  `retry_limit`), conexiones sin secretos, OAuth sin configurar
  503.
- Correcciones durante la verificación (para no repetir): el
  orden de creación de tablas importa en Postgres — las tablas
  nuevas se movieron DESPUÉS de `drafts` en el SCHEMA (SQLite
  toleraba la referencia hacia adelante, pg-mem no); en el test
  de «sin clave», pasar `undefined` explícito disparaba el default
  de JS y la clave terminaba siendo la de prueba (se usa `null`
  como centinela de «sin clave»).
- Build limpio (`npm run build`, cliente incluido); typecheck del
  cliente limpio (`tsc -p client/tsconfig.json --noEmit`);
  `node --check public/app.js` OK; MD5 de vanilla
  `44ef9ae6daf62c3b9c335f6f2501256a` sin cambios; MD5 de la DB
  real local `af175edc7673befe9b9f3ace3c556c12` sin cambios.
- Smoke propio en COPIA de la DB real (`/tmp/smoke-f0f1.db`,
  puerto 34591, proveedor simulado, sin envíos reales): health OK,
  login demo OK (Martín Demo, admin), alta con teléfono
  `+54 9 11 1234-5678` → normalizado `+5491112345678`, borrador
  creado, aprobar con Gmail → entrega `sent` con
  `provider_message_id` y 1 sola llamada, `GET /api/connections`
  sin secretos, línea de tiempo con `message.sent` primero.
  Ningún proceso quedó en pie y la DB real no cambió.
- NO verificado (queda para post-merge, como siempre): la
  verificación visual en vivo, porque en esta VM no hay
  Chromium/Playwright. Los diálogos nuevos (selector de canal,
  conectar/desconectar Gmail) y el detalle de envío solo se
  probaron por tests y smoke, no con capturas.

## Evidencia

- Suite: 177/177, 13 archivos, 0 fallos.
- Build: `✓ built in 4.38s`; cliente: `index-B9NOVyLI.js`.
- Smoke: `SMOKE OK` (ver salida completa en el reporte de la
  tarea; la copia de la DB quedó en `/tmp`, efímera).
- Vanilla: `app/public/app.js` = `44ef9ae6daf62c3b9c335f6f2501256a`.
- DB real: `app/data/superinteligent.db` =
  `af175edc7673befe9b9f3ace3c556c12`.

## Decisiones

- Canal explícito al aprobar, como decidió Tomás el 28-oct-2026
  (no automático). Canal omitido/null = no se envía, igual que
  antes: aprobar sin conexiones sigue funcionando exactamente
  igual.
- Envío a cargo de «Respuesta y propuesta» con paso `send` (ya es
  dueño del texto); `Seguimiento` quedó descartado porque es dueño
  de la acción, no del mensaje.
- Comunicación pasa de 4 a 5 tarjetas y el total del catálogo de
  20 a 21, rompiendo la regla R5d de 4 por categoría: el diseño y
  la tarea piden la entrada nueva de WhatsApp y no hay otra
  categoría honesta para ella. Queda registrado aquí como
  desviación explícita, no como descuido.
- Gmail en el catálogo estático sigue `coming_soon`: su
  «Disponible» solo aparece cuando `GET /api/connections`
  devuelve una fila `connected` real. Sin eso, no hay estado
  inventado.
- La relay de Apps Script del contacto NO cuenta como integración
  de cliente y no cambió.

## Riesgos

- Verificación de app de Google (alcance `gmail.send` sensible) y
  verificación de Meta para WhatsApp: son trámites del operador,
  fuera del código.
- En plan gratis de Render no hay worker: el envío corre
  sincrónico dentro de aprobar y la respuesta tarda más; un corte
  no pierde la entrega (se crea antes de llamar al proveedor) y
  el reintento la recupera.
- Si se pierde `CONNECTION_ENCRYPTION_KEY`, se pierde el acceso a
  las credenciales guardadas: hay que comunicarlo al operador
  antes de cargar la primera conexión.
- Token revocado: la conexión queda en `error` con
  `connection_error`; la UI pide reconectar y nunca reintenta en
  bucle.
- Sin cuentas de prueba decididas por Tomás, no hay envío real
  posible ni siquiera en la demo: todo lo verificado hasta ahora
  es simulado.

## Próximo paso

Verificación independiente del padre y, si la aprueba, oferta de
merge a Tomás (autorización expresa aparte; el merge NO está
autorizado todavía). Tras el merge: verificación en vivo solo
lectura + prueba visual de los diálogos nuevos. Después, F2
WhatsApp (alta de conexión Business por el operador, verificación
real, control de ventana de 24 h).

## Autorización requerida

- Merge a `main` y despliegue en Render (NO autorizado en esta
  tarea; requiere aprobación expresa de Tomás).
- Cuentas de prueba para el primer envío real de Gmail (decisión
  pendiente de Tomás desde el diseño; sin ella, ningún envío
  real).
- Cargar en Render, como texto sin valores y `sync: false`:
  `CONNECTION_ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
  (ya están en `render.yaml`; los valores los carga Tomás, nunca
  en el chat ni en el repo).
