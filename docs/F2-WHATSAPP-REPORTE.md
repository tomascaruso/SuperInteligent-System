# F2 — WhatsApp Business: envío tras aprobar (reporte de fase)

> Implementación SOLO en local. Sin commit, sin push, sin merge ni
> despliegue. El merge lo autoriza Tomás por separado, como toda fase
> de SIS. Diseño vigente (sin tocar):
> `docs/DISENO-ENVIO-GMAIL-WHATSAPP.md` (§1 WhatsApp Business, §3
> flujo de envío, §5 qué NO incluye, §6 Fase 2).

## Estado general

**IMPLEMENTADO EN LOCAL, pendiente de autorización para subir y
mergear.** WhatsApp Business ya se puede conectar de verdad por
organización y ya envía el borrador aprobado cuando el admin elige
ese canal, con el mismo flujo probado de Gmail (F1): pre-chequeo de
pausa, entrega única por borrador, eventos en auditoría y reintento
solo admin con tope. **NINGÚN envío real hecho**: todos los tests y
el smoke usan un proveedor simulado inyectado. El primer envío real
sigue pendiente de la decisión de Tomás sobre cuentas de prueba.

## Objetivo

Cerrar la Fase 2 del diseño: conexión WhatsApp Business por org
(número + ID de número + token de sistema, cifrados, con
verificación real contra la Graph API de Meta) y envío por WhatsApp
al aprobar con canal `whatsapp`, incluido el control de la ventana
de 24 horas (`window_closed`) y la UI completa (formulario de
conexión, radio habilitado en aprobar, tarjeta con estado real).

## Acciones

### Servidor

- `app/src/sending.ts`: `SendErrorCode` suma `'window_closed'`.
  Nueva interfaz `WhatsAppProvider` (`verify` + `send`) análoga a
  `MailProvider`, y adaptador real `WhatsAppCloudProvider` por fetch
  a la Graph API (`v26.0`, constante `WHATSAPP_GRAPH_API_VERSION`
  para subirla sin tocar cada llamada): verificación = lectura del
  número (`display_phone_number`); envío = `POST /{id}/messages`
  con texto libre; el error 131047 de Meta se mapea a
  `window_closed`, 401/403 a `connection_error`, resto a
  `provider_error`. Timeout 15 s, igual que Gmail.
- `app/src/domain.ts`: esquema `whatsappConnectionSchema`
  (número con la misma regla que el teléfono del contacto, ID de
  número y token no vacíos). El token nunca se devuelve ni se
  muestra: se guarda cifrado con la clave existente.
- `app/src/routes.ts`:
  - `POST /api/connections/whatsapp` (solo admin): valida, exige
    clave de cifrado (sin ella, 503 `not_configured`, fail-closed),
    verifica contra el proveedor real o simulado y guarda la
    conexión. Con verificación ok → `connected` + número
    verificado; con fallo → fila en `error` con el motivo (sin
    secretos) + 409 `connection_error` (así se puede re-verificar
    tras corregir los datos en Meta). La respuesta nunca incluye
    el secreto (`connectionOut`, como Gmail).
  - `POST /api/connections/:id/verify` extendido a WhatsApp
    (antes solo Gmail): re-verifica y actualiza estado, número y
    fecha; con fallo deja `error` + 409.
  - `POST /api/connections/:id/disconnect` ya era genérico: sirve
    para WhatsApp sin cambios (revoked, secreto borrado).
  - `attemptDelivery` ahora despacha por canal: Gmail igual que
    antes; WhatsApp verifica conexión `connected`, descifra,
    envía el cuerpo vigente del borrador (ni más ni menos) al
    teléfono de la oportunidad y registra `sent` +
    `provider_message_id` o `failed` + código. El destinatario del
    evento es el teléfono (la vista de Actividad lo enmascara por
    la clave `recipient`). Sin teléfono en el reintento →
    `connection_error` (el aprobar ya lo bloquea antes).
  - `decideDraft`: se eliminó el 409 fijo de F1 para WhatsApp. El
    pre-chequeo de pausa (`agent_paused`, ANTES de decidir) sigue
    primero; luego conexión `connected` o 409
    `channel_unavailable` sin decidir; luego, para WhatsApp,
    teléfono presente o 409 `channel_unavailable` sin decidir.
  - `POST /api/deliveries/:id/retry` ya era agnóstico al canal:
    sirve para WhatsApp sin cambios (solo admin, solo `failed`,
    tope `send.retry.max_attempts=3`, nunca reenvía una `sent`).
- `app/src/server.ts`: `whatsappProvider` inyectable, igual que
  `mailProvider`. Sin proveedor inyectado se construye el real.
- **Sin variables globales nuevas**: las credenciales de WhatsApp
  son por org y usan `CONNECTION_ENCRYPTION_KEY`, ya declarada
  `sync: false` en `render.yaml`. No se tocó `render.yaml`.
- **Sin cambios en `db.ts`**: el agente «Respuesta y propuesta»
  ya tenía el paso `send` desde F1 (`steps: ['draft', 'send']`);
  no se duplicó. Tampoco se tocó clasificación, dedup, tareas ni
  vencimiento de borradores.

### Cliente

- `features/aprobaciones/ApprovalsView.tsx`: `decideDraft`
  acepta `'gmail' | 'whatsapp' | null`; el radio WhatsApp se
  habilita solo con conexión WhatsApp `connected` (muestra el
  número) y pasa `channel='whatsapp'`; preselección: Gmail si está
  conectado, si no WhatsApp si está conectado, si no ninguno. El
  detalle de entrega ya mostraba «Enviado por WhatsApp» (F1 lo
  dejó genérico); ahora los feedbacks son por canal y el fallo
  `window_closed` muestra la sugerencia de contactar por Gmail
  manualmente (ver Pregunta abierta).
- `features/integraciones/IntegrationsView.tsx`: formulario solo
  admin en el detalle de WhatsApp (número Business, ID de número,
  token como contraseña, que se limpia al conectar); tarjeta con
  estado REAL igual que Gmail (`connected` → «Disponible» +
  número; sin conexión → «Disponible próximamente»; `error` →
  motivo); detalle de conexión con estado, capacidades,
  credenciales (sin secretos) y desconexión. Catálogo: WhatsApp
  sigue `coming_soon` en el registro y su estado visible lo da
  `GET /api/connections`, exactamente como Gmail en F1.
- `client/src/lib/mask.ts`: **sin cambios**. La clave `recipient`
  ya enmascaraba teléfonos desde F1 (`+549***5678`); el servidor
  emite `recipient` = teléfono en `message.sent`/`message.failed`
  y la vista lo enmascara. Cubierto por
  `client/src/lib/mask.test.ts` (F1) y verificado en los tests F2
  por el lado del servidor.

### Documentación

- Este reporte (nuevo). `docs/SECURITY.md`: línea de principios
  actualizada de «F1» a «F1 Gmail, F2 WhatsApp», más la nota de
  ventana de 24 h y de que no se reenvía por otro canal.
- **No tocados**: `docs/DISENO-ENVIO-GMAIL-WHATSAPP.md`
  (especificación), app vanilla, DB real local.

## Archivos

Tocados por F2 (además de este reporte):

- `app/src/sending.ts` (proveedor WhatsApp + `window_closed`)
- `app/src/domain.ts` (esquema de registro)
- `app/src/routes.ts` (registro, verificación, envío, aprobar)
- `app/src/server.ts` (proveedor inyectable)
- `app/src/f2.test.ts` (nuevo, 14 tests)
- `app/client/src/features/aprobaciones/ApprovalsView.tsx`
- `app/client/src/features/integraciones/IntegrationsView.tsx`
- `docs/SECURITY.md` (una línea de principios)

## Pruebas

- Suite completa: **191/191 en verde** (177 base + 14 nuevas F2).
  La base 177 se re-corrió antes de empezar (verde) y después
  (verde). El test F1 «aprobar con WhatsApp da
  `channel_unavailable` sin decidir» sigue pasando: sin conexión,
  el comportamiento es el mismo.
- Tests F2 nuevos (`app/src/f2.test.ts`): registro con
  verificación ok (connected, número verificado, sin secretos en
  ninguna respuesta), registro con verificación fallida (409 +
  fila en `error` + aprobar bloqueado), registro sin clave de
  cifrado (503), solo admin + cuerpo inválido (403/400),
  re-verificación ok/error, desconexión (revoked + aprobar 409),
  aprobar con WhatsApp conectado (sent + `provider_message_id` +
  `message.sent` con `recipient` = teléfono + cuerpo exacto del
  borrador + segundo aprobar 409 sin duplicar envío), aprobar sin
  conexión (409 sin decidir), aprobar conectado sin teléfono (409
  sin decidir), agente pausado (409 `agent_paused` sin decidir),
  ventana cerrada (failed `window_closed` + `message.failed`),
  reintento admin (falla → arreglo → sent; member 403; sent no se
  reintenta), tope de reintentos (max 2 → `retry_limit`) y
  reintento con conexión caída (`channel_unavailable`).
- Build limpio (`npm run build`: tsc + Vite) y typecheck del
  cliente limpio (`tsc -p client/tsconfig.json --noEmit`).
- Vanilla intacta: `app/public/app.js` MD5
  `44ef9ae6daf62c3b9c335f6f2501256a` antes y después.
- DB real local intacta: `app/data/superinteligent.db` MD5
  `af175edc7673befe9b9f3ace3c556c12` antes y después.
- Smoke propio en copia (`/tmp/f2-smoke.db`, con proveedor
  simulado inyectado, puerto 34593, servidor cerrado al final y
  sin procesos `node` residuales): health 200, login demo 200,
  alta con teléfono 201, aprobar con WhatsApp → entrega `sent`
  (`wamid.smoke-1`, canal `whatsapp`), llamada simulada al número
  normalizado `+5491112345678` con el cuerpo del borrador,
  `message.sent` en auditoría, desconectar → revoked, aprobar sin
  conexión → 409 `channel_unavailable` con el borrador todavía
  `pending_approval`. La copia se borró tras el smoke; la DB real
  no se tocó.

## Evidencia

- `npx vitest run`: 14 archivos, 191 tests, 0 fallos.
- Smoke: `SMOKE F2 OK` con la secuencia completa arriba.
- Hashes antes/después idénticos (vanilla y DB real, ver Pruebas).
- NINGÚN envío real: proveedor simulado en tests y smoke; el
  adaptador real solo se construye sin proveedor inyectado y
  nunca se ejecutó contra Meta en esta fase.

## Decisiones

1. **Sin variables globales nuevas.** Las credenciales de
   WhatsApp son por org (número + ID + token cifrados con la
   clave existente). Justificación: el diseño lo exige (las
   variables son globales, las credenciales son por org) y la
   clave ya existe desde F1.
2. **Registro con verificación fallida persiste en `error`.**
   Alternativa (no guardar nada) se descartó: guardar la fila en
   error deja el motivo visible y permite re-verificar tras
   corregir en Meta, mismo patrón que el endpoint `/verify`.
3. **Graph API `v26.0` como constante.** Es la versión vigente
   verificada en la documentación pública de terceros al
   implementar; si Meta la depreca, se sube en un solo lugar.
4. **Error 131047 → `window_closed`.** Es el código documentado
   de Meta para texto libre fuera de la ventana de 24 h.
5. **Preselección del diálogo**: Gmail → WhatsApp → ninguno.
   Extensión natural del patrón F1; la decisión final siempre es
   del admin (variante explícita vigente).
6. **Paso `send` no duplicado**: F1 ya lo había agregado al
   agente «Respuesta y propuesta».
7. **Máscara sin cambios**: F1 ya cubría `recipient` como
   teléfono; duplicar el test no aportaba evidencia nueva.

## Riesgos

- **Token de sistema sin renovación automática.** A diferencia
  de Gmail (refresh token), el token de Meta es estático: si se
  revoca, la conexión pasa a `error` y hay que registrar de nuevo.
  No hay reintento en bucle contra un token revocado.
- **Versión de la Graph API.** Si Meta retira `v26.0`, la
  verificación y el envío fallarán como `provider_error` hasta
  subir la constante (no es un fallo silencioso: queda en
  auditoría y en el estado de la conexión).
- **Ventana de 24 h.** Es el fallo esperable más común: un
  interesado que llegó por formulario web y nunca escribió por
  WhatsApp no tiene ventana abierta. Las plantillas aprobadas de
  Meta son fase posterior y NO se diseñaron acá.
- **Primer envío real pendiente.** El adaptador real nunca se
  ejecutó contra Meta: el primer envío real exige cuentas de
  prueba y autorización expresa de Tomás (decisión pendiente del
  diseño).

## Pregunta abierta (sin resolver por decisión, no por olvido)

**La sugerencia «contactá por Gmail manualmente» choca con
`UNIQUE(draft_id)`.** Cuando un envío por WhatsApp falla con
`window_closed`, la entrega del borrador ya existe (en `failed`)
y la unicidad impide crear una segunda entrega para el mismo
borrador: SIS no puede reenviar ese borrador por Gmail. Por eso
la UI dice «manualmente»: el contacto por Gmail sería por fuera
del sistema, desde los datos completos en Oportunidades, no un
segundo envío de SIS. Si Tomás quisiera que SIS reenviara por
otro canal tras un `window_closed`, haría falta una decisión de
diseño nueva (por ejemplo, permitir cambiar el canal en el
reintento o una segunda entrega por borrador), que NO se
implementó en esta fase. **Se deja como pregunta para Tomás.**

## Próximo paso

1. Revisión de este reporte por Tomás.
2. Con su autorización expresa: snapshot push de la rama, PR y
   merge (patrón vigente), y verificación en vivo solo lectura
   (indicadores antes/después; el diálogo de aprobar con
   WhatsApp solo se verifica en vivo cuando haya un borrador
   pendiente real, sin aprobar nada en la verificación).
3. Pendiente aparte (no de esta fase): cuentas de prueba para el
   primer envío real de WhatsApp y la carga de
   `CONNECTION_ENCRYPTION_KEY` en Render (ya declarada, sin
   valor), sin la cual el registro responde 503.

## Autorización requerida

- Subir y mergear esta fase (snapshot push + PR + merge).
- No se requiere ninguna otra autorización para lo ya hecho:
  todo corrió en local con proveedores simulados, sin envíos
  reales, sin cuentas de Meta y sin secretos reales.
