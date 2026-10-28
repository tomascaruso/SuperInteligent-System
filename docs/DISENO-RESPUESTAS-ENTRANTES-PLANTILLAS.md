# Diseño — Respuestas entrantes + plantillas de WhatsApp

> Documento de diseño. No es código, no cambia ningún comportamiento.
> Solo en local: sin push, PR, merge ni despliegue. La implementación
> requiere aprobación expresa aparte, como toda fase de SIS.

## Estado general

**Objetivo:** que SIS registre lo que el interesado responde por Gmail
o por WhatsApp, lo asocie con su oportunidad y lo muestre donde el
equipo ya trabaja (detalle de la oportunidad y Actividad), y que el
equipo pueda reanudar una conversación de WhatsApp fuera de la ventana
de 24 horas con una plantilla aprobada por Meta.

**Lo que NO es este diseño:** no es un buzón dentro de SIS, no es un
chat en vivo y no es respuesta automática. Las respuestas se
REGISTRAN y las lee una persona; ningún agente contesta solo. Eso es
una regla dura, no un detalle (ver §5).

**Estado:** DISEÑO (sin implementar). Lo que sigue distingue en cada
punto qué existe hoy de qué se propone. Donde algo no está verificado
contra la API real, se marca «a confirmar en implementación» en lugar
de afirmarlo.

## Base verificada hoy (releída, no supuesta)

- `docs/DISENO-ENVIO-GMAIL-WHATSAPP.md` (diseño F0/F1/F2) y su
  implementación ya mergeada (PR #68 F0+F1, PR #69 F2; suite
  191/191):
  - `org_connections` por org (`provider` `'gmail'` o `'whatsapp'`,
    `status` `'connected'`/`'error'`/`'revoked'`,
    `display_account`, `credentials_ciphertext` cifrado AES-256-GCM
    con `CONNECTION_ENCRYPTION_KEY`, `last_verified_at`,
    `last_error`, `UNIQUE (org_id, provider)`). Ningún endpoint
    devuelve secretos.
  - `message_deliveries` con `UNIQUE (draft_id)`: un borrador, una
    entrega. Campos: `channel`, `status` (`pending`/`sent`/
    `failed`), `attempts`, `provider_message_id`, `error_code`,
    `error`. **No guarda `thread_id`**: el envío de Gmail descarta
    ese dato (ver §1).
  - `app/src/sending.ts`: `MailProvider` (send + verificación de
    perfil, alcance solo `gmail.send`, remitente `"me"`),
    `WhatsAppProvider` (verify + send de texto libre por la Graph
    API, versión en constante `WHATSAPP_GRAPH_API_VERSION`),
    errores `connection_error` / `provider_error` / `timeout` /
    `not_supported` / `window_closed` (error 131047 de Meta).
    Timeout de proveedor: 15 s.
  - Aprobar con canal explícito (decisión de Tomás 28-oct-2026, ya
    cerrada: el admin elige el canal al aprobar; omitido o `null`
    = no se envía nada). Pre-chequeo de pausa `409 agent_paused`
    antes de decidir. Reintento de entregas: solo admin, solo
    `failed`, tope `send.retry.max_attempts=3`, nunca reenvía una
    `sent`.
  - Eventos de auditoría `message.sent` / `message.failed` con
    actor `agent:response_proposal`, `entity='delivery'` y
    `opportunityId` en el detalle. Máscara en Actividad por clave
    (`contactEmail`, `contactName`, `company`, `message`,
    `contactPhone`, `recipient`).
- `app/src/routes.ts`: ingesta por webhook HMAC (`POST
  /api/ingest/:orgId`, firma `x-signature`, idempotencia por clave
  o hash del cuerpo) — el patrón de webhook firmado ya existe y se
  reutiliza en concepto para Meta (ver §2). Rutas de conexiones
  (`GET /api/connections`, OAuth Gmail, `POST
  /api/connections/whatsapp`, `/verify`, `/disconnect`), reintento
  (`POST /api/deliveries/:id/retry`) y aprobar/rechazar
  (`POST /api/drafts/:id/approve|reject`, solo admin).
- `app/src/domain.ts`: esquema compartido de alta (`contactName`,
  `contactEmail`, `company`, `message`, `contactPhone` opcional
  normalizado a `+` opcional + 7 a 15 dígitos). Dedup por
  `email|empresa|nombre`: **el teléfono no entra en dedup** y eso
  no cambia en esta fase.
- `app/src/worker.ts` y `render.yaml`: el worker existe (`--once` y
  bucle) pero `render.yaml` solo define el servicio web en plan
  gratis. **En Render gratis no hay worker**: todo lo de esta fase
  debe funcionar sin él, igual que el envío (ver §4).
- Catálogo en `app/client/src/features/integraciones/
  IntegrationsView.tsx` (releído): Gmail hoy dice solo «Enviar el
  borrador aprobado por Gmail cuando el admin elige ese canal» y
  WhatsApp solo «Enviar mensajes por WhatsApp Business desde SIS» y
  «Enviar el borrador aprobado por el canal elegido». **La
  capacidad «Registrar respuestas en la oportunidad», que el diseño
  anterior citaba como prevista, hoy NO está en el catálogo
  implementado**: F1/F2 la dejaron fuera al reescribir las
  capacidades a solo envío. Este diseño la reintroduce como
  prevista (no como real) y documenta la diferencia: no se finge
  que existió nunca.
- `docs/SECURITY.md` vigente: aprobar con canal elegido (F1 Gmail,
  F2 WhatsApp); WhatsApp solo texto libre dentro de la ventana de
  24 horas; fuera de ella `window_closed` sin reintento por otro
  canal; sin canal elegido no se envía nada; nunca envíos autónomos
  sin aprobación humana.

## 1. Respuestas de Gmail: leer solo los hilos que SIS envió

**El problema de base:** el alcance actual es solo `gmail.send`
(`buildGoogleAuthUrl` en `sending.ts`). Con ese alcance SIS puede
enviar, pero NO puede leer nada del buzón. Leer respuestas exige un
alcance nuevo y un consentimiento nuevo (ver §1.3).

### 1.1 Qué falta hoy para asociar una respuesta

El envío de Gmail devuelve identificador de mensaje y de hilo, pero
el código actual solo guarda el primero (`provider_message_id` en
`message_deliveries`). Falta:

- Nueva columna nullable en `message_deliveries`: `thread_id TEXT`.
  Desde esta fase, el envío guarda los dos identificadores. Las
  entregas viejas quedan con `thread_id` nulo: sus respuestas no se
  pueden asociar por hilo (ver excepción abajo).
- Nueva tabla propuesta, `inbound_messages` (migración portable,
  mismo patrón que `org_connections`):

| Campo | Contenido |
|---|---|
| `id`, `org_id` | Vínculos. |
| `opportunity_id` | Oportunidad asociada, o nulo si no hubo coincidencia (ver §1.4). |
| `delivery_id` | Entrega de SIS que originó el hilo, o nulo. |
| `channel` | `'gmail'` o `'whatsapp'`. |
| `provider_message_id` | Id del mensaje entrante en el proveedor. **Único por org**: es la clave de dedup de eventos reenviados. |
| `sender` | Remitente (correo o teléfono normalizado). Se enmascara en Actividad como `recipient`. |
| `body` | Cuerpo del mensaje entrante, tope propuesto 5000 caracteres (igual que el máximo del mensaje de alta). Sin adjuntos en esta fase. |
| `received_at`, `created_at` | Cuándo llegó al proveedor y cuándo lo registró SIS. |

- Evento de auditoría nuevo, `message.received`: mismo
  `audit_log` de siempre, actor `webhook` (el actor que ya usa la
  ingesta para lo que llega de afuera), `entity='inbound_message'`,
  detalle `{ channel, opportunityId, deliveryId,
  providerMessageId }`. El cuerpo NO va en el detalle de auditoría:
  va en `inbound_messages.body` y se muestra en el detalle de la
  oportunidad; en el bloque técnico de Actividad se enmascara con
  la regla vigente de `maskMessage`.

### 1.2 Vías comparadas (con honestidad)

| Vía | Cómo funciona | Costo / dependencia real | Veredicto |
|---|---|---|---|
| **A. Sondeo bajo demanda** | Al abrir la oportunidad (o con un botón «Buscar respuestas»), SIS consulta a Gmail solo los hilos de las entregas `sent` de esa oportunidad (`threads.get` por `thread_id` conocido) y registra los mensajes nuevos. | Requiere el alcance de lectura (ver §1.3) y nada más: sin worker, sin cron, sin infraestructura nueva. Contra: las respuestas no aparecen solas; el equipo tiene que ir a buscarlas. | **Recomendada para empezar.** Es la única que funciona en plan gratis sin piezas nuevas. |
| **B. Sondeo programado** | Un proceso periódico recorre las entregas `sent` y hace lo mismo que A sin intervención. | En plan gratis no hay worker: dependería de un cron externo (por ejemplo GitHub Actions o cron-job.org) que llame a un endpoint protegido con token de operador, o del plan Starter de Render. Más piezas, mismo alcance que A. | Posterior, cuando exista worker o se acepte el cron externo. No se promete en esta fase. |
| **C. Notificaciones push (Gmail watch + Pub/Sub)** | Gmail avisa en tiempo real a un tema de Pub/Sub cuando cambia un buzón; SIS recibe y consulta el hilo. | Exige proyecto de Google Cloud con Pub/Sub, tema y suscripción, verificación del endpoint público, renovación periódica del watch (expira) y el mismo alcance de lectura que A. Mucha infraestructura para el volumen de SIS (pocas conversaciones por org). | **Descartada para esta fase.** Se documenta para no re-discutirla sin motivo; solo se reconsidera si el volumen lo exige. |

**Regla dura de alcance de lectura:** SIS consulta únicamente los
hilos de sus propias entregas (`thread_id` conocido). NO se lee todo
el buzón, NO se listan mensajes arbitrarios y NO se buscan correos
por palabras. Excepción única, para entregas viejas sin `thread_id`:
una consulta acotada por remitente (`from:` el correo del contacto)
para intentar asociar, y solo sobre esas entregas; a partir de esta
fase el `thread_id` se guarda siempre y la excepción deja de hacer
falta.

### 1.3 Nuevo alcance y re-consentimiento (consecuencia real)

- Alcance nuevo propuesto: `gmail.readonly`
  (`https://www.googleapis.com/auth/gmail.readonly`, solo lectura).
  El alcance de envío (`gmail.send`) se mantiene: son dos permisos
  distintos y el consentimiento debe pedir los dos juntos.
- Consecuencia que no se puede esconder: **las conexiones Gmail ya
  existentes quedan con envío solamente**. Su refresh token no tiene
  el alcance de lectura, así que la capacidad de lectura no se
  activa sola: la org debe reconectar (nuevo consentimiento) para
  habilitarla. La UI debe mostrarlo así, por separado: «Envío:
  conectado» y «Lectura: pendiente de reconexión» hasta el primer
  hilo leído con éxito; un `403` del proveedor al intentar leer se
  traduce a ese estado, no a un error genérico.
- La verificación de la app de Google con alcance de lectura es un
  trámite externo con tiempo propio (el diseño anterior ya lo
  advertía para `gmail.send`): esta fase no promete fechas de
  Google ni de Meta.

### 1.4 Asociación y casos sin coincidencia

- Por hilo (caso normal): `thread_id` → entrega → `opportunity_id`.
  Una respuesta en el hilo de una entrega de SIS pertenece a esa
  oportunidad, sin ambigüedad.
- Por remitente (excepción de entregas viejas, ver §1.2): correo
  del remitente = `contactEmail` de una oportunidad de la org con
  una entrega `sent` por Gmail; si hay varias, la de envío más
  reciente.
- Sin coincidencia: el mensaje se guarda igual en
  `inbound_messages` con `opportunity_id` nulo y aparece en una
  lista de «sin coincidencia» para revisión manual. **Nunca crea
  una oportunidad nueva, nunca cambia el estado de ninguna
  oportunidad, nunca completa una tarea y nunca dispara un envío.**
  El enlace manual de un mensaje sin coincidencia queda como
  decisión pendiente (ver Decisiones), no se implementa en esta
  fase.

### 1.5 Dónde se muestra

- Detalle de la oportunidad (vista Oportunidades): sección nueva
  «Respuestas» con la lista cronológica (fecha, canal, remitente y
  cuerpo completo; acá los datos se ven completos, como ya ocurre
  con los datos de contacto en esa vista).
- Actividad: eventos `message.received` con remitente y cuerpo
  enmascarados en el bloque técnico (misma regla que hoy: correo
  con primera letra + `***@dominio`, cuerpo con primeros 15
  caracteres).
- Aprobaciones no cambia: una respuesta no reabre ni modifica un
  borrador ya decidido. Si el equipo quiere contestar, lo hace
  desde el seguimiento normal (o con una plantilla, ver §3), nunca
  como respuesta automática del sistema.

## 2. Respuestas de WhatsApp: webhook de Meta

**Por qué el webhook es la vía (y no el sondeo):** WhatsApp no tiene
un «buzón» que SIS pueda consultar por hilo como Gmail. El canal
natural es el webhook que Meta ya prevé para la cuenta Business: el
número que envía también recibe, y Meta empuja cada mensaje
entrante a una URL de SIS. No hay alternativa equivalente por
sondeo; inventarla sería fingir una API que no existe.

### 2.1 Verificación y firma (seguridad del endpoint público)

- El endpoint es público por necesidad (Meta no inicia sesión en
  SIS), así que su única protección es criptográfica, no JWT:
  - Verificación inicial estándar de Meta: `GET` con
    `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`;
    SIS responde el `challenge` solo si el token coincide con el
    del operador.
  - Cada `POST` trae `X-Hub-Signature-256`: HMAC-SHA256 del cuerpo
    crudo con el secreto de la app de Meta. Firma inválida o
    ausente → se descarta sin guardar nada. El patrón HMAC ya
    existe en el código (`verifySignature` en `routes.ts`, hoy
    para la ingesta): se reutiliza la idea, no la clave.
  - **Los dos secretos son de nivel aplicación de Meta, no por
    org**: variables nuevas de operador en `render.yaml` con
    `sync: false` (mismo patrón que `CONNECTION_ENCRYPTION_KEY`):
    `META_APP_SECRET` y `META_WEBHOOK_VERIFY_TOKEN`. Nunca van en
    el repo, nunca se devuelven por endpoints y nunca se registran
    en logs. Que el webhook sea de app no rompe la regla «las
    credenciales son por org»: lo que es por org sigue siendo el
    número y el token de envío en `org_connections`; lo de app es
    solo la verificación del canal.
- Respuesta siempre `200` con cuerpo vacío ante eventos válidos,
  inválidos o desconocidos (sin reflejar el payload y sin filtrar
  por la respuesta si algo falló): Meta reintenta lo que no recibe
  como `200`, y el dedup (ver §2.2) hace que los reintentos sean
  seguros.

### 2.2 Dedup, enrutado y asociación

- Dedup: cada mensaje de Meta trae un id (`wamid`). Se guarda en
  `inbound_messages.provider_message_id` con unicidad por org:
  un reintento de Meta con el mismo id se responde `200` sin crear
  un segundo registro ni un segundo evento de auditoría.
- Enrutado por org: el payload trae el número Business receptor
  (`metadata.phone_number_id`). SIS busca esa `phone_number_id`
  en `org_connections` (proveedor `whatsapp`). Si no corresponde a
  ninguna org, se responde `200` y no se guarda nada: un webhook
  de otra cuenta no puede sembrar datos en una org.
- Asociación por remitente: el teléfono del remitente se normaliza
  con la misma regla que `contactPhone` (sin espacios, guiones ni
  paréntesis) y se busca entre las oportunidades de esa org con
  ese `contact_phone`. Si hay varias, la de envío de WhatsApp más
  reciente; si no hay ninguna, mensaje sin coincidencia (misma
  regla que §1.4: se guarda, se muestra para revisión manual, no
  crea nada ni dispara nada).
- Solo texto en esta fase: imágenes, audios, videos, documentos y
  stickers se responden `200` y no se guardan (quedan registrados
  como tipo no soportado solo si la implementación lo considera
  trivial; si no, se ignoran y se documenta). Los recibos de
  estado (enviado/entregado/leído) no se usan en esta fase: no
  cambian el estado de ninguna entrega.
- Trabajo por evento: dos inserciones (`inbound_messages` +
  `audit_log`), sin llamadas a terceros. Por eso el procesamiento
  sincrónico dentro del webhook es aceptable en plan gratis. Si en
  la práctica Meta reintentara por lentitud, el paso siguiente
  sería guardar-y-responder y procesar después (a confirmar en
  implementación según la latencia observada); el dedup ya cubre
  ese cambio sin rediseño.

### 2.3 El efecto clave sobre F2: un mensaje entrante ABRE la ventana

Este es el cambio de comportamiento más importante de toda la
fase, y hay que decirlo con precisión:

- Cada mensaje entrante del interesado **abre (o reabre) la
  ventana de 24 horas** de WhatsApp desde su marca de tiempo. Eso
  significa que un envío de texto libre que antes habría fallado
  como `window_closed` pasa a ser aceptado por Meta si hubo una
  respuesta reciente.
- Cómo lo sabe SIS: la ventana se **deriva** de
  `inbound_messages` (último mensaje entrante de ese contacto en
  las últimas 24 horas), no se guarda como columna separada: una
  sola fuente de verdad, sin riesgo de que un campo quede
  desincronizado. La UI puede mostrar «ventana abierta» como
  sugerencia al elegir canal.
- **Pero Meta sigue siendo la autoridad, no SIS**: la ventana
  derivada es solo una pista para el admin. SIS nunca debe
  negarse a intentar un envío porque su propio cálculo diga que
  la ventana está cerrada (el cálculo podría estar desfasado y
  Meta podría aceptarlo igual). El flujo de envío no cambia: se
  intenta y Meta responde; `131047` sigue mapeándose a
  `window_closed` exactamente como en F2. Lo que cambia es que,
  con respuestas registradas, el `window_closed` será mucho menos
  frecuente y el admin verá por qué.
- Una respuesta entrante NO cambia el estado de la oportunidad, NO
  marca ninguna entrega como leída ni respondida y NO reabre un
  borrador: solo alimenta la conversación y la ventana.

## 3. Plantillas de WhatsApp: solo el lado SIS

**Delimitación honesta:** la creación, edición y aprobación de
plantillas ocurren en Meta Business Manager, fuera de SIS. SIS no
crea plantillas en esta fase, no las edita y no promete aprobarlas:
eso es trámite del operador en Meta. Lo que diseña esta fase es
únicamente el registro, la consulta y el uso de plantillas ya
aprobadas.

### 3.1 Registro por org

Nueva tabla propuesta, `whatsapp_templates` (migración portable):

| Campo | Contenido |
|---|---|
| `id`, `org_id` | Vínculos. |
| `name` | Nombre de la plantilla en Meta (único por org + idioma). |
| `language` | Idioma (por ejemplo `es_AR`; los códigos exactos se confirman contra la lista de Meta en implementación). |
| `status` | `'approved'` / `'pending'` / `'rejected'`: viene de la Graph API, no lo inventa SIS. |
| `parameters` | Cantidad y nombres de los parámetros que la plantilla acepta (para armar el formulario de envío). |
| `body_text` | Texto aprobado con los parámetros marcados (para previsualizar antes de enviar). |
| `last_synced_at` | Última sincronización contra la Graph API. |

- Sincronización: acción manual del admin («Sincronizar
  plantillas») que consulta la Graph API y actualiza el registro;
  también se sincroniza al verificar la conexión. No hay
  sincronización automática sin worker: en plan gratis, que la
  lista quede desactualizada es un costo aceptado y visible
  (`last_synced_at` a la vista).
- El endpoint exacto de lectura de plantillas en la Graph API
  queda «a confirmar en implementación» (la lectura es por cuenta
  Business, no por número): el diseño no afirma una ruta que no
  verificó contra la API.
- Catálogo: la capacidad «Enviar plantillas aprobadas fuera de la
  ventana de 24 horas» se agrega a WhatsApp como **prevista** y
  pasa a real solo cuando la org tiene al menos una plantilla
  `approved` sincronizada. Misma regla que siempre: sin
  verificación que responda, no hay «Disponible».

### 3.2 Cuándo plantilla y cuándo texto libre

- Dentro de la ventana (respuesta reciente, ver §2.3): texto
  libre, como hoy. La plantilla no se ofrece: no tiene sentido
  usar un texto rígido cuando se puede escribir libre.
- Fuera de la ventana: el texto libre falla (`window_closed`) y
  la única vía de SIS es la plantilla. El admin la elige, completa
  los parámetros (texto que él escribe, por ejemplo el nombre) y
  SIS envía el mensaje de plantilla por la Graph API.
- **El punto delicado, sin tapar:** una plantilla NO reenvía el
  cuerpo del borrador. El texto que recibe el interesado es el
  texto aprobado por Meta, con parámetros: no es el borrador
  aprobado, ni una versión suya, ni un «mismo mensaje por otro
  canal». Por eso la plantilla, por sí sola, **NO resuelve la
  pregunta abierta de F2** (window_closed + UNIQUE(draft_id)):
  - Lo que SÍ resuelve: reanudar la conversación fuera de ventana
    con un mensaje nuevo (por ejemplo, desde la vista de la
    oportunidad: «¿Seguimos con la propuesta?»), sin tocar el
    borrador ni su entrega.
  - Lo que NO resuelve: que el borrador aprobado llegue por otro
    canal cuando su envío por WhatsApp ya falló. Eso sigue
    exigiendo una decisión de diseño (ver §6): cambiar la
    unicidad, permitir cambiar el canal en el reintento, o
    mantenerlo manual. Este diseño no la toma.
- Para no mezclar los dos mundos, el envío de plantilla NO usa
  `message_deliveries` (que tiene `draft_id` único y no nulo):
  usa una tabla propia propuesta, `template_messages` (`org_id`,
  `opportunity_id`, `template_name`, `language`, `parameters`,
  `status`, `provider_message_id`, `error_code`, `created_at`),
  con su propio evento de auditoría `template.sent` /
  `template.failed` (actor `agent:response_proposal`, mismo
  criterio que los envíos: el agente dueño del mensaje). Así el
  invariante «un borrador, una entrega» queda intacto y el
  historial distingue qué fue borrador y qué fue plantilla.

## 4. Reglas duras que se mantienen (y se extienden)

- **Ningún secreto** en endpoints, logs ni repo: ni tokens de
  Gmail/WhatsApp, ni secreto de app de Meta, ni token de
  verificación del webhook, ni cuerpos de mensajes en logs. Los
  logs de webhook registran tipo de evento y resultado de
  enrutado, nunca el contenido.
- **Humano con la última palabra:** las respuestas se registran,
  no se contestan. Cualquier respuesta automática (incluso un
  «gracias, te contactamos») queda **explícitamente fuera** de
  esta fase: sería un envío autónomo y contradice la regla vigente
  de SECURITY.md. Si algún día se quiere, es diseño nuevo con
  aprobación aparte.
- **Sin envío masivo:** una plantilla, un destinatario, un
  registro. Igual que un borrador, una entrega.
- **Sin cambios** en clasificación, dedup, tareas, vencimiento de
  borradores ni estados de oportunidad. Una respuesta no crea
  oportunidades, no reclasifica, no crea tareas ni cambia
  prioridades: el equipo decide qué hacer con lo leído.
- **Sin capacidades ficticias:** una capacidad del catálogo pasa
  a real solo cuando su verificación responde (plantilla: al
  menos una `approved` sincronizada; lectura de Gmail: primer
  hilo leído con éxito; webhook WhatsApp: primer evento
  enrutado). Mientras tanto, prevista.
- **Sin promesas de plan gratis:** sin worker no hay sondeo
  programado ni sincronización automática de plantillas. Lo que
  esta fase promete en plan gratis es: webhook sincrónico,
  sondeo bajo demanda y sincronización manual. Lo demás llega
  con worker o cron externo, y se dice así.
- **Privacidad de lo entrante:** el cuerpo de una respuesta es
  dato de un tercero. Se guarda (hace falta para leerlo), se
  muestra completo solo en el detalle de la oportunidad y se
  enmascara en Actividad y en cualquier lista. Nunca se expone en
  URLs ni en parámetros de consulta.

## 5. Qué NO incluye esta fase

- Respuestas automáticas de ningún tipo (ver §4).
- Lectura de todo el buzón de Gmail ni búsquedas libres en el
  correo (solo hilos de entregas de SIS, ver §1.2).
- Adjuntos de Gmail o de WhatsApp (se ignoran; quedan fuera).
- Recibos de lectura/entrega de WhatsApp como estado de entrega.
- Creación o edición de plantillas desde SIS (solo
  sincronización y uso de las aprobadas en Meta).
- Envío masivo, campañas y listas de difusión.
- Cambios en clasificación, dedup, tareas, vencimiento,
  estados de oportunidad o la app vanilla.
- Notificaciones al equipo ante una respuesta (queda como
  decisión pendiente, ver Decisiones): en esta fase la respuesta
  se ve al abrir la oportunidad o la Actividad, no empuja nada.

## 6. Plan de implementación por fases (recomendado)

**Fase A — Webhook WhatsApp (primero).** Es la que más desbloquea
con menos dependencias: no pide ningún alcance nuevo, no exige
verificación de Google, no depende de worker y mejora F2 de
inmediato (la ventana pasa a ser real: cada respuesta la abre).
Además, el número Business ya existe para enviar; recibir por el
mismo canal es el paso simétrico. Incluye: endpoint de
verificación + firma, dedup, enrutado por `phone_number_id`,
asociación por teléfono, tabla `inbound_messages`, evento
`message.received`, sección «Respuestas» en la oportunidad y
ventana derivada para la UI.

**Fase B — Respuestas Gmail por sondeo bajo demanda
(segundo).** Requiere el alcance nuevo, el re-consentimiento y el
trámite de verificación de Google, que es externo y con tiempo
propio: por eso va después, y por eso su papeleo puede empezarse
en paralelo sin escribir código. Incluye: `thread_id` en
`message_deliveries` (y su captura en el envío), alcance
`gmail.readonly` + re-consentimiento, sondeo bajo demanda por
hilo, asociación por hilo y por remitente (excepción legacy),
misma tabla `inbound_messages` y mismo evento que la Fase A
(nada duplicado: el registro y la vista son comunes a los dos
canales).

**Fase C — Plantillas (tercero).** Va última porque depende de
las dos anteriores para tener sentido completo: sin ventana
real (Fase A) no se sabe cuándo hace falta una plantilla, y sin
el registro de respuestas no se distingue «reanudar» de
«reenviar». Incluye: tabla `whatsapp_templates`,
sincronización manual + en verificación, tabla
`template_messages`, envío de plantilla desde la oportunidad
(fuera del flujo de aprobar), eventos `template.sent` /
`template.failed` y capacidad del catálogo con su regla de
realidad.

**Orden alternativo descartado:** plantillas antes que webhook.
Parece más corto, pero deja a SIS mandando plantillas sin saber
si la ventana está abierta (no sabría cuándo hace falta una) y
sin registrar las respuestas que esas plantillas provocarían. El
orden A → B → C evita construir la respuesta antes de la
pregunta.

**Riesgos:**

- **Verificación de Google con alcance de lectura:** el alcance
  `gmail.readonly` es sensible y la pantalla de consentimiento
  puede exigir verificación de la app. Mitigación: pedir solo
  ese alcance junto a `gmail.send`, documentar uso interno por
  organización y empezar el trámite antes de la Fase B; si
  Google lo exige, es tiempo externo, no un cambio de diseño.
- **Verificación de Meta:** el alta Business y el webhook
  requieren la app y la cuenta verificadas; los detalles del
  endpoint de plantillas quedan «a confirmar en
  implementación» (ver §3.1). Mitigación: diseñar contra la
  Graph API con versión en constante (como ya hace F2) y no
  fijar rutas no verificadas.
- **Render gratis sin worker y con sueño:** el servicio duerme
  a los 15 minutos sin tráfico y tarda ~1 minuto en despertar.
  Un webhook de Meta que llegue dormido puede tardar o
  reintentarse: el dedup por `wamid` hace que los reintentos
  sean seguros, y el propio webhook despierta al servicio. No
  se promete recepción instantánea en plan gratis.
- **Token revocado (Google o Meta):** el estado pasa a `error`,
  la lectura y el envío fallan como `connection_error` y la UI
  pide reconectar. Nunca se reintenta en bucle contra un token
  revocado. Para Gmail, la revocación también corta el sondeo:
  la lectura vuelve a «pendiente de reconexión».
- **Secreto de cifrado:** sin `CONNECTION_ENCRYPTION_KEY`, el
  módulo de conexiones sigue cerrado (fail-closed) y las
  credenciales guardadas son ilegibles. Perder la clave implica
  perder el acceso a las conexiones guardadas, como ya advierte
  el diseño anterior.
- **Abuso del webhook:** cualquiera que conozca el número puede
  escribirle. El diseño lo absorbe: sin coincidencia no se crea
  nada ni se responde nada; con coincidencia solo se registra.
  No hay superficie de envío nueva para un remitente
  desconocido.

**Verificación pedida por fase (patrón vigente):**

- Tests nuevos por fase con proveedores simulados y fixtures de
  webhook firmados con secreto de prueba (nunca secretos reales):
  firma inválida descartada, dedup por `wamid`, enrutado por
  `phone_number_id` desconocido sin guardar nada, asociación por
  teléfono y por hilo, remitente sin coincidencia guardado sin
  oportunidad, ventana derivada abierta/cerrada, plantilla
  enviada con parámetros (sin usar el cuerpo del borrador),
  `template_messages` separada de `message_deliveries`, máscara
  del remitente y del cuerpo en el JSON técnico. **Nunca
  mensajes reales en tests.**
- Suite completa, build, typecheck del cliente. Vanilla intacta
  (MD5 de referencia) y DB real local intacta; smoke en copia
  (webhook simulado → mensaje registrado + evento; sondeo
  simulado → respuesta asociada; plantilla simulada → envío
  registrado).
- Verificación en vivo solo lectura tras cada merge
  (indicadores sin cambios). **Una respuesta real solo se prueba
  con cuentas de prueba y con autorización expresa de Tomás**:
  la demo pública no recibe ni muestra mensajes reales de
  terceros sin esa decisión.

## Archivos que tocará la implementación (cuando se apruebe)

- Servidor: `app/src/db.ts` (tablas `inbound_messages`,
  `whatsapp_templates`, `template_messages`; columna
  `message_deliveries.thread_id`), `app/src/domain.ts` (esquemas
  de sincronización de plantillas y de envío de plantilla),
  `app/src/routes.ts` (webhook público de Meta con verificación
  y firma, `GET /api/opportunities/:id` con respuestas, listado
  de entrantes, sincronización y envío de plantilla),
  `app/src/sending.ts` (`MailProvider`: lectura de hilo;
  `WhatsAppProvider`: envío de plantilla y listado de
  plantillas), `app/src/config.ts` + `render.yaml`
  (`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
  `sync: false`; el alcance de Gmail cambia en
  `buildGoogleAuthUrl`), `docs/SECURITY.md` (lectura registrada,
  sin respuesta automática).
- Cliente: `features/oportunidades/OpportunitiesView.tsx`
  (sección «Respuestas», lista de sin coincidencia),
  `features/actividad/ActivityView.tsx` (eventos
  `message.received`, `template.sent`/`template.failed`,
  máscara de remitente y cuerpo), `features/integraciones/
  IntegrationsView.tsx` (capacidades previstas de lectura y
  plantillas, estado de lectura de Gmail, sincronización de
  plantillas, estado del webhook).
- No se tocan: clasificación, dedup, tareas, vencimiento de
  borradores, estados de oportunidad, ni la app vanilla.

## Decisiones pendientes (solo estas, sin asumir)

1. **Cuentas de prueba para la primera respuesta real:** con qué
   cuentas de Google y de Meta se prueba cada fase (decisión de
   Tomás, no de este diseño). Sin ellas no hay prueba real, solo
   simulada.
2. **Sondeo bajo demanda vs. programado vs. push para Gmail:**
   este diseño recomienda bajo demanda primero (única vía viable
   en plan gratis) y deja programado/push para después; la
   decisión es si se agrega alguno de los dos y cuándo.
3. **Plantillas: ¿gestión en SIS o solo referencia?** Este
   diseño propone solo sincronizar y usar las aprobadas en Meta;
   crearlas o editarlas desde SIS sería otra fase con su propio
   diseño.
4. **¿Se notifica al equipo ante una respuesta entrante, y por
   qué canal?** En esta fase, no: la respuesta se ve al abrir la
   oportunidad o la Actividad. Si se quiere aviso (por ejemplo
   correo al admin o marca en la consola), es decisión aparte
   con su propio alcance.
5. **El nudo window_closed + UNIQUE(draft_id) (pregunta abierta
   de F2, sin cerrar acá):** ¿se mantiene manual el contacto por
   Gmail tras un `window_closed`, se permite cambiar el canal en
   el reintento, o se permite una segunda entrega por borrador?
   Las plantillas NO lo resuelven solas (ver §3.2): lo que
   resuelven es reanudar con un mensaje nuevo, no reenviar el
   borrador.
6. **Enlace manual de mensajes sin coincidencia:** ¿la lista de
   «sin coincidencia» queda solo para lectura, o el admin puede
   enlazar un mensaje a una oportunidad a mano? En esta fase,
   solo lectura.

## Contradicciones y hallazgos frente al diseño anterior (sin tapar)

- El diseño anterior (§1 Gmail) citaba la capacidad «Registrar
  respuestas en la oportunidad» como prevista en el catálogo.
  **El catálogo implementado hoy no la tiene**: F1/F2
  reescribieron las capacidades a solo envío. Este diseño la
  reintroduce como prevista, no como real, y deja constancia de
  que nunca estuvo en la UI.
- El diseño anterior describía una base pre-F2 (sin teléfono, sin
  WhatsApp en el catálogo, canal al aprobar abierto). Todo eso ya
  cambió: teléfono existe, WhatsApp está en el catálogo y el
  canal al aprobar es explícito por decisión de Tomás. La base
  de este diseño es la realidad post-F2, no la del documento
  anterior.
- El diseño anterior decía «las plantillas quedan fuera» y «esta
  fase solo envía dentro de la ventana». Este diseño no
  contradice eso: lo extiende. El envío por aprobar sigue siendo
  solo texto libre dentro de la ventana; la plantilla es una
  acción nueva desde la oportunidad, fuera del flujo de aprobar,
  y por eso no rompe el invariante de una entrega por borrador.
- El diseño anterior prometía que «el mismo registro puede
  encolarse» cuando hubiera worker. Para la lectura de Gmail,
  este diseño es más estricto: en plan gratis no hay sondeo
  programado ni automático, solo bajo demanda. No se promete
  automaticidad que el plan gratis no puede dar.
