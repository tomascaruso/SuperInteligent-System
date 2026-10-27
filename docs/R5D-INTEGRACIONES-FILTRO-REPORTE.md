# R5d — Índice que filtra por categoría (vista única) + 4 tarjetas por categoría — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local. Solo
presentación y catálogo: ningún endpoint nuevo, ningún OAuth,
ninguna sincronización, ningún estado inventado.

## Objetivo

El usuario pidió (27-oct ~19:09) dos cambios en Integraciones:

1. Al apretar cada opción del menú de integraciones (el «Índice por
   funcionalidad»), que SOLO aparezcan las integraciones de esa
   categoría, como una vista única. Hoy apretar «API & Webhooks»
   desplazaba con scroll hasta abajo de todo y le resultaba
   incómodo.
2. Que las categorías sin integraciones queden más completas.

Con dos correcciones del usuario en el mismo pedido: son **4 EN
TOTAL por categoría (20 tarjetas)**, y en API & Webhooks van las
opciones más populares del mercado (Postman, Pipedream, Insomnia),
no capacidades genéricas.

## Acciones

### 1. El índice filtra en lugar de desplazar

En `app/client/src/features/integraciones/IntegrationsView.tsx`:

- Nuevo estado `selectedCategory`: `'Todas' | Category`, con
  `'Todas'` por defecto (vista completa agrupada, como antes).
- El índice muestra «Todas» primero y luego las 5 categorías, con
  `aria-pressed` y estilo activo (borde primario, texto en
  tinta y negrita) en la opción seleccionada.
- Al elegir una categoría, solo se renderiza esa sección (título,
  descripción y sus tarjetas): no hay scroll a otra sección porque
  no hay otra sección visible. Con «Todas» se vuelven a mostrar
  las 5 secciones agrupadas.
- El filtro se combina con la búsqueda por icono de R5c (AND):
  con una categoría seleccionada, la búsqueda filtra dentro de
  ella; con «Todas», en todo el catálogo.
- El panel de detalle sigue a lo visible: si la tarjeta
  seleccionada queda fuera del filtro, se muestra la primera
  tarjeta visible (antes quedaba fija aunque el filtro la
  ocultara).
- El mensaje de vacío sigue siendo «Sin resultados para la
  búsqueda actual» cuando el filtro combinado no deja tarjetas
  visibles.
- Se eliminó toda la lógica de scroll: `scrollToCategory`,
  `CATEGORY_IDS` y los `id`/`scroll-mt` de las secciones. No quedó
  ningún `scrollIntoView` en el archivo. La búsqueda por icono de
  R5c no se tocó (despliega con foco, X/Escape limpia).

### 2. Catálogo: 4 por categoría, 20 tarjetas

Comunicación ya tenía 4 (Slack, Teams, Gmail, Zoom): sin cambios.
Las **12 agregadas** (todas `'coming_soon'`, «Disponible
próximamente», capacidades rotuladas «Capacidades previstas»,
botón «Notificar» deshabilitado con nota, sin última sinc, sin
salud inventada y sin fecha de disponibilidad) son:

| Categoría | Agregada | Resumen |
| --- | --- | --- |
| CRM y ventas | Zoho CRM | CRM de ventas |
| Gestión de datos | Airtable | Bases de datos flexibles |
| Gestión de datos | Google Sheets | Hojas de cálculo |
| Gestión de datos | Notion | Notas y bases de conocimiento |
| Gestión de datos | Google Drive | Archivos en la nube |
| Automatización | Zapier | Automatización entre aplicaciones |
| Automatización | Make | Automatización visual de flujos |
| Automatización | n8n | Automatización de flujos |
| Automatización | Microsoft Power Automate | Automatización de Microsoft |
| API & Webhooks | Postman | Exploración y prueba de APIs |
| API & Webhooks | Pipedream | Flujos sobre APIs y eventos |
| API & Webhooks | Insomnia | Cliente de APIs |

(NOTA DE ARITMÉTICA: el brief de la segunda corrección decía
«las 10 agregadas», pero sus propias listas explícitas por
categoría suman 12 (1 + 4 + 4 + 3) y, con las 8 previas, dan
exactamente el total de 20 tarjetas (4 por categoría) que el
usuario pidió en ambas correcciones. Se implementaron las listas
explícitas y el total de 20; el «10» del brief era el número
inconsistente.)

Cada entrada nueva lleva descripción breve en español neutro,
icono Lucide genérico (nunca logo de marca) y su nota de qué
requeriría conectar de verdad. Ningún nombre nuevo duplica uno
existente en el catálogo. El webhook de ingesta sigue siendo la
ÚNICA entrada real en «Disponible», con su derivación intacta
(recepciones reales, sin secretos expuestos). Las 3 entradas
genéricas de capacidades que se habían considerado primero para
API & Webhooks (Webhooks salientes, API REST de SIS, Conector API
personalizado) NO se agregaron: la segunda corrección del usuario
las reemplazó por Postman, Pipedream e Insomnia.

### 3. Lo que NO se tocó

- El resto de las vistas, la app actual (vanilla), el servidor,
  los endpoints y la base real local.
- El subtítulo con el objetivo de la sección, el aviso de
  catálogo honesto, el panel de detalle y la búsqueda por icono
  de R5c.

## Archivos

- `app/client/src/features/integraciones/IntegrationsView.tsx`
  (único archivo cambiado).
- `docs/R5D-INTEGRACIONES-FILTRO-REPORTE.md` (este informe).

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no hay
  tests nuevos de servidor; el cliente no tiene runner de tests en
  este repo).
- Build limpio; `tsc -p client/tsconfig.json --noEmit` limpio
  (durante la verificación se detectó y corrigió un import
  faltante, `Network` para n8n, antes de dar el build por bueno);
  `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`).
- DB real local intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`).
- Smoke propio en copia de DB (puerto 3478): health OK, login OK,
  3 oportunidades (1 por webhook), 12 eventos de auditoría, 3
  eventos `opportunity.created` — la derivación del webhook sigue
  intacta. El proceso del smoke quedó sin efecto tras la
  verificación (el PID guardado era del subshell, no del node:
  se confirmó por `ps` que no queda ningún `node dist/index.js`
  en pie).

## Evidencia

- En el código fuente de `IntegrationsView.tsx`: cero
  coincidencias de `scrollIntoView`, `CATEGORY_IDS` y
  `scrollToCategory`; presentes `selectedCategory`,
  `aria-pressed` y el botón «Todas».
- En el JS construido: presentes los 12 nombres nuevos (Zoho CRM,
  Airtable, Google Sheets, Notion, Google Drive, Zapier, Make,
  n8n, Microsoft Power Automate, Postman, Pipedream, Insomnia) y
  «Todas».
- Solo el webhook de ingesta tiene `status: 'available'` en el
  código fuente (la otra coincidencia es la unión de tipos del
  registro). Ninguna entrada nueva aparece con estado
  «Disponible» ni «Conectado»: todas son `'coming_soon'`, lo que
  la vista renderiza como «Disponible próximamente».
- Conteo del catálogo en el código fuente: 20 entradas (1
  `'available'` + 19 `'coming_soon'`: 7 existentes + 12 nuevas).

## Decisiones

- El índice siempre muestra «Todas» + las 5 categorías (no se
  ocultan categorías sin coincidencias de búsqueda): como ahora
  son filtros y no anclas, ocultarlas impediría elegirlas para
  ver el mensaje de vacío.
- El detalle sigue a lo visible en lugar de quedarse fijo: si no,
  al filtrar a otra categoría el panel mostraría una integración
  que no está en pantalla.
- No se agregó paginación ni «ver más»: con 4 tarjetas por
  categoría y vista única, cada vista cabe sin scroll largo.

## Riesgos

- Ninguno detectado. El cambio es solo de presentación y catálogo
  en una vista; los datos y la derivación del webhook no cambian.

## Próximo paso

- Ofrecer subir y mergear R5d con el procedimiento habitual
  (snapshot de texto + verificación de PNG conservados + PR +
  merge + verificación en vivo solo lectura).
