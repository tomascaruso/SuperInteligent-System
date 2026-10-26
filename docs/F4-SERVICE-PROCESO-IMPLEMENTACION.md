# F4-SERVICE — Proceso de implementación por cliente

## Estado general

IN_PROGRESS. F4-SERVICE (BACKLOG, Media, PLANNED → IN_PROGRESS)
depende de F4-TEMPLATE: la plantilla ya existe y su guía de
configuración también (`docs/F4-TEMPLATE-GUIA-CONFIGURACION.md`).
Este documento es el proceso operativo para implementar un cliente
sobre esa plantilla: qué relevar, qué adaptar, cómo verificar y
cómo entregar. No es un documento comercial (no define precios,
plazos de venta ni acuerdos de nivel de servicio): es el checklist
que hace que cada implementación salga igual de cuidada que la
anterior.

## Principios (no negociables)

- El núcleo no se bifurca por cliente (D13). Lo que sirve a dos
  clientes va al núcleo con su test; lo que sirve a uno va a su
  capa de contenido (ver la guía).
- Una aprobación no es un envío: el sistema nunca envía mensajes
  solo. Eso se dice al cliente desde el primer día, no se descubre
  en la entrega.
- Ningún secreto se pide ni se pasa por chat: variables, tokens y
  secretos de webhook van por el entorno del hosting o por un canal
  seguro.
- La demo pública no se usa para clientes: cada cliente tiene su
  propio despliegue y sus propios datos.

## Fase 0 — Relevamiento (antes de tocar nada)

Preguntas mínimas, con las respuestas por escrito antes de adaptar:

1. ¿Qué negocio es y quién es su público? (Define el texto de la
   pantalla de acceso y el recorrido guiado.)
2. ¿Por qué canales entran los contactos hoy? (Alta manual, webhook
   desde un formulario, ambos. Si hay webhook: ¿qué sistema lo
   dispara?)
3. ¿Qué temas llegan? (Las categorías del vertical: 3 a 6 temas
   más `general`. Ver el ejemplo Inmobiliaria:
   `docs/F4-TEMPLATE-VERTICAL-INMOBILIARIA.md`.)
4. ¿Qué hace urgente a un mensaje y qué indica presupuesto? (Las
   señales de `URGENT` y `BUDGET` del rubro.)
5. ¿Cuál es el siguiente paso por prioridad? (Tarea y plazo por
   alta/media/baja: hoy 24/48/72 h, pero el título cambia por
   rubro.)
6. ¿Quién aprueba? (El admin que aprueba/rechaza borradores y
   reintenta ejecuciones; los members no aprueban.)
7. ¿Cuántos contactos por día, en orden de magnitud? (Define
   `MAX_OPPORTUNITIES_PER_DAY` y si el plan gratuito alcanza.)
8. ¿Quiere formulario «Quiero una demo»/contacto? (Si sí, relay por
   Apps Script como en `docs/CONTACTO-RELAY-REPORTE.md`; si no, el
   formulario queda oculto por diseño.)
9. ¿Qué tono y qué datos van en el borrador? (El texto de
   `draftBody` adaptado al rubro.)

Si alguna respuesta falta, la implementación no avanza a la Fase 1.

## Fase 1 — Diseño de la adaptación (checklist por área)

El criterio de aceptación de F4-SERVICE es este checklist. Cada
fila: qué decidir, dónde se cambia y cómo se verifica.

### Workflows

- [ ] ¿Qué proceso se implementa? (Hoy: un solo workflow,
  `opportunity.intake` v1, 6 pasos. Si el cliente pide otro
  proceso, es trabajo de núcleo, no de adaptación: se evalúa aparte
  y no se promete en la implementación.)
- [ ] ¿Los 6 pasos en lenguaje de negocio describen el rubro?
  (`stepLabel` en `app/public/app.js`; si no, se adaptan los
  textos, no los pasos.)
- [ ] Verificación: un mensaje de ejemplo recorre los 6 pasos y se
  ven en «Ver pasos» con etiquetas de negocio.

### Agentes

- [ ] ¿Los 5 agentes (Captación, Calificación, Respuesta y
  propuesta, Seguimiento, QA y políticas) cubren el rubro? (En la
  mayoría de los casos sí: cambian los textos, no los roles.)
- [ ] ¿Las descripciones en lenguaje de negocio y los conteos de
  tareas abiertas son correctos? (Vista Agentes.)
- [ ] ¿QA y políticas sigue sin pasos propios? (Revisa, no ejecuta:
  eso no cambia por cliente.)
- [ ] Verificación: la vista Agentes muestra los 5 agentes con su
  rol, sus pasos traducidos y sus conteos reales.

### Herramientas

- [ ] ¿Qué herramientas reales usa el flujo? (Hoy: los 6 pasos del
  workflow. No se inventan integraciones externas: si el cliente
  pide una herramienta externa, es trabajo aparte con su propio
  alcance.)
- [ ] ¿El catálogo de herramientas (`GET /api/tools`) refleja solo
  lo que existe?
- [ ] Verificación: la lista de herramientas coincide con los pasos
  del proceso, sin capacidades ficticias.

### Políticas

- [ ] ¿Quién aprueba? (Admin únicamente; `draft.approval.admin_only`
  no se relaja por cliente.)
- [ ] ¿Vencimiento de borradores? (Hoy 7 días;
  `draft.expiry_days`; si el cliente pide otro plazo, se cambia el
  valor, no la mecánica.)
- [ ] ¿Reintentos? (Solo admin, tope 3 por raíz;
  `retry.admin_only`, `retry.max_attempts`.)
- [ ] Verificación: un member no puede aprobar ni reintentar (403);
  un borrador vencido o desactualizado no se puede aprobar (409).

### Integraciones

- [ ] ¿Alta manual, webhook o ambas? (Webhook: secreto HMAC por
  cliente, header `x-signature`, idempotencia.)
- [ ] ¿Formulario de contacto? (Relay propio por HTTPS con token;
  sin relay, formulario oculto y 503 — fail-closed.)
- [ ] ¿Despliegue? (Render + Neon u otro; variables de la guía,
  sin secretos en el repo.)
- [ ] Verificación: un mensaje por cada canal habilitado llega,
  clasifica y genera tarea y borrador; el contacto llega al correo
  del operador (una sola prueba por corrida, con hora registrada).

## Fase 2 — Configuración (según la guía)

Aplicar `docs/F4-TEMPLATE-GUIA-CONFIGURACION.md` en orden:
variables de entorno, organización por invitación, adaptación de
reglas y borrador, seed ficticio del vertical, textos de UI y
despliegue. Antes de cualquier merge: typecheck, build, tests y
smoke (`/health` con servidor real). Regla de build vigente: lo que
`tsc` necesita no vive en `devDependencies`.

## Fase 3 — Verificación (antes de entregar)

- [ ] Salud, acceso, alta manual y webhook (si aplica).
- [ ] Un mensaje de ejemplo por categoría principal: clasifica
  bien, crea la tarea correcta con su plazo y redacta el borrador
  del rubro.
- [ ] Aprobar y rechazar dejan auditoría; aprobar no envía nada.
- [ ] Permisos: member no aprueba ni reintenta.
- [ ] Recorrido guiado completo, sin tapar contenido, y cierre
  limpio.
- [ ] Formulario de contacto (si aplica): un solo mensaje de
  prueba, entrega confirmada en el correo del operador.
- [ ] Indicadores de Inicio coherentes con lo sembrado.

## Fase 4 — Entrega y handoff

- [ ] URL del despliegue del cliente, acceso admin y secreto de
  webhook (por canal seguro, nunca en chat).
- [ ] Guía corta para el cliente: qué hace el sistema, qué no hace
  (no envía mensajes solo), quién aprueba, dónde se ve la
  auditoría.
- [ ] Qué queda documentado en el repo del cliente: vertical
  adaptado (reglas, tareas, borrador) y decisiones tomadas, como
  se hizo con Inmobiliaria.
- [ ] Qué NO se entrega: promesas de volumen, de plazos de
  respuesta o de integraciones que no existen.

## Criterio de salida (cuándo está terminada)

La implementación está terminada cuando el checklist de la Fase 1
está completo, la verificación de la Fase 3 está en verde y el
cliente recibió la entrega de la Fase 4. Sin atajos: un ítem sin
verificar es un ítem pendiente, no un detalle.
