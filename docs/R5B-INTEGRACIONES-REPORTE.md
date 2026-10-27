# R5b revisado + sección nueva Integraciones (catálogo honesto) — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local.

## Objetivo

**Objetivo declarado de la sección Integraciones: conectar las
herramientas de una organización con SIS para ayudar a cumplir sus
objetivos.** Es decir: la sección existe para que las herramientas
que ya usa una organización se conecten con SIS. Este objetivo
queda explícito en el subtítulo de la vista («Conecta las
herramientas de tu organización con SIS para ayudar a cumplir sus
objetivos»).

Decisión del usuario 27-oct ~17:53: catálogo honesto y «dejar el
sistema preparado para conectar las herramientas» (estructura lista
para conexiones futuras, SIN fingir conexiones). La referencia de
diseño es solo eso: diseño. Sus datos de ejemplo (Slack «Conectado
hace 2 minutos», «100% Funcionando», tokens, etc.) NO se copian.

## Acciones

### Parte A — R5b revisado: detalle del agente siempre visible

1. **Detalle siempre visible.** Al entrar a Agentes queda
   seleccionado el Orquestador Central (sin pisar una selección
   previa); si los filtros ocultan la selección, el detalle muestra
   el primer visible. La vista sigue en dos paneles (lista |
   detalle wide 480 px).
2. **Secciones en el orden pedido, SIN unificar** (corrección del
   usuario 27-oct ~17:50): Nombre (encabezado «Detalle del
   agente» + nombre + distintivos), Objetivo, Capacidades (pasos
   reales), Herramientas autorizadas (SECCIÓN PROPIA), Logs de
   Ejecución en lenguaje humanizado, Permisos y Límites. Debajo se
   mantienen Procesos Activos y Resultados recientes (datos reales;
   el usuario no los vetó).
3. **Herramientas autorizadas, redefinida:** ya no repite los pasos
   (eso era la duplicación «Capacidades» / «Capacidades y
   Herramientas Autorizadas» de R5, eliminada). Ahora significa lo
   que el usuario definió: las integraciones conectadas y
   autorizadas para ese agente. Hoy ninguna → estado honesto «Sin
   herramientas conectadas todavía» + enlace a /integraciones.
4. **Logs humanizados:** mismo mapeo de frases de R4b («Se
   ordenaron los datos del contacto», «No se encontró un contacto
   duplicado», «Se clasificó como…», etc.); para el orquestador,
   «Ejecución completada/fallida el {fecha}» (ya no «Ejecución
   opportunity.intake · Completada»). El error real de un paso
   fallido se conserva. No cambia ningún dato ni comportamiento:
   solo presentación del detalle + selección por defecto.

### Parte B — Sección nueva «Integraciones» (7ª entrada del menú)

5. **Ruta y menú:** `/integraciones` en `App.tsx` y entrada
   «Integraciones» en el menú (después de Agentes). Es la primera
   vez que el menú crece desde las 6 secciones reales.
6. **Estructura según la referencia:** encabezado + subtítulo con
   el objetivo declarado; buscador; pestañas de filtro por
   categoría (Segmented, mismo patrón que R3: Todas, Comunicación,
   CRM y ventas, Gestión de datos, Automatización, API &
   Webhooks); tarjetas agrupadas por categoría; panel de detalle
   wide 480 px al seleccionar una tarjeta (por defecto, el webhook).
7. **Menú/índice por funcionalidad + secciones agrupadas**
   (refinamiento del usuario): arriba, un índice con las 5
   categorías que desplaza a cada sección (por scroll, no por ancla
   `#`: HashRouter la interpretaría como ruta; si hay un filtro
   activo, primero vuelve a «Todas»). Debajo, cada categoría como
   sección propia con su título, una línea descriptiva de su
   funcionalidad y sus tarjetas:
   - Comunicación — Herramientas de comunicación.
   - CRM y ventas — Herramientas de gestión de clientes y ventas.
   - Gestión de datos — Herramientas de gestión de datos.
   - Automatización — Herramientas de automatización.
   - API & Webhooks — Herramientas de conexión por API y webhooks.
   Las descripciones describen para qué sirve la categoría; NO
   afirman conexiones existentes. Las categorías sin proveedores
   (Gestión de datos, Automatización) muestran «Aún no hay
   integraciones en esta categoría.»
8. **Catálogo honesto.** Verificado en código (routes.ts):
   - **Webhook de ingesta — LA ÚNICA REAL, estado
     «Disponible»** (nunca «Conectado» con sinc inventada).
     Capacidades reales: recepción de oportunidades desde
     sistemas externos, firma HMAC obligatoria (401 sin firma
     válida), idempotencia (una misma entrega no duplica),
     límite diario de oportunidades (429). Salud medida con
     recepciones reales: cantidad de oportunidades con source
     `webhook` y última recepción (o «Sin recepciones
     todavía»); NO se muestra porcentaje (no hay medición de
     disponibilidad). Logs de eventos reales: eventos
     `opportunity.created` de auditoría sobre esas
     oportunidades. Credenciales: la URL de ingesta y el secreto
     HMAC los gestiona PENSIA como operador y NO se exponen en
     la interfaz (sin botón Mostrar/Copiar, sin endpoint que
     devuelva secretos). Permisos: no usa OAuth; la autenticación
     es por firma HMAC.
   - **Slack, Microsoft Teams, Gmail, Zoom, Salesforce, HubSpot,
     Pipedrive — TODAS «Disponible próximamente».** Sin última
     sinc, sin salud inventada, sin credenciales. Botón
     «Notificar» DESHABILITADO con la nota de que el aviso de
     disponibilidad aún no está disponible (no se inventa un
     registro de avisos). Sus capacidades se rotulan
     explícitamente «Capacidades previstas», no funciones
     existentes. Su detalle muestra el estado honesto + lo
     previsto + la nota de que la conexión llegará proveedor por
     proveedor. La relay de contacto por Apps Script NO es una
     integración de cliente y no cuenta.
   - Iconos Lucide genéricos, NUNCA logos de marcas copiados.
9. **Enlace entre ambas partes:** la sección Herramientas
   autorizadas del detalle del agente enlaza a /integraciones.
10. **Solo cliente, sin endpoints nuevos.** El estado del webhook
    se deriva de endpoints existentes (opportunities con source,
    audit). Si un dato falta y no es derivable, se documenta como
    límite (ver «No construido»).

### Qué significa «sistema preparado»

El catálogo es un registro tipado en el cliente
(`INTEGRATIONS` en `IntegrationsView.tsx`): cada entrada tiene
id, nombre, categoría, icono genérico, estado, resumen,
capacidades y nota de OAuth. Agregar un proveedor futuro = una
entrada en el registro + su flujo OAuth y su fuente de estado
real; la vista, los filtros, el índice y el detalle NO se
reescriben. Cuando un proveedor tenga conexión real, su entrada
pasa a status `'available'` y su detalle se alimenta de endpoints
reales, como hoy hace el webhook.

### Correcciones de tipos preexistentes (hallazgo al verificar)

Al correr el chequeo de tipos del cliente aparecieron 3 errores
preexistentes de R5 (el informe de R5 decía typecheck limpio, pero
`npm run build` solo tipa `src/`, no `client/`): `FilterBar`
exigía `onClear` y Agentes no lo pasaba, y `oppLabel` no aceptaba
`null`. Correcciones solo de tipos, sin cambio de
comportamiento: `onClear` pasó a opcional y el botón «Limpiar»
de la barra solo se dibuja si se pasa (las vistas que ya lo
pasaban no cambian; las que renderizan su propio «Limpiar»
condicional dejan de tener un botón muerto); `oppLabel` acepta
`null`. El chequeo del cliente ahora está limpio.

## Archivos

- `app/client/src/features/agentes/AgentsView.tsx` (detalle
  siempre visible, secciones en orden, Herramientas autorizadas
  propia con enlace, logs humanizados, corrección de tipo
  `oppLabel`).
- `app/client/src/features/integraciones/IntegrationsView.tsx`
  (NUEVO: vista + registro del catálogo).
- `app/client/src/App.tsx` (ruta `/integraciones`).
- `app/client/src/components/layout/AppLayout.tsx` (7ª entrada
  del menú).
- `app/client/src/components/ui/filter-bar.tsx` (`onClear`
  opcional; botón condicional).
- `docs/R5B-INTEGRACIONES-REPORTE.md` (este informe).

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no
  hay tests nuevos de servidor; el cliente no tiene runner de
  tests en este repo).
- Build limpio; chequeo de tipos del cliente
  (`tsc -p client/tsconfig.json --noEmit`) limpio, incluyendo
  las 3 correcciones preexistentes de arriba.
- `node --check public/app.js` OK; vanilla intacta (MD5
  `44ef9ae6daf62c3b9c335f6f2501256a`); DB real local intacta
  (MD5 `af175edc7673befe9b9f3ace3c556c12`); ningún proceso en
  pie al terminar.
- Marcadores en el JS construido: «Integraciones»,
  «Disponible próximamente», «Sin herramientas conectadas».
  AUSENTES a propósito: «Hace 2 minutos», «100% Funcionando» y
  cualquier «Conectado» aplicado a Slack/Teams/Gmail/Zoom/
  Salesforce/HubSpot/Pipedrive (la única aparición de la palabra
  es el estado honesto negativo «Sin herramientas conectadas
  todavía» y comentarios del código, que no llegan al bundle).
- Smoke propio en copia de DB (puerto 3475, matado por PID
  exacto): health OK, login OK, 3 oportunidades (1 por webhook,
  última recepción real 2026-10-26T01:01:55Z), 12 eventos de
  auditoría (3 opportunity.created), 5 agentes. La derivación del
  webhook que la vista usa quedó verificada contra datos reales.

## Evidencia

- Vista nueva: `app/client/src/features/integraciones/IntegrationsView.tsx`.
- Vista modificada: `app/client/src/features/agentes/AgentsView.tsx`.
- Sin verificación visual local (no hay navegador en la VM):
  queda la verificación en vivo post-merge (detalle del agente
  siempre visible, logs humanizados, Integraciones con el
  webhook Disponible y el resto Disponible próximamente, índice
  y secciones agrupadas), solo lectura.

## Decisiones

- El webhook es «Disponible», no «Conectado»: disponible
  describe que el mecanismo existe y funciona; «conectado»
  implicaría una contraparte concreta sincronizando, que no se
  puede afirmar desde la interfaz.
- Las capacidades previstas se listan (no se ocultan) pero
  rotuladas como previstas: ocultar el catálogo futuro haría la
  sección inútil como vidriera; mostrarlo como existente sería
  ficticio. El rótulo es el límite.
- El botón «Notificar» existe deshabilitado (como en la
  referencia) en vez de omitirse: así queda visible que el aviso
  es una función pendiente, no un descuido.

## Riesgos

- La vista de Integraciones trae oportunidades y auditoría
  completas en cliente (como Agentes): con volúmenes grandes,
  convendría paginar o limitar esa carga. Con el volumen actual
  (5 oportunidades en la demo) no es problema y no se recortaron
  datos reales.
- Si un proveedor futuro se marca `'available'` sin endpoints
  reales que lo respalden, el catálogo dejaría de ser honesto:
  la regla es no cambiar el estado sin la fuente de datos.

## Próximo paso

Aprobar subir y mergear (mismo procedimiento que R5, solo
verificación de conservación de PNG). Verificación visual en
vivo post-merge, solo lectura, como se detalla en Evidencia.

## Autorización requerida

Aprobar subir y mergear R5b + Integraciones.

## Explícitamente NO construido

- OAuth por proveedor (Slack, Teams, Gmail, Zoom, Salesforce,
  HubSpot, Pipedrive): cada uno exige su app registrada, flujo
  de autorización, tokens y permisos propios.
- Almacenamiento cifrado de tokens/credenciales de terceros.
- Sincronizaciones con herramientas externas (enviar/recibir
  datos, webhooks salientes, actualización de estados).
- Registro de avisos «Notificar» (botón deshabilitado a
  propósito).
- Conexiones reales más allá del webhook de ingesta.
- Ningún endpoint nuevo de servidor.
