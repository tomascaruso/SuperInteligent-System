# Diseño — Primera conexión real de envío: Gmail + WhatsApp

> Documento de diseño. No es código, no cambia ningún comportamiento.
> Solo en local: sin push, PR, merge ni despliegue. La implementación
> requiere aprobación expresa aparte, como toda fase de SIS.

## Estado general

**Objetivo:** que, tras aprobar un borrador, un agente mande el mensaje
por el canal elegido (Gmail o WhatsApp), con registro completo en
auditoría. Hoy eso no existe: aprobar solo deja la oportunidad en
seguimiento y el contacto se hace manual por fuera.

**Decisión que cambia la regla (Tomás, 28-oct-2026):** conectar Gmail y
WhatsApp, y tras aprobar, un agente manda el mensaje por el canal
elegido. Esto REEMPLAZA la regla anterior de «aprobar no envía nada»,
pero SOLO para los canales conectados. Una organización sin conexiones
sigue aprobando exactamente como hoy (sin envío, sin error).

**Estado:** DISEÑO (sin implementar). Lo que sigue distingue en cada
punto qué existe hoy de qué se propone.

## Base verificada hoy (releída, no supuesta)

- `app/src/routes.ts`, `decideDraft` (aprobar/rechazar, solo admin por
  `requireAdmin`): aprobar exige borrador `pending_approval`, vigente
  (no vencido por `draft.expiry_days=7`, no desactualizado contra el
  mensaje de la oportunidad) y mueve la oportunidad a `in_follow_up`;
  rechazar la devuelve a `new`. El propio código comenta: «Sin
  aprobación no hay acción externa… El envío real es Fase 3 y requiere
  autorización y pruebas propias». `docs/SECURITY.md` dice «Sin envíos
  externos autónomos en el MVP»: ambas notas deberán actualizarse
  cuando esta fase se implemente, no antes.
- `app/src/domain.ts`, `opportunityInputSchema`: `contactName`,
  `contactEmail`, `company` (opcional), `message` (máx 5000),
  `source`. Es el esquema compartido por alta manual, `POST /api/jobs`
  y webhook. **No existe ningún campo teléfono.**
- `app/src/db.ts`: `opportunities` sin teléfono; `drafts` con `body`,
  `source_message`, `status`, `edited`/`edited_at` (R3b); `agents` sin
  `org_id` (el catálogo es global, se sincroniza en cada arranque);
  `jobs` (`pending`/`processing`/`done`/`failed`) para el camino
  asíncrono; `audit_log` (`actor`, `action`, `entity`, `entity_id`,
  `detail_json`); políticas reales: `retry.admin_only=true`,
  `retry.max_attempts=3`, `draft.approval.admin_only=true`,
  `draft.expiry_days=7`.
- Agentes reales (`db.ts`, catálogo): `response_proposal` («Respuesta
  y propuesta», pasos `['draft']`) y `follow_up` («Seguimiento»,
  pasos `['next_action']`). La pausa de agentes es global y el
  intake ya frena antes de guardar nada si algún agente está en pausa
  (`409 agent_paused`).
- `app/client/src/features/integraciones/IntegrationsView.tsx`,
  registro tipado: Gmail existe como `coming_soon` («Enviar correos
  desde SIS», «Registrar respuestas en la oportunidad», nota «Requerirá
  OAuth de Google y permisos de correo»). **WhatsApp NO está en el
  catálogo** (Comunicación hoy es Slack, Teams, Gmail, Zoom): agregarla
  es parte de esta fase, como entrada nueva, no como cambio de estado
  de una existente. Solo el webhook de ingesta es `available`.
- `app/client/src/features/actividad/ActivityView.tsx`: el inspector
  enmascara en presentación (nombre: inicial + `***`; correo: primera
  letra + `***@dominio`; mensaje: primeros 15 caracteres). La máscara
  es por clave en el JSON (`contactEmail`, `contactName`, `company`,
  `message`): cualquier clave nueva con datos personales debe agregarse
  ahí o se filtra en el bloque técnico.
- `app/src/worker.ts` y `render.yaml`: el worker existe (`--once` y
  bucle), pero `render.yaml` solo define el servicio web en plan
  gratis. **En Render gratis no hay worker**: el envío de la fase 1
  debe funcionar sin él (ver §3).
- UI de Aprobaciones hoy: el diálogo de aprobar no tiene campo de
  nota (aprobar ignora la nota) ni campo de canal. Agregar el canal es
  un cambio de contrato, no un retoque visual.

## 1. Modelo de conexión por organización

Nueva tabla propuesta, `org_connections` (migración portable, mismo
patrón que las de `drafts.edited` y `agents.paused`):

| Campo | Contenido |
|---|---|
| `org_id` | Organización dueña. Las conexiones son por org, nunca globales. |
| `provider` | `'gmail'` o `'whatsapp'`. |
| `status` | `'connected'`, `'error'`, `'revoked'`. Nunca un valor fijo: se calcula con una verificación real contra el proveedor (ver abajo). |
| `display_account` | Dato NO secreto que sí se muestra en la UI: correo de la cuenta conectada (Gmail) o número de WhatsApp Business (WhatsApp). |
| `credentials_ciphertext` | Tokens cifrados. Nunca se devuelve por ninguna API ni se muestra en ninguna vista. |
| `last_verified_at`, `last_error` | Última verificación real y su error (sin secretos). |

**Reglas duras:**

- Ningún endpoint devuelve secretos, ni siquiera al admin de la org.
  `GET /api/connections` (nuevo, solo usuarios de la org) devuelve
  `provider`, `status`, `display_account`, `last_verified_at`: eso es
  todo lo que la UI necesita para mostrar «Disponible» con fundamento.
- Sin secreto en código, repo ni logs. Los tokens de cada org viven
  solo en la columna cifrada; los secretos globales (ver cifrado) viven
  solo en variables de entorno del dashboard.
- Estado real, no inventado: `connected` solo si la última
  verificación contra el proveedor respondió bien (Gmail: perfil de la
  cuenta con el token vigente; WhatsApp: lectura del número en la
  Graph API). Si la verificación falla, el estado es `error` y los
  envíos por ese canal fallan como `connection_error` hasta reconectar.

**Cifrado en reposo (propuesto):** AES-256-GCM sobre la columna de
credenciales, con una clave global de entorno gestionada por el
operador (nueva variable en `render.yaml` con `sync: false`, mismo
patrón que `OPERATOR_TOKEN` y `CONTACT_RELAY_*`: se carga a mano en el
dashboard, nunca va al repo). Sin esa clave, los endpoints de
conexiones responden cerrados y no se intenta ningún envío
(fail-closed, mismo criterio que el relay de contacto). La rotación de
la clave queda como trabajo posterior, no de esta fase.

**Gmail (OAuth por organización):**

- Flujo OAuth de Google iniciado y completado por un admin de la org
  (endpoints nuevos, solo admin, con `state` anti-CSRF). Se pide
  acceso offline para guardar el refresh token cifrado.
- Alcance mínimo de esta fase: **solo `gmail.send`**. No se pide
  lectura del buzón: la capacidad «Registrar respuestas en la
  oportunidad» que el catálogo menciona como prevista queda para una
  fase posterior (requeriría otro alcance y otro flujo).
- El remitente es la cuenta conectada de la org. No se suplanta
  ninguna dirección. El asunto propuesto (dato real, no inventado):
  `Respuesta de {nombre de la organización}`; el cuerpo es el borrador
  aprobado, sin agregados.

**WhatsApp (Business, no número personal):**

- Remitente: un número de WhatsApp Business de la empresa, dado de
  alta en Meta (cuenta de WhatsApp Business + app + número). El token
  es de sistema por cuenta (no de usuario personal) y lo carga el
  operador por el mismo canal seguro que los demás secretos: se guarda
  cifrado en `org_connections`, nunca en variables globales (las
  variables son globales; las credenciales son por org).
- Ventana de 24 horas: fuera de ella, WhatsApp solo permite mensajes
  de plantilla aprobada por Meta. El borrador aprobado es texto libre,
  así que **esta fase solo envía dentro de la ventana de atención**.
  Si no hay ventana abierta (por ejemplo, el interesado llegó por
  formulario web y nunca escribió por WhatsApp), el envío falla como
  `window_closed` y la UI sugiere Gmail. Las plantillas aprobadas son
  fase posterior, no se diseñan acá.
- El catálogo suma la entrada `whatsapp` en Comunicación con estado
  `coming_soon` hasta que la conexión real exista, y con capacidades
  rotuladas como previstas, como hoy hace Gmail.

## 2. Campo teléfono en la oportunidad (hoy NO existe)

- **Migración:** `ALTER TABLE opportunities ADD COLUMN contact_phone
  TEXT` (nullable, patrón portable existente). Sin backfill: no se
  inventa ningún número.
- **Entrada:** `contactPhone` opcional en el esquema compartido
  (`domain.ts`), con lo que llega a la vez al alta manual, al webhook
  y a `POST /api/jobs`, sin tres implementaciones distintas.
- **Validación mínima (propuesta):** texto opcional, máx 30 caracteres;
  se normaliza quitando espacios, guiones y paréntesis y debe quedar
  `+` opcional seguido de 7 a 15 dígitos. No se valida pertenencia ni
  operadora: eso lo hace el proveedor al enviar.
- **Vistas:** fila «Teléfono» en el detalle de Oportunidades y en los
  datos contextuales de Aprobaciones; campo opcional en el formulario
  de alta. Sin teléfono, la UI muestra `—` (como hoy hace con la
  empresa vacía).
- **Oportunidades viejas:** `contact_phone` nulo. Consecuencias
  directas: el canal WhatsApp no está disponible para ellas y la
  variante automática (ver §4) cae a Gmail. La clave de dedup
  (`email|empresa|nombre`) **no cambia**: el teléfono no entra en
  dedup, para no alterar el comportamiento probado del intake.
- **Enmascarado:** en Actividad, el teléfono se enmascara como el resto
  (propuesta: conservar código de país y últimos 4 dígitos, resto
  `*`; la función de máscara debe aprender la clave nueva, ver §3).

## 3. Flujo de envío tras aprobar

**Quién envía (propuesta):** el agente `Respuesta y propuesta`
(`response_proposal`), con un paso nuevo `send` en su lista de pasos
(el catálogo de agentes es propiedad del código y se sincroniza en
cada arranque, así que la capacidad aparece en la vista de Agentes
solo cuando la fase existe de verdad). Justificación: ese agente ya es
dueño del texto que se envía (paso `draft`); que el mismo agente
ejecute el envío mantiene «quién redactó» y «qué se envió» bajo la
misma responsabilidad y el mismo registro. Alternativa considerada y
no recomendada: `follow_up` (Seguimiento), que es dueño de la próxima
acción y de la tarea, pero no del mensaje; usarlo mezclaría
«programar» con «enviar».

**Secuencia (aprobación con envío):**

1. El admin abre el diálogo de aprobar y elige el canal (ver §4).
   El diálogo muestra el destinatario completo (en Aprobaciones los
   datos se ven completos; la máscara es solo del historial).
2. **Pre-chequeo de pausa, antes de decidir:** si `response_proposal`
   está pausado, la aprobación responde `409 agent_paused` sin decidir
   nada (mismo criterio H1 del intake: frenar antes de guardar, no a
   mitad). El borrador queda pendiente y se puede aprobar cuando se
   reanude.
3. La decisión se registra exactamente como hoy (borrador `approved`,
   oportunidad `in_follow_up`, evento `draft.approved` con
   `opportunityId`). Solo después se crea el registro de envío.
4. Se crea la entrega (`message_deliveries`, propuesta abajo) en
   estado `pending`, con `UNIQUE(draft_id)`: un borrador aprobado una
   vez no puede generar dos envíos, y un reintento reutiliza la misma
   fila (la segunda aprobación es imposible: el borrador ya decidido
   da `409 conflict`, regla vigente).
5. Se intenta el envío contra el proveedor con timeout corto
   configurado (propuesta: 15 s). Éxito → `sent` (+ id de mensaje del
   proveedor, que no es secreto). Fallo → `failed` + código de error
   (`connection_error`, `window_closed`, `provider_error`, `timeout`).
6. La respuesta de aprobar devuelve el borrador más la entrega, para
   que la UI muestre el resultado sin otra consulta.

**Tabla propuesta, `message_deliveries`:**

| Campo | Contenido |
|---|---|
| `id`, `org_id`, `draft_id` (único), `opportunity_id` | Vínculos. |
| `channel` | `'gmail'` o `'whatsapp'`. |
| `status` | `'pending'`, `'sent'`, `'failed'`. |
| `attempts` | Intentos realizados (tope por política, abajo). |
| `provider_message_id` | Id del mensaje en Gmail/WhatsApp, si lo hubo. No es secreto. |
| `error_code`, `error` | Último fallo, sin secretos ni cuerpos completos. |
| `created_at`, `updated_at` | Trazabilidad. |

**«Comunicada» no es `opportunity.status`:** `in_follow_up` significa
seguimiento interno, no «mensaje entregado». El estado de
comunicación se deriva de la entrega: solo una entrega `sent` permite
mostrar «Enviado por {canal}». Si el envío falló, la oportunidad
sigue en `in_follow_up` (eso no cambia: el equipo igual debe hacer
seguimiento), pero la UI muestra «Envío fallido» con el motivo y el
botón de reintento. No se miente sobre una entrega que no ocurrió.

**Reintento:** solo admin, solo sobre entregas `failed`, con tope por
política. Se proponen claves nuevas (para no cambiar la semántica del
reintento de ejecuciones): `send.retry.admin_only=true` y
`send.retry.max_attempts=3`, mismo valor y mismo patrón que
`retry.max_attempts`. Agotado el tope, la entrega queda `failed`
definitiva y el equipo contacta manual (los datos siguen completos en
Oportunidades). El reintento nunca reenvía una entrega `sent`.

**Sin worker (plan gratis):** la fase 1 envía **sincrónico dentro de
la respuesta de aprobar** (la entrega se crea antes de llamar al
proveedor, así que un corte no la pierde: queda `pending` y el reintento
la retoma). Cuando exista worker (plan Starter o decisión posterior),
el mismo registro puede encolarse (`jobs kind='send'` o el worker
leyendo `message_deliveries` pendientes): el diseño no cambia, solo el
ejecutor. No se promete envío asíncrono en plan gratis.

**Auditoría (Actividad):** eventos nuevos, mismo `audit_log` de
siempre, con `opportunityId` en el detalle (como ya hacen
`draft.created` y `task.updated` tras A2):

- `message.sent`: `entity='delivery'`, detalle `{ channel, draftId,
  opportunityId, providerMessageId }`.
- `message.failed`: mismo detalle + `errorCode`.
- Actor: `agent:response_proposal` (distinto del correo del admin, de
  `webhook` y de `worker`, como hoy distingue actores la auditoría).
- Enmascarado: la vista de historial debe enmascarar al destinatario.
  La función de máscara aprende la clave `recipient` (correo con la
  regla vigente; teléfono con la regla del §2). Si no se agrega, el
  destinatario completo se filtraría en el bloque técnico plegado: es
  un punto de verificación obligatorio de la fase, no un detalle.
- Qué se envía exactamente: **solo el cuerpo vigente del borrador
  aprobado** (el de `drafts.body` en el momento de aprobar, incluido
  si fue editado por admin bajo R3b, máx 5000). La marca `edited` se
  muestra en la UI como hoy, pero no altera el texto enviado: se envía
  lo aprobado, ni más ni menos.

## 4. Elección del canal al aprobar — DECISIÓN ABIERTA

Hoy aprobar no recibe cuerpo útil (la nota solo aplica al rechazo).
El diseño agrega un cuerpo opcional a aprobar:

```
POST /api/drafts/:id/approve   { "channel": "gmail" | "whatsapp" | null }
```

- `channel` explícito: se valida que la org tenga esa conexión en
  estado `connected` y que exista el destinatario (correo siempre
  existe; teléfono puede faltar → `409 channel_unavailable` con
  mensaje claro, sin decidir el borrador: el admin corrige y reintenta).
- `channel` omitido o `null`: no se envía nada (comportamiento actual).
  Esto preserva aprobar sin conexión: si la org no tiene conexiones,
  el diálogo ni ofrece canal y aprobar funciona como hoy.

**Variantes del flujo (ambas soportadas por el mismo endpoint):**

- **A. Explícita (RECOMENDADA):** el diálogo de aprobar exige elegir
  el canal cuando la org tiene conexiones (con el canal sugerido
  preseleccionado, ver B, pero con confirmación del admin). El envío a
  un tercero es irreversible: que una persona lo confirme con el
  destinatario a la vista es la opción segura, coherente con que
  aprobar ya exige admin.
- **B. Automática según datos:** sin elección, el servidor resuelve
  teléfono presente → WhatsApp; si no, Gmail (el correo siempre
  existe, así que siempre resuelve). Es cómoda pero tiene dos
  problemas: puede mandar por WhatsApp a alguien que solo dejó el
  teléfono como dato secundario, y puede chocar con la ventana de 24 h
  sin que el admin lo prevea.

**Punto abierto, sin cerrar:** Tomás debe decidir entre A y B (o A con
sugerencia automática preseleccionada, que es el punto medio que este
diseño recomienda). No se asume ninguna como cerrada. Lo que sí queda
fijado: sin canal elegido y sin modo automático configurado, aprobar
no envía nada.

## 5. Qué NO incluye esta fase

- **Respuestas entrantes:** leer respuestas de Gmail/WhatsApp y
  volcarlas a la oportunidad es fase posterior, aunque el catálogo la
  mencione como capacidad prevista («Registrar respuestas»). Esta fase
  es solo envío saliente.
- Envío masivo (un borrador, un destinatario, una entrega).
- Plantillas editables por el cliente ni plantillas de WhatsApp
  aprobadas por Meta.
- Ningún endpoint que devuelva secretos (tokens, claves, secretos de
  conexión), ni siquiera al admin.
- Cambios en la clasificación, el dedup, las tareas o el vencimiento
  de borradores: todo eso sigue igual.

## 6. Plan de implementación por fases (recomendado)

**Fase 0 — Base (sin envío):** migración de `contact_phone` y tabla
`message_deliveries`; teléfono en esquema de entrada, alta manual,
webhook y vistas (Oportunidades, Aprobaciones); máscara de teléfono y
de la clave `recipient` en Actividad; políticas `send.retry.*`;
entrada `whatsapp` en el catálogo como `coming_soon`. Al cerrar F0
todavía no se envía nada: la base queda probada antes del primer envío
real.

**Fase 1 — Gmail (primero, porque los datos ya existen):** conexión
OAuth por org + cifrado + verificación real de estado; envío
sincrónico en aprobar con entrega, reintento y auditoría; diálogo de
aprobar con canal; tarjeta de conexión real en Integraciones (Gmail
pasa a estado real solo cuando la verificación responde, nunca antes).
WhatsApp sigue `coming_soon`.

**Fase 2 — WhatsApp:** alta de la conexión Business (operador),
número y token cifrados, verificación real; envío con control de
ventana de 24 h (`window_closed` → sugerencia de Gmail); entrada del
catálogo a estado real bajo el mismo criterio que Gmail.

**Riesgos:**

- **Verificación de Google:** el alcance `gmail.send` es sensible y
  la pantalla de consentimiento puede exigir verificación de la app.
  Mitigación: pedir solo ese alcance y documentar la app como de uso
  interno por organización; si Google exige verificación, es un
  trámite externo con tiempo propio, no un cambio de diseño.
- **Verificación de Meta:** el alta de WhatsApp Business y el número
  requieren cuenta verificada; las plantillas quedan fuera (ver §1).
- **Render gratis sin worker:** el envío sincrónico alarga la
  respuesta de aprobar y un proveedor lento puede dar timeout. El
  diseño lo absorbe (entrega `pending`/`failed` + reintento), pero la
  experiencia no es la de un envío en segundo plano: eso llega con
  worker.
- **Token revocado:** el usuario puede revocar en Google o Meta. El
  estado pasa a `error`, los envíos fallan como `connection_error` y
  la UI pide reconectar. Nunca se reintenta en bucle contra un token
  revocado.
- **Secreto de cifrado:** si la clave de entorno no está, todo el
  módulo queda cerrado (fail-closed). Perder la clave implica perder
  el acceso a las credenciales guardadas: es el costo de no guardar
  nada en texto plano y debe comunicarse al operador antes de cargar
  la primera conexión.

**Verificación pedida por fase (patrón vigente):**

- Tests nuevos por fase (proveedor simulado, nunca envíos reales en
  tests: duplicado de entrega imposible, reintento con tope,
  `409 channel_unavailable` sin decidir, `409 agent_paused` sin
  decidir, ventana cerrada de WhatsApp, máscara del destinatario en el
  JSON técnico); suite completa, build, typecheck del cliente.
- Vanilla intacta (MD5 de referencia) y DB real local intacta; smoke
  en copia (aprobar con proveedor simulado → entrega `sent` en
  auditoría; aprobar sin conexión → comportamiento actual).
- Verificación en vivo solo lectura tras cada merge (indicadores sin
  cambios). **Un envío real solo se prueba con cuentas de prueba y
  con autorización expresa de Tomás**: la demo pública no manda
  correos ni mensajes reales a terceros sin esa decisión.

## Archivos que tocará la implementación (cuando se apruebe)

- Servidor: `app/src/db.ts` (tablas y migraciones), `app/src/domain.ts`
  (esquema + normalización del teléfono), `app/src/routes.ts`
  (conexiones, aprobar con canal, entregas y reintento),
  `app/src/config.ts` + `render.yaml` (clave de cifrado, `sync: false`),
  `docs/SECURITY.md` y el comentario de `decideDraft` (regla nueva).
- Cliente: `features/integraciones/IntegrationsView.tsx` (entrada
  WhatsApp, estado real de Gmail/WhatsApp), `features/aprobaciones/
  ApprovalsView.tsx` (diálogo con canal + estado de entrega),
  `features/oportunidades/OpportunitiesView.tsx` (teléfono),
  `features/actividad/ActivityView.tsx` (máscara de `recipient` y
  teléfono, eventos `message.sent`/`message.failed`).
- No se tocan: clasificación, dedup, tareas, vencimiento de
  borradores, ni la app vanilla.

## Decisiones pendientes (solo estas)

1. **Canal al aprobar:** explícito (recomendado, con sugerencia
   preseleccionada) o automático según datos. Abierta, sin asumir.
2. **Cuentas de prueba para el primer envío real:** con qué cuentas
   de Google y de Meta se prueba cada fase (decisión de Tomás, no de
   este diseño).
