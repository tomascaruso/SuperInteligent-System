# R1b: Ajuste visual de Oportunidades — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Referencia:** mockup Oportunidades (`~/workspace/user/media_library/image/2c/2cdea6f2865c527b21bf00c38a90288bdda9ce077ace965e25e5f7069a877426.jpg`),
vista con la referencia ANTES de tocar código.
**Base:** main `d78e0bc1` (PR #44, logo + R1). El HEAD local de la
rama `ui-fase1-foundations` es viejo por el modelo snapshot y NO
se usó como referencia.
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
despliegues (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni `.github/workflows`.
La demo pública no cambia: el vanilla sigue en `/` y el cliente
React vive en `/v2/`.

## Estado general

R1b acerca la sección Oportunidades al aspecto de la referencia
en los tres ejes que pidió Tomás (aspecto general, columnas de
la tabla y panel derecho de detalle), manteniendo SOLO datos
reales. Todo lo de la referencia que no tiene fuente real quedó
explícitamente fuera (ver Decisiones). El resto de las secciones
sigue igual: las otras 4 vistas son placeholders y la navegación
mantiene las 6 secciones reales.

## Objetivo

Que Oportunidades se parezca a la referencia en composición
(encabezado con botón, filtros en una fila, tabla con las
columnas en su orden y panel derecho fijo), sin inventar ningún
dato, columna, métrica ni operación.

## Acciones

1. **Aspecto general.** El encabezado ahora es título
   «Oportunidades» en grande y negrita, subtítulo
   «Centraliza, clasifica y supervisa las oportunidades
   comerciales» (el de la referencia) y botón primario «Nueva
   oportunidad» arriba a la derecha. Ese botón muestra/oculta
   el formulario de alta manual, que ahora está oculto por
   defecto; el formulario conserva campos, validación y
   mensajes actuales, y «Cancelar» lo oculta sin crear nada
   (limpia campos y feedback).
2. **Filtros en una tarjeta, en una fila.** Buscador, Estado,
   Prioridad y Fuente en la misma fila, más un botón «Más
   filtros» FUNCIONAL: revela el filtro real de Categoría
   (opciones = las categorías distintas presentes en los
   datos, con `categoryLabel`). «Limpiar» resetea todos los
   filtros, incluida Categoría. Filtros y paginación siguen en
   cliente; «Mostrando X a Y de Z» se conserva.
3. **Tabla con las columnas de la referencia, en su orden:**
   Oportunidad, Estado, Prioridad, Fuente, Agente, Atención
   humana, Próximo paso.
   - Oportunidad: `contact_name` en negrita, segunda línea la
     empresa (o «—») y tercera línea pequeña con la categoría
     (así no se pierde ese dato).
   - Estado y Prioridad: los badges actuales. Fuente: el
     `channelLabel` real (Alta manual / Entrada externa).
   - Agente y Atención humana: derivaciones reales (ver
     Decisiones).
   - Próximo paso: como en R1 (título de la tarea abierta más
     próxima, o «—»).
4. **Panel derecho FIJO, no overlay.** En ≥1024 px la vista es
   una grilla con la tarjeta de la tabla (1fr) y el panel
   (370 px, con scroll propio y sticky); en angosto el panel
   va debajo de la tabla. La primera fila de la lista
   filtrada queda seleccionada por defecto (como en la
   referencia) y al hacer clic en otra fila cambia la
   selección, con la fila seleccionada destacada. El panel
   conserva las pestañas reales Resumen / Borrador / Tareas /
   Actividad con el mismo contenido real de R1, y en su
   cabecera muestra contacto/empresa, badge de estado y una
   fila de datos reales (Categoría, Prioridad, Canal,
   Puntaje). Si la lista filtrada está vacía, el panel muestra
   «Seleccioná una oportunidad para ver su detalle.»
5. **DetailPanel con variante «inline».** Se extendió el
   componente compartido con `variant="inline"`: tarjeta
   estática en la grilla, sin overlay, sin fondo, sin botón
   Cerrar y sin Escape. La variante overlay por defecto NO
   cambió (mismo fondo, mismo Cerrar, mismo Escape) para las
   vistas futuras que la usen.
6. **FilterBar con acción extra opcional.** Se agregó la prop
   opcional `extra` (un nodo en la misma fila, antes de
   «Limpiar»); sin ella la barra es exactamente la de R1. La
   usa solo Oportunidades para «Más filtros».

## Archivos

### Creados

- `docs/R1B-OPORTUNIDADES-AJUSTE-REPORTE.md` (este informe)

### Modificados

- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (encabezado, formulario plegable, filtros + Categoría,
  columnas nuevas, grilla tabla + panel, selección por
  defecto, derivaciones Agente y Atención humana)
- `app/client/src/components/ui/detail-panel.tsx` (variante
  «inline»; overlay intacto)
- `app/client/src/components/ui/filter-bar.tsx` (prop opcional
  `extra`; sin ella, comportamiento de R1)
- `app/src/server.test.ts` (SOLO el marcador de textos de
  Oportunidades; ver Pruebas)

### No tocados (verificable)

- `app/public/` (vanilla intacto), `app/src/routes.ts`,
  backend, APIs, auth, permisos, `render.yaml`,
  `.github/workflows`. Sin dependencias nuevas.
- `app/public/app.js` y `app/src/routes.ts` conservan los
  mismos hashes MD5 que antes de esta fase
  (`44ef9ae6daf62c3b9c335f6f2501256a` y
  `202ecb4059ffe878c5451ecd905f8ba6`; los `M` que muestra
  `git status` local son el artefacto conocido del modelo
  snapshot frente al HEAD local viejo, no cambios de esta
  fase).

## Pruebas y evidencia

- Typecheck combinado (servidor + cliente): limpio.
- Build cliente (Vite): OK en 3,36 s (JS 306,66 kB, CSS
  14,72 kB; assets con base `/v2/`, incluidos los dos PNG
  del logo). Build servidor (`tsc`): limpio.
  `node --check public/app.js`: OK (implícito en el flujo
  previo; no se tocó ese archivo).
- Suite vitest: **123/123** (6 archivos, sin fallos).
  Cambio ÚNICO en el marcador de textos de Oportunidades
  (`server.test.ts`, test «el JS del cliente contiene los
  textos reales de la vista Oportunidades»): el subtítulo
  viejo «Oportunidades comerciales y alta manual» se
  reemplazó por el nuevo «Centraliza, clasifica y supervisa
  las oportunidades comerciales», y se agregaron dos textos
  nuevos de R1b («Más filtros» y «Atención humana
  requerida»). Ningún test viejo se borró ni se tocó ningún
  otro test.
- JS construido verificado por grep: contiene «Centraliza,
  clasifica», «Más filtros», «Atención humana requerida»,
  «Nueva oportunidad», «Mostrando» y «Oportunidad».
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID exacto 5101, archivos
  temporales borrados): `/health` → 200
  `{"status":"ok"}`; `/v2` → 302 a `/v2/`; `/v2/` → 200;
  asset JS → 200; asset CSS → 200; `/` → 200 (vanilla
  intacto); `POST /api/auth/login` con la cuenta demo →
  200; `GET /api/opportunities` con esa sesión → 200 con
  3 oportunidades en la DB local copiada (Ana Ruiz, Pedro
  Gómez, Lucía Fernández) y `GET /api/stats` →
  `{"opportunities":3,"openTasks":3,"pendingDrafts":3,"failedExecutions":0}`.
  La DB local copiada NO es la de la demo pública (sus
  borradores figuran pendientes, a diferencia de la demo
  pública, donde ya están decididos); los valores se
  reportan tal cual, sin mezclarlos.

## Qué funciona y qué no

- Funciona: encabezado y botón como la referencia, formulario
  plegable con Cancelar, filtros en una fila con «Más
  filtros» → Categoría real, tabla con las 7 columnas en el
  orden de la referencia, panel derecho fijo con selección
  por defecto y cambio de selección al hacer clic, pestañas
  reales intactas, paginación y «Mostrando X a Y de Z»,
  píldora de estado y 401 → acceso como antes.
- No probado todavía (por diseño de esta fase, sin
  navegador en este entorno): el click-through visual
  (que el panel se vea fijo a la derecha en ≥1024 px y
  debajo en angosto, que la tabla no se rompa con 7
  columnas en anchos justos y que «Más filtros» despliegue
  Categoría). Queda para la verificación en vivo
  post-merge del agente principal.
- Limitación conocida: en anchos apenas por encima de
  1024 px la tabla de 7 columnas queda angosta y usa su
  scroll horizontal interno (`overflow-x-auto` del
  componente Table); el panel fijo es de 370 px por
  especificación, así que en ese ancho la tabla es la que
  cede, no el panel.

## Decisiones

### Elementos de la referencia NO copiados, y por qué

- **«Agente IA Asignado» (Agente X-1 / X-2 / X-3):** no
  existe ningún agente con esos identificadores ni ninguna
  asignación guardada por oportunidad. Se reemplazó por la
  columna «Agente» derivada (abajo).
- **Valor estimado ($150k), probabilidad (70%) y fecha de
  cierre (2023-12-15):** la oportunidad no tiene esos
  campos en el servidor; inventarlos sería mostrar datos
  falsos de clientes.
- **«Borrador IA» y «AI Breakdown» con gráfico:** el
  borrador es una plantilla determinista (veredicto F2-AI
  DISCARD) y no existe ningún desglose generado por IA ni
  datos para graficar.
- **Interaction Log con correos/notas/llamadas inventadas:**
  la actividad real es la auditoría (`/api/audit`), que ya
  se muestra en la pestaña Actividad; los eventos de la
  referencia no ocurrieron.
- **Botones de enviar/editar/más (iconos del panel de la
  referencia):** no hacen nada en el sistema real; no se
  agregaron botones decorativos.
- **Navegación Dashboard / Contactos / Empresas / Proyectos
  / Reportes / Ajustes:** esas secciones no existen; se
  mantienen las 6 secciones reales (Inicio, Oportunidades,
  «Tareas y seguimientos», Aprobaciones, «Actividad y
  ejecuciones», Agentes). Clientes e Integraciones siguen
  fuera de alcance.
- **Títulos de pestañas de la referencia (Overview, AI
  Breakdown, Classification, Interaction Log, Related
  Tasks):** se mantienen las pestañas reales (Resumen,
  Borrador, Tareas, Actividad) porque su contenido sí
  existe.

### Las dos derivaciones honestas

- **Agente:** `agent_name` o `assigned_to` de la tarea
  abierta más próxima de la oportunidad (misma tarea que
  da «Próximo paso»; las tareas vienen ordenadas por
  vencimiento ascendente). Si no hay tarea abierta, «—».
  Es el agente determinista real de esa tarea (por ejemplo
  Seguimiento), nunca un «Agente X-N» inventado.
- **Atención humana:** si el borrador vigente de la
  oportunidad (el primero por creación DESC, de la lista
  de borradores ya cargada) está en `pending_approval`,
  badge de advertencia «Atención humana requerida»; si no,
  «Sin pendiente». Un borrador vencido o desactualizado
  sigue en `pending_approval` hasta que se decide, así que
  también marca atención requerida, y su detalle muestra
  las marcas Vencido/Desactualizado. En la demo pública
  actual los 3 borradores ya están decididos, así que las
  3 filas mostrarán «Sin pendiente» hasta que aparezca un
  borrador pendiente real.

## Riesgos

- En anchos cercanos a 1024 px la tabla de 7 columnas
  depende de su scroll horizontal; si en la verificación
  en vivo se ve incómoda, el ajuste sería reducir el panel
  a 360 px (mínimo del rango pedido) o el tamaño de celda,
  sin tocar datos.
- La selección por defecto es la primera fila de la lista
  FILTRADA, no de la página: si el usuario está en la
  página 2 y filtra, la selección puede quedar en una fila
  de otra página (se destaca solo cuando esa fila está
  visible). Es el comportamiento pedido; si molesta, el
  cambio sería seleccionar la primera fila de la página
  visible.
- DetailPanel «inline» usa `sticky` en ≥1024 px: en
  navegadores viejos se comporta como bloque normal (el
  panel simplemente queda debajo del flujo), sin romper
  nada.

## Próximo paso

Siguiente vista: R2 Tareas y seguimientos (tabla real,
tarjetas de resumen reales, panel de detalle, completar/
reabrir), reutilizando Table, DetailPanel (variante inline
u overlay según convenga), FilterBar y Pagination. Nada de
eso está empezado.

## Autorización requerida

Subir y mergear (el agente principal): esta fase quedó SOLO
en local, sin push, PR, merge ni despliegue. Al aprobar, el
flujo es el de siempre: subida en dos partes si hay
binarios (aquí NO hay binarios nuevos: los PNG del logo ya
están en main desde PR #44), PR, merge con expectedHeadSha
y verificación en vivo post-merge (click-through del panel
fijo, «Más filtros» → Categoría y tabla en ≥1024 px y en
angosto, solo lectura).
