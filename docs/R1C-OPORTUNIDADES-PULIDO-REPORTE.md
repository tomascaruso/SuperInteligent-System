# R1c: Pulido visual de Oportunidades — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Referencia:** mockup Oportunidades
(`~/workspace/user/media_library/image/2c/2cdea6f2865c527b21bf00c38a90288bdda9ce077ace965e25e5f7069a877426.jpg`),
vista con la referencia ANTES de tocar código.
**Base:** main `63027f84` (PR #45, R1b). El HEAD local de la
rama `ui-fase1-foundations` es viejo por el modelo snapshot y NO
se usó como referencia.
**Estado:** IMPLEMENTADO EN LOCAL. Sin pushes, merges, PRs ni
despliegues (por instrucción: el upload lo hace el agente
principal). Sin cambios en `render.yaml` ni `.github/workflows`.
La demo pública no cambia: el vanilla sigue en `/` y el cliente
React vive en `/v2/`.

## Estado general

R1c responde al feedback directo de Tomás sobre R1b: «Está todo
muy grande, no me gustan las barras de desplazamiento, el botón
de nueva oportunidad debería abrir una ventana sobre la misma
sección de oportunidades, con la posibilidad de cerrarla. Me
gusta el funcionamiento del panel derecho pero no me convence
todavía lo visual, está como muy básico y yo quiero que se vea
profesional como en la imagen de referencia».

Se pulió la vista Oportunidades en esos cuatro puntos, sin
cambiar su funcionamiento ni ningún dato: densidad compacta,
sin barras internas, diálogo modal para «Nueva oportunidad» y
panel derecho con diseño de tarjeta/secciones. Todo lo de R1b
queda intacto (encabezado con subtítulo de la referencia,
filtros con «Más filtros» → Categoría, columnas en su orden,
panel fijo a la derecha, primera fila seleccionada,
paginación).

## Objetivo

Que Oportunidades se vea compacta y profesional como la
referencia, sin barras de desplazamiento internas y con la
creación en una ventana cerrable sobre la misma sección, sin
inventar ningún dato, columna, métrica ni operación.

## Acciones

1. **Densidad compacta (solo esta vista).** Título de `text-2xl
   font-bold` a `text-lg font-semibold` (también en el estado
   de error), subtítulo en `text-sm`, espaciado de la vista de
   `space-y-6` a `space-y-4` y grilla de `gap-6` a `gap-4`,
   celdas de tabla de `px-3 py-2` a `px-2 py-1.5`, badges ya
   en `text-xs`, tarjeta de la tabla con padding compacto
   (`Card compact`, p-4 en vez de p-6) y filtros compactos
   (campos h-9, `gap-2`). Nada quedó ilegible: es compacto
   profesional, no miniatura. Los demás vistas no cambian:
   las props nuevas de los componentes compartidos son
   opcionales y por defecto mantienen el comportamiento
   anterior.
2. **Sin barras de desplazamiento internas.**
   - Tabla: `Table` ganó la prop opcional `scrollable`
     (por defecto `true`, como en R1); Oportunidades la usa
     con `scrollable={false}`: el envoltorio ya no tiene
     `overflow-x-auto` y las celdas llevan `break-words`, así
     que el texto envuelve y la tabla cede con el ancho.
     En ≥1280 px el total tabla + panel (370 px) cabe sin
     scroll horizontal; en 1024–1279 px la tabla cede con
     texto envuelto, nunca con barra interna.
   - Panel: la variante `inline` de `DetailPanel` perdió el
     `sticky` y el `max-h` con `overflow-y-auto`: ahora es
     una tarjeta estática que acompaña a la página; la única
     barra posible es la de la página misma.
   - Pestañas: `Tabs` ganó la prop opcional `scrollable`
     (por defecto `true`); Oportunidades la usa con
     `scrollable={false}` para que envuelvan en vez de
     generar barra interna.
   - La variante overlay de `DetailPanel` conserva su
     `overflow-y-auto` (es un panel fijo a pantalla completa
     que necesita desplazarse si supera la altura; no es una
     barra de la vista Oportunidades, que usa la variante
     inline).
3. **Diálogo «Nueva oportunidad».** Nuevo componente
   compartido `app/client/src/components/ui/dialog.tsx`
   (reutilizable; va a servir en R3): overlay con fondo,
   tarjeta centrada (`rounded-dialog`, sombra), botón X de
   cierre (icono Lucide, con `aria-label`), cierre con Escape
   y con clic en el fondo, y TRAMPA DE FOCO completa (foco
   inicial en el primer campo visible, Tab/Shift+Tab
   ciclando solo dentro del diálogo excluyendo elementos no
   visibles o deshabilitados, y al cerrar el foco vuelve al
   botón que lo abrió). Accesibilidad: `role="dialog"`,
   `aria-modal="true"`, `aria-labelledby` al título. El botón
   «Nueva oportunidad» ya NO pliega un formulario en la
   página: abre este diálogo sobre la misma sección.
   Dentro va el mismo formulario de alta manual (campos,
   validación y mensajes del servidor). «Cancelar» y X
   cierran SIN crear nada y limpian el formulario. Al crear
   con éxito: se cierra el diálogo, se limpia el formulario,
   se recarga la lista y el feedback («Oportunidad creada.»
   o «La oportunidad ya estaba registrada.») se muestra en
   la vista, encima de la tabla, no dentro del diálogo ya
   cerrado. Al fallar: el error se muestra dentro del
   diálogo y el diálogo queda abierto.
4. **Panel derecho profesional (mismo funcionamiento).**
   Tarjeta blanca con borde, sombra suave (`shadow-sm`) y
   radio de tarjeta, como la referencia. Cabecera: nombre de
   contacto en negrita, empresa en secundario, badge de
   estado. Debajo, una grilla de datos clave reales con
   etiquetas pequeñas en gris y divisor superior
   (Categoría, Prioridad, Canal, Puntaje). Pestañas con el
   estilo de la referencia: subrayado índigo en la activa,
   resto en gris (ya lo tenía `Tabs`; ahora además envuelven
   sin barra). Contenido por pestaña con secciones y
   divisores, no listas planas: Resumen con filas
   etiqueta/valor separadas por divisores; Borrador dentro
   de una tarjeta de fondo índigo claro con badge de estado,
   cuerpo en tarjeta blanca y dato de decisión; Tareas como
   lista con divisores (título + badge, y debajo agente y
   vencimiento en secundario); Actividad como línea de
   tiempo (punto índigo + línea vertical, acción en
   negrita y fecha/hora + actor debajo) con los eventos
   reales de auditoría.
5. **Intacto de R1b.** Encabezado con subtítulo de la
   referencia, filtros en una fila con «Más filtros» →
   Categoría real, columnas en orden Oportunidad/Estado/
   Prioridad/Fuente/Agente/Atención humana/Próximo paso
   (derivaciones reales ya documentadas en R1b), panel fijo
   a la derecha en ≥1024 px y debajo en angosto, primera
   fila seleccionada por defecto, paginación «Mostrando X a
   Y de Z», 401 → acceso, estados de carga/error/vacío,
   píldora de estado. Navegación lateral sin cambios
   (6 secciones reales).

## Archivos

### Creados

- `app/client/src/components/ui/dialog.tsx` (componente
  compartido Dialog, con trampa de foco)
- `docs/R1C-OPORTUNIDADES-PULIDO-REPORTE.md` (este informe)

### Modificados

- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (densidad, tabla sin scroll, diálogo de alta, panel con
  secciones/divisores/línea de tiempo)
- `app/client/src/components/ui/table.tsx` (prop opcional
  `scrollable`, por defecto `true`)
- `app/client/src/components/ui/tabs.tsx` (prop opcional
  `scrollable`, por defecto `true`)
- `app/client/src/components/ui/detail-panel.tsx` (variante
  `inline` sin sticky ni scroll propio, con sombra suave;
  variante overlay intacta)
- `app/client/src/components/ui/filter-bar.tsx` (prop
  opcional `compact`, campos h-9)
- `app/client/src/components/ui/card.tsx` (prop opcional
  `compact`, p-4 en vez de p-6)

### No tocados (verificable)

- `app/public/` (vanilla intacto), `app/src/routes.ts`,
  `app/src/server.test.ts` (sin cambios en esta fase: los
  textos de los marcadores —subtítulo, «Nueva oportunidad
  (alta manual)», «Crear oportunidad», «Mostrando», «Más
  filtros», «Atención humana requerida»— siguen presentes
  en el JS construido), backend, APIs, auth, permisos,
  `render.yaml`, `.github/workflows`. Sin dependencias
  nuevas (lucide-react ya estaba en `dependencies`; solo se
  usa el icono X del botón de cierre del diálogo).
- `app/public/app.js` y `app/src/routes.ts` conservan los
  mismos hashes MD5 que antes de esta fase
  (`44ef9ae6daf62c3b9c335f6f2501256a` y
  `202ecb4059ffe878c5451ecd905f8ba6`; los `M` que muestra
  `git status` local son el artefacto conocido del modelo
  snapshot frente al HEAD local viejo, no cambios de esta
  fase).

## Pruebas y evidencia

- Typecheck combinado (servidor + cliente): limpio
  (`npm run build`: tsc + Vite).
- Build cliente (Vite): OK en 4,09 s (JS 310,27 kB, CSS
  18,39 kB; assets con base `/v2/`, incluidos los dos PNG
  del logo). `node --check public/app.js`: OK.
- Suite vitest: **123/123** (6 archivos, sin fallos), sin
  tocar ningún test en esta fase.
- JS construido verificado por grep: contiene «Centraliza,
  clasifica», «Nueva oportunidad (alta manual)», «Más
  filtros» y «Atención humana requerida».
- Smoke local con servidor real (copia de la DB en /tmp,
  puerto libre, proceso matado por PID exacto, archivos
  temporales borrados): `/health` → 200, `/v2` → 302 a
  `/v2/`, `/v2/` → 200, asset JS → 200, asset CSS → 200,
  `/` → 200 (vanilla intacto), `POST /api/auth/login` con
  la cuenta demo → 200, `GET /api/opportunities` con esa
  sesión → 200 con 3 oportunidades en la DB local copiada.
  La DB local copiada NO es la de la demo pública; los
  valores se reportan tal cual, sin mezclarlos.
- Las menciones a «Agente X-1», «Borrador IA» o valor
  estimado en el código de la vista son SOLO comentarios
  que documentan lo omitido, no textos de la interfaz.

## Qué funciona y qué no

- Funciona: densidad compacta en Oportunidades, tabla sin
  scroll horizontal interno, panel sin scroll propio,
  diálogo modal con trampa de foco, cierre con X/Escape/
  fondo/Cancelar sin crear, éxito en la vista y error
  dentro del diálogo, panel con secciones/divisores/línea
  de tiempo, y todo lo de R1b intacto.
- No probado todavía (por diseño de esta fase, sin
  navegador en este entorno): el click-through visual (que
  la tabla quepa sin barra en ≥1280 px y envuelva en
  1024–1279 px, que el diálogo se vea centrado y la trampa
  de foco cicle, y que el panel se vea profesional en
  vivo). Queda para la verificación en vivo post-merge del
  agente principal.

## Decisiones

### Qué se cambió para compactar

Solo la vista Oportunidades y, en los componentes
compartidos, props opcionales que por defecto no cambian
nada en otras vistas: `Table.scrollable`, `Tabs.scrollable`,
`FilterBar.compact`, `Card.compact`. La variante `inline`
de `DetailPanel` sí cambió su comportamiento (sin sticky ni
scroll propio), pero hoy solo la usa Oportunidades; la
variante overlay, que usarán otras vistas, no cambió.

### Cómo se eliminaron las barras internas

No se ocultaron con CSS: se quitaron las causas. La tabla
ya no envuelve en un contenedor con `overflow-x-auto` en
esta vista y sus celdas envuelven el texto; el panel ya no
tiene altura máxima con scroll propio; las pestañas
envuelven. Si el contenido total supera la altura de la
ventana, desplaza la página, como corresponde.

### Cómo funciona el diálogo

Es un componente compartido, no un formulario ad hoc: el
foco entra al primer campo, no puede salir con Tab, Escape
o clic en el fondo lo cierran sin crear, y al cerrar el
foco vuelve al botón «Nueva oportunidad». El éxito no se
pierde al cerrarse: el mensaje queda en la vista, encima
de la tabla, y la lista se recarga.

### Qué del panel se pulió sin inventar datos

Solo presentación: tarjeta con sombra, datos clave con
etiquetas pequeñas y divisor, secciones con divisores y
línea de tiempo. No se agregaron valor estimado,
probabilidad, fecha de cierre, «Borrador IA», gráfico IA,
logs inventados ni botones decorativos de enviar/editar/
más. Los datos clave son los reales de R1/R1b (Categoría,
Prioridad, Canal, Puntaje) y las derivaciones Agente y
Atención humana siguen siendo las documentadas en R1b.

## Riesgos

- En 1024–1279 px la tabla de 7 columnas queda muy
  angosta y sus celdas envuelven mucho (filas altas): es
  el comportamiento pedido (sin barra interna), pero si en
  la verificación en vivo se ve incómoda, el ajuste sería
  reducir el panel de 370 px o acortar etiquetas, sin
  tocar datos.
- La trampa de foco del diálogo se verificó por código
  (selectores, visibilidad, ciclo Tab/Shift+Tab, retorno
  del foco), no con teclado real en un navegador: el
  click-through post-merge debe probarla explícitamente
  (Tab desde el último campo vuelve al primero, Escape
  cierra, el foco vuelve al botón).
- El diálogo bloquea el scroll de la página mientras está
  abierto (`overflow: hidden` en body, restaurado al
  cerrar): si el formulario superara la altura de la
  ventana en pantallas muy bajas, el propio diálogo tiene
  `max-h-[90vh]` con scroll interno para no quedar
  inalcanzable.

## Próximo paso

Siguiente vista: R2 Tareas y seguimientos (tabla real,
tarjetas de resumen reales, panel de detalle, completar/
reabrir), reutilizando Table, DetailPanel (variante inline
u overlay según convenga), FilterBar, Pagination y el nuevo
Dialog. Nada de eso está empezado.

## Autorización requerida

Subir y mergear (el agente principal): esta fase quedó SOLO
en local, sin push, PR, merge ni despliegue. Al aprobar, el
flujo es el de siempre: subida por snapshot (aquí NO hay
binarios nuevos: los PNG del logo ya están en main desde
PR #44), PR, merge con expectedHeadSha y verificación en
vivo post-merge (tabla sin barra en ≥1280 px y en
1024–1279 px, diálogo centrado con trampa de foco y
cierre, panel profesional, solo lectura salvo la apertura
del diálogo con Cancelar).
