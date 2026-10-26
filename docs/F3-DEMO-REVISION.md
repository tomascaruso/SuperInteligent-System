# F3-DEMO — Revisión de la demo como cliente potencial — Informe

## Estado general

IN_PROGRESS. Revisión entregada: recorrido en vivo de la demo pública
con ojos de un dueño de agencia/consultora B2B que evalúa contratar el
servicio de PENSIA. Pendiente la revisión del propio Tomás (criterio de
aceptación del BACKLOG) y la decisión sobre qué hallazgos corregir
primero.

## Objetivo

Criterio del BACKLOG: la demo debe ser comprensible en menos de
10 minutos, profesional y creíble, vista como potencial cliente.
Esta revisión mide exactamente eso.

## Método

Recorrido en vivo de solo lectura sobre la demo pública del 26-oct-2026
(https://superinteligent-system-demo-9e49.onrender.com), en orden:
pantalla de acceso, Inicio, Oportunidades, Tareas, Aprobaciones
(diálogo abierto y cerrado con Cancelar), Actividad y ejecuciones, y
formulario de invitación (abierto y cerrado sin enviar). No se aprobó
ni rechazó ningún borrador, no se reintentó ninguna ejecución, no se
creó ni modificó nada y no se envió ningún formulario. Sesión
restaurada al final. Los textos citados son los visibles en pantalla.

## Hallazgos: qué CONVENCE

- **La idea central se entiende en el inicio.** «Centro de
  operaciones» — «Qué requiere atención y qué está pasando.», con
  tarjetas claras: «3 Oportunidades», «3 Tareas pendientes»,
  «1 Aprobaciones pendientes», «0 Ejecuciones fallidas». De un vistazo
  se entiende que hay trabajo comercial pendiente y que nada falló.
- **El control humano sobre lo automático es el punto más fuerte de
  confianza.** En Aprobaciones: «Revisá cada borrador antes de decidir.
  Aprobar actualiza el estado y audita; no envía mensajes.» En el
  borrador: «Alcance de la decisión: actualiza el estado de la
  oportunidad y registra la decisión en la auditoría. No envía ningún
  mensaje.» El diálogo lo repite al aprobar. Queda clarísimo que
  aprobar NO envía nada: solo cambia el estado y deja registro.
- **El borrador de ejemplo suena a mensaje comercial real y usable**
  (saludo a Lucía Fernández de Empresa Ejemplo, propuesta de llamar en
  menos de 24 h, cierre del equipo comercial).
- **Hay trazabilidad visible.** En «Borradores decididos» figura quién
  decidió y cuándo (ej.: «Aprobada — Oportunidad relacionada: Ana Ruiz
  · general — Decidido por demo@agenciamartin.demo el 2026-10-26
  13:18:19»). Cada decisión queda registrada.
- **Las tareas hablan en lenguaje de negocio con plazos concretos**
  («Llamar en menos de 24 h — vence 2026-10-27», «Enviar propuesta en
  48 h — vence 2026-10-28», «Enviar mensaje de calificación — vence
  2026-10-29», con botón «Marcar hecha»).
- **Queda en claro que los datos son de ejemplo.** En todas las
  pantallas: «Orquestador de operaciones comerciales — demo con datos
  ficticios.», empresa «Agencia Martín (demo)», contacto «Empresa
  Ejemplo». Nadie puede confundirlos con un negocio real.
- **Se ve que se puede cargar trabajo a mano**, no solo automático:
  «Nueva oportunidad (alta manual)» con nombre, correo, empresa,
  mensaje y «Crear oportunidad».

## Hallazgos: qué CONFUNDE

- **La pantalla de acceso es un login seco.** Solo dice
  «SuperInteligent System» y «Orquestador de operaciones comerciales —
  demo con datos ficticios.», con «Acceso», «Correo», «Contraseña» y
  «Entrar». No dice qué problema resuelve, para quién es ni cómo
  funciona. Un visitante que nunca vio el producto no entiende qué está
  por ver ni por qué le serviría.
- **La misma pantalla expone jerga de desarrollo y las credenciales de
  la demo** («Demo sembrada», referencia a `npm run seed`). Para un
  empresario eso no significa nada, y ver una contraseña publicada en
  la pantalla de acceso da sensación de producto sin terminar y poco
  cuidado con la seguridad, aunque sea una demo.
- **El formulario de invitación es un callejón sin salida.** «PENSIA da
  de alta a cada empresa con una invitación: sin invitación no se puede
  crear una organización. Pegá el código que recibiste para crear la
  tuya.» No hay forma de pedir ese código: ni contacto, ni «pedir
  acceso», ni enlace a PENSIA. Es la única mención de PENSIA en toda la
  demo.
- **El flujo no está explicado en ningún lado.** Que entra algo, se
  clasifica, genera una tarea y alguien aprueba hay que inferirlo
  uniendo pantallas. La única evidencia del proceso automático está
  escondida en «Ver pasos», en inglés técnico («Completada normalize»,
  «Completada dedup · duplicado: no», «Completada classify · categoría
  general · prioridad Baja», «Completada upsert», «Completada
  next_action», «Completada draft», bajo «opportunity.intake v1» y
  códigos como «(eb5ffbfa)»). Un empresario no sabe qué significa
  ninguno de esos pasos.
- **No hay sección de Agentes ni explicación de qué hace cada uno.**
  La única mención es la etiqueta «Agente: Seguimiento» en las tareas.
  No se sabe cuántos agentes hay, qué hace cada uno ni qué hace solo
  el sistema.
- **«Actividad y ejecuciones» parece un panel técnico**, no una
  supervisión para un dueño: «Trazabilidad de las operaciones del
  sistema.», «Auditoría reciente» con líneas como «2026-10-26 02:22:07
  — seed: Oportunidad creada» y «seed: Borrador creado». «seed» es un
  actor técnico que no debería ver un cliente.
- **«Actividad reciente» del inicio promete «qué está pasando» pero
  solo muestra inicios de sesión**, repetidos una y otra vez. Nada
  sobre oportunidades, tareas o ventas del día.
- **Las tareas no dicen a quién corresponden.** «Llamar en menos de
  24 h — Agente: Seguimiento — vence 2026-10-27» no muestra el contacto
  ni la empresa. El dueño no sabe a quién hay que llamar sin ir a
  buscarlo a otra pantalla.
- **Detalles sin pulir.** «1 borrador(es) pendiente(s) de aprobación —
  Revisar» (pluralización de plantilla, poco profesional); «Canal: No
  disponible» en el borrador pendiente (no se explica por qué canal
  entró el contacto); categorías mezcladas («general», «marketing»,
  «automatización»; «general» no dice qué quiere el cliente).
- **Las fechas y horas se muestran en UTC sin indicarlo.** Un inicio de
  sesión de las 15:59 hora argentina figura como «2026-10-26 18:59:37»:
  el usuario local ve horas 3 horas por delante de su reloj sin
  advertencia.

## Hallazgos: qué FALTA para que un cliente diga «quiero esto»

1. Una explicación en la pantalla de acceso: qué problema resuelve
   (contactos que se pierden, seguimientos que no se hacen), para quién
   es (agencias/consultoras B2B) y cómo funciona en 3 pasos, antes de
   pedir usuario y contraseña.
2. Un paso siguiente comercial en algún lugar de la demo: contacto,
   «Quiero una demo con mis datos», y qué incluye el servicio (precios
   o al menos «desde…»). Hoy el recorrido termina sin que el
   interesado pueda hacer nada.
3. Una forma de pedir la invitación: hoy «sin invitación no se puede
   crear una organización» y no hay cómo conseguirla.
4. Una explicación en lenguaje de negocio del proceso automático y de
   cada agente (traducir los 6 pasos a «recibe el contacto, evita
   duplicados, lo clasifica, le pone prioridad, crea la tarea y redacta
   el borrador») y una sección visible de agentes.
5. Vincular cada tarea con su oportunidad/contacto, y mostrar por qué
   canal entró cada oportunidad (hoy «Canal: No disponible»).
6. Quitar la jerga de desarrollo de la vista pública («npm run seed»,
   «sembrada», «seed», «opportunity.intake v1», UUID entre paréntesis)
   o esconderla en una vista técnica.
7. Un recorrido guiado dentro de la demo («así entra un contacto, así
   se clasifica, así lo aprobás») para que el valor se entienda sin
   tener que adivinarlo.

## Veredicto

En parte sí, pero no alcanza para vender. En menos de 10 minutos se
entiende la mecánica y el control: entran contactos, quedan clasificados
con categoría y prioridad, se generan tareas con vencimiento y
borradores de respuesta, y una persona aprueba antes de que pase nada,
sin que el sistema envíe mensajes solo. Esa es la parte que genera
confianza. Pero NO se entiende qué hace «inteligente» al sistema (la
automatización solo se ve en jerga técnica), NO se sabe quién es
PENSIA, qué incluye el servicio, cuánto cuesta ni cómo conseguirlo para
su empresa. La demo funciona como muestra del producto, no como
argumento de venta: un interesado se va con la idea, pero sin ningún
camino para contratar. Con una pantalla de acceso que explique el
problema y el servicio, una traducción a negocio del proceso automático
y un botón de «Quiero esto» con contacto, la misma demo sí podría
cerrar el interés en 10 minutos.

## Recomendaciones priorizadas

- **Primero (sin código o con poco código):** texto de la pantalla de
  acceso (problema, público, 3 pasos), quitar las credenciales y la
  jerga de desarrollo de la vista pública, y agregar un contacto o
  «Quiero una demo» visible.
- **Después:** traducir los pasos del proceso a lenguaje de negocio,
  mostrar contacto/empresa en cada tarea, y corregir la pluralización
  y las horas (zona horaria local o etiqueta UTC).
- **Más adelante:** sección visible de agentes y recorrido guiado
  dentro de la demo.

## Riesgos

- Esta revisión la hizo Loki como cliente potencial; el criterio del
  BACKLOG pide la revisión del propio Tomás, que sigue pendiente.
- Varios hallazgos (canal no disponible, tareas sin contacto, horas en
  UTC) tocan el backend o el formato de datos, no solo textos: su costo
  real se ve al implementarlos.

## Corrección aplicada 26-oct-2026 (pantalla de acceso)

Primera corrección de la lista priorizada, solo textos, sin cambios de
funcionalidad (commit local pendiente de subir y mergear):

- La pantalla de acceso ahora explica el problema, el público y el
  funcionamiento en 3 pasos («Qué hace»), antes del formulario de
  acceso. Cubre la recomendación 1.
- La línea de la cuenta demo ya no usa jerga de desarrollo («sembrada»,
  referencia a `npm run seed`): ahora dice «Cuenta de demostración».
  La contraseña sigue visible porque es la única vía de entrada a la
  demo pública; quitarla exigiría otro mecanismo de acceso (por
  ejemplo, un botón «Entrar a la demo»), decisión pendiente de Tomás.
  Cubre parcialmente la recomendación 6.
- Pendiente de esta primera tanda: el contacto visible o «Quiero una
  demo» (recomendaciones 2 y 3), porque falta definir el canal de
  contacto de PENSIA (correo, WhatsApp u otro).

## Corrección aplicada 26-oct-2026 (formulario de contacto)

Segunda corrección, con backend y frontend (commit local pendiente de
subir y mergear):

- Formulario «Quiero una demo para mi empresa» en la pantalla de
  acceso (nombre, correo, empresa opcional, mensaje) que envía a
  `POST /api/contact`. El correo de destino vive SOLO en variables de
  entorno del servidor (`CONTACT_TO` y `CONTACT_SMTP_*`, declaradas en
  `render.yaml` con `sync: false`, sin valores): nunca aparece en el
  código, en la página, en ningún endpoint ni en el repo. Verificado
  por búsqueda en el repo servido.
- Sin SMTP configurado, el contacto está cerrado: `GET
  /api/contact/status` responde `{ enabled: false }`, el formulario
  queda oculto y el envío responde 503. Nada de formularios muertos a
  la vista.
- Anti-spam: límite de 5 mensajes por hora por IP, campo honeypot y
  validación (nombre 1–100, correo válido, mensaje 1–2000). El mensaje
  no se guarda en la base: solo se envía.
- `nodemailer` en `dependencies` y sus tipos también en `dependencies`
  (regla del fix de build: lo que `tsc` necesita no vive en
  `devDependencies`); simulación de instalación de producción en
  carpeta limpia: build OK, sin paquetes de desarrollo.
- Pruebas: 83/83 en verde (11 nuevas de contacto: composición,
  configuración, estado, validación, honeypot, 503, límite y 502 con
  SMTP inalcanzable; ninguna respuesta expone el destino). El envío
  real con SMTP queda pendiente de verificar tras cargar las variables
  en Render y enviar un mensaje de prueba.
- Pendiente: cargar en Render `CONTACT_SMTP_HOST`, `CONTACT_SMTP_PORT`,
  `CONTACT_SMTP_USER`, `CONTACT_SMTP_PASS`, `CONTACT_TO` y
  `CONTACT_FROM` (para Gmail: host smtp.gmail.com, puerto 587, usuario
  de Gmail y contraseña de aplicación creada en la cuenta de Google;
  nunca pegar secretos en el chat).

## Prueba de envío 26-oct-2026: fallo y corrección

La primera prueba de envío (mensaje «Prueba Loki» desde la demo) NO se
completó: tras pulsar «Enviar mensaje», el botón quedó deshabilitado
de forma permanente y la página no mostró ni confirmación ni error,
incluso después de más de 60 segundos, en dos intentos. Diagnóstico: el
botón solo queda así mientras la petición no se resuelve; el servidor
estaba en pie (la página y el estado del contacto respondían) y el
formulario era visible, así que la traba estaba en el envío SMTP, que
con los timeouts por defecto de nodemailer puede colgarse minutos sin
responder.

Corrección (commit local pendiente de subir y mergear):

- `createContactTransporter` fija timeouts explícitos y cortos
  (conexión 10 s, saludo 10 s, socket 20 s): una traba se convierte en
  un 502 visible en segundos, no en un botón trabado.
- El frontend corta la espera a los 30 s (AbortController) y muestra
  «El envío tardó demasiado; probá de nuevo más tarde.» como red de
  seguridad.
- Test nuevo: el transporter lleva esos timeouts.

Si tras esta corrección el reintento sigue fallando con 502, la causa
ya no será una traba sino un rechazo o bloqueo de la conexión SMTP
(por ejemplo, egress de Render o credenciales), y el paso siguiente
será revisar los logs de Render o cambiar de proveedor de envío. La
entrega real sigue sin verificar.

## Corrección aplicada 26-oct-2026 (lenguaje de negocio y contexto)

Tercera corrección, la tanda «Después» de la lista priorizada
(backend y frontend, commit local pendiente de subir y mergear):

- **Pasos en lenguaje de negocio.** Los pasos se siguen guardando con
  su nombre técnico, pero la pantalla muestra su traducción: «Recibe y
  ordena el contacto», «Revisa si ya existe», «Lo clasifica y le pone
  prioridad», «Registra la oportunidad», «Crea la tarea con
  vencimiento», «Redacta el borrador de respuesta». El proceso
  «opportunity.intake v1» se muestra como «Captación de oportunidades
  v1». Los nombres no mapeados se muestran tal cual (no se inventa
  nada). Los códigos cortos de ejecución/proceso (8 caracteres, con el
  identificador completo en el título) se mantienen: son referencias
  de soporte, no jerga.
- **Tareas con contacto y empresa.** `GET /api/tasks` ahora trae
  `contact_name` y `company` con un join a su oportunidad, y la lista
  muestra «Para: Lucía Fernández (Empresa Ejemplo)». Sin cambios en
  la base ni en los contratos previos: solo dos campos agregados.
- **Canal del borrador.** `GET /api/drafts` ahora trae
  `opportunity_source` y el borrador muestra «Canal: Alta manual»
  (alta manual) o «Canal: Entrada externa» (webhook/integración) en
  vez de «No disponible». El alta manual por la API ya guardaba
  `source: 'manual'` por defecto; el webhook guarda `'webhook'`.
- **Pluralización real.** «1 borrador pendiente de aprobación» y «1
  ejecución fallida» en singular; plural solo cuando corresponde. Se
  acabó el «borrador(es) pendiente(s)».
- **Horas en zona local.** El servidor sigue guardando UTC, pero las
  fechas y horas se muestran en la zona horaria del navegador (antes
  se mostraba el UTC crudo, 3 h por delante del reloj argentino). Los
  vencimientos también se calculan y muestran en fecha local.
- Pruebas: 87/87 en verde (2 nuevas: tarea con contacto/empresa,
  borrador con canal; 1 test viejo actualizado, que esperaba el texto
  fijo «Canal: No disponible»). Typecheck, build y sintaxis de app.js
  limpios; smoke con servidor real: `/health` exacto y el app.js
  servido trae las etiquetas nuevas.
- Pendiente de esta tanda: sección visible de agentes, recorrido
  guiado, la revisión del propio Tomás (criterio de aceptación), la
  categoría «general» (decisión de clasificación, no de texto) y que
  «Actividad reciente» muestre más que inicios de sesión (es un
  problema de qué se audita, no de formato).

## Corrección aplicada 26-oct-2026 (sección visible de agentes)

Cuarta corrección, la primera de la tanda «Más adelante» (solo
frontend, sin cambios de backend ni de base; commit local pendiente de
subir y mergear):

- Vista nueva «Agentes» en la navegación (sexta vista), con una
  tarjeta por agente: qué hace en lenguaje de negocio, los pasos
  reales que ejecuta traducidos con las mismas etiquetas de la
  corrección anterior, y cuántas tareas abiertas tiene a cargo (dato
  real de `/api/tasks`, contado por agente; sin tareas, cero, no se
  inventa trabajo). QA y políticas muestra «Sin pasos propios en el
  proceso actual: revisa, no ejecuta», tal como lo define el catálogo.
- La sección aclara que el sistema no es una persona ni un chat, que
  son agentes con reglas fijas y que ninguno envía mensajes solo.
- El endpoint `/api/agents` ya existía desde C4 (nombre, descripción y
  pasos reales); no hizo falta tocar el backend.
- Pruebas: 88/88 en verde (1 nueva: la vista existe en la página
  servida y su descripción en el app.js servido). Typecheck, build y
  sintaxis de app.js limpios; smoke con servidor real: `/health`
  exacto, la página trae `view-agentes` y el app.js trae la vista.
- Pendiente: recorrido guiado, la revisión del propio Tomás (criterio
  de aceptación), la categoría «general» y «Actividad reciente».

## Próximo paso

Que Tomás lea esta revisión, haga su propia pasada como cliente
potencial y decida qué hallazgos corregir primero. Con eso, F3-DEMO
pasa a PASS o se abre el trabajo de corrección correspondiente.

## Autorización requerida

Subir este informe a la rama, crear el PR y mergear a `main`.
