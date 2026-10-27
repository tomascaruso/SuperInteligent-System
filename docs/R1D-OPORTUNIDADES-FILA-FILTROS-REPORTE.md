# R1d: Fila única de filtros + panel más ancho — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Referencia:** mockup Oportunidades + captura de Tomás de la versión R1c en vivo
**Base:** main `c248cb0f` (PR #46, R1c). Sin push, sin PR, sin merge, sin despliegue.

## Estado general

COMPLETO EN LOCAL, pendiente de aprobación para subir y mergear.

## Objetivo

Corregir el último pedido de Tomás sobre Oportunidades: hoy los filtros se
ven en DOS filas (Buscar/Estado/Prioridad arriba; Fuente/Más filtros/Limpiar
abajo) porque la barra de filtros vive dentro de la tarjeta de la tabla,
angostada por el panel derecho. Lo pedido: TODOS los filtros en UNA SOLA
FILA HORIZONTAL, como en la imagen de referencia del diseño, más el panel
derecho más ancho, aceptando reducir la barra de menú izquierda si hace
falta. Con esto, según Tomás, la sección Oportunidades quedaría completa.

## Acciones

1. **Se descartó lo parcial del intento anterior y se corrigió su
   interpretación.** El intento de R1d cancelado por Tomás a los pocos
   minutos había implementado los filtros como columna VERTICAL dentro de
   la tarjeta de la tabla (eso fue lo que Tomás frenó con «nono, para»).
   De ese intento se REUTILIZÓ lo que sí coincidía con el pedido
   corregido (panel 440 px, menú 200 px, Categoría siempre visible,
   eliminación de «Más filtros» y actualización del marcador de test) y se
   DESCARTÓ la columna vertical: el estado de los archivos se comparó
   línea por línea contra main antes de implementar.
2. **Filtros en una sola fila a ancho completo.** La `FilterBar` salió de
   adentro de la tarjeta de la tabla y ahora vive en su propia tarjeta
   (`Card compact`) ENCIMA de la grilla tabla+panel, a todo el ancho de
   la sección (el ancho del main, no el de la tarjeta de la tabla). En
   `filter-bar.tsx` el nuevo `layout="single"` pone todos los controles
   en una sola fila horizontal sin quiebre en lg
   (`flex flex-wrap lg:flex-nowrap`): el buscador crece (`flex-1 min-w-0`)
   y los selects y el botón no se achican (`shrink-0`, selects con
   `w-auto` para que midan según su opción más larga). En angosto
   (<lg) la fila envuelve como fallback responsive. Las etiquetas van
   encima de cada control, como hoy, y los campos siguen compactos
   (`h-9`).
3. **Categoría siempre visible, sin «Más filtros».** La Categoría es un
   select más de la fila (Buscar, Estado, Prioridad, Fuente, Categoría,
   Limpiar). Se eliminó el botón «Más filtros» y su toggle: ya no tiene
   sentido si todos los filtros están en la fila. La lógica de filtrado,
   las opciones reales y el reseteo completo con «Limpiar» (incluida
   Categoría) no cambian.
4. **Panel más ancho.** La grilla de Oportunidades pasa de
   `lg:grid-cols-[minmax(0,1fr)_370px]` a
   `lg:grid-cols-[minmax(0,1fr)_440px]`.
5. **Menú más angosto.** En `AppLayout.tsx` la columna de navegación
   pasa de 240 px a 200 px en lg
   (`lg:grid-cols-[200px_minmax(0,1fr)]`). La navegación en móvil/tablet
   (tira horizontal) NO cambia; los nombres de las 6 secciones, el
   orden y el comportamiento no cambian. Es la única modificación fuera
   de Oportunidades, autorizada expresamente por Tomás.
6. **Sin cambios en el resto de R1c:** densidad compacta, sin barras de
   desplazamiento internas (tabla con texto envuelto, panel sin scroll
   propio), diálogo «Nueva oportunidad» con trampa de foco y cierres
   X/Cancelar/Escape, panel profesional, columnas en orden
   Oportunidad/Estado/Prioridad/Fuente/Agente/Atención humana/Próximo
   paso con derivaciones reales, primera fila seleccionada por defecto,
   paginación, 401 → acceso, estados de carga/error/vacío.

## Archivos

- Modificados:
  - `app/client/src/features/oportunidades/OpportunitiesView.tsx`
    (FilterBar en tarjeta propia encima de la grilla; panel 440 px;
    Categoría como select de la fila; sin «Más filtros» ni su estado).
  - `app/client/src/components/ui/filter-bar.tsx` (prop opcional
    `layout="single"`; por defecto sigue la fila con quiebre de R1 para
    no romper otras vistas futuras).
  - `app/client/src/components/layout/AppLayout.tsx` (navegación
    240 → 200 px en lg).
  - `app/src/server.test.ts` (SOLO el marcador: «Más filtros» se
    reemplaza por la etiqueta «Categoría»; ningún otro test cambia).
- Creado: este informe.
- NO tocados: `app/public/*`, `app/src/routes.ts`, backend, APIs, auth,
  `render.yaml`, workflows. Sin dependencias nuevas. MD5 verificados
  iguales a antes de la fase: `app/public/app.js`
  `44ef9ae6daf62c3b9c335f6f2501256a`, `app/src/routes.ts`
  `202ecb4059ffe878c5451ecd905f8ba6`.

## Pruebas

- Typecheck (servidor + cliente): limpio.
- Build del cliente (Vite): limpio; JS `index-DgSTBRWu.js`,
  CSS `index-DRvoVzIg.css`, base `/v2/`, PNG del logo incluidos.
- Suite vitest: **123/123** (6 archivos). El JS construido contiene
  «Categoría» y tiene 0 ocurrencias de «Más filtros»; no queda ningún
  `layout="column"` en el código.
- Smoke con servidor real (copia de la DB en `/tmp`, puerto 3421,
  proceso matado por PID exacto, temporales borrados): `/health` 200,
  `/v2` 302, `/v2/` 200, asset JS 200, asset CSS 200, `/` 200,
  `POST /api/auth/login` con la cuenta demo 200,
  `GET /api/opportunities` 200. Sintaxis de `app.js` verificada con
  `node --check`. Ningún servidor quedó corriendo.

## Evidencia

- Diff contra main de los tres archivos de UI: solo los cambios de
  esta fase (fila única, panel 440, menú 200, sin «Más filtros»).
- Cuenta de anchos a 1280 px de viewport (ver Decisiones): la fila de
  filtros cabe en una sola fila con el buscador en ~360 px; a 1024 px
  el buscador queda angosto (~100 px) pero la fila sigue sin quebrar
  en lg.

## Decisiones

- **Por qué la fila a ancho completo encima de la grilla y no dentro de
  la tarjeta:** la causa de las dos filas era el ancho disponible: la
  barra vivía dentro de la tarjeta de la tabla, que comparte el ancho
  con el panel de 370 px (luego 440 px). Encima de la grilla, la fila
  dispone de todo el ancho del main y los 6 controles caben sin
  quiebre.
- **Cuenta de anchos a 1280 px:** contenedor `max-w-7xl` 1280 −
  `px-4` (32) = 1248 de contenido; menú 200 + `gap-6` (24) = main 1024;
  tarjeta `p-4` (32) = 992 útiles. Controles fijos estimados: Estado
  ~136 + Prioridad ~86 + Fuente ~136 + Categoría ~146 + Limpiar ~90 +
  5 gaps de 8 = ~634; el buscador (`flex-1`) queda en ~358 px. Sin
  recortar opciones ni ocultar controles.
- **Por qué no una columna lateral de filtros:** ya fue la
  interpretación descartada por Tomás en el intento anterior; además
  le quitaría ~220 px a una tabla de 7 columnas. La fila única es lo
  que muestra la referencia y lo que pidió con su captura.
- **Por qué el menú baja solo 40 px (240 → 200):** compensa gran parte
  del panel (+70 px); la tabla cede solo ~30 px netos en 1280 px y
  sigue envolviendo el texto sin barra interna, como en R1c.

## Riesgos

- En 1024 px exactos el buscador queda angosto (~100 px) aunque la
  fila no quiebra; si en vivo se ve incómodo, el ajuste sería reducir
  el padding de los selects o el ancho del panel, sin tocar datos ni
  ocultar controles.
- El aspecto visual final (que la fila realmente se vea en una sola
  línea con todos los controles) queda para la verificación en vivo
  post-merge: en este entorno no hay navegador para comprobarlo con
  el ancho real de ventana.

## Próximo paso

Aprobación de Tomás para subir y mergear (PR aparte, como siempre);
tras el merge, verificación en vivo post-merge: fila de filtros en una
sola línea, panel más ancho, menú más angosto, indicadores 3/0/0/0 sin
cambios, sesión dejada iniciada, sin crear datos.

## Autorización requerida

Subir a `ui-fase1-foundations`, crear el PR y mergear a main.
