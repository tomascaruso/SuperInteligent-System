# R1e: Tabla de Oportunidades — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Base:** main `9e70750a` (PR #47, R1d)
**Referencia:** captura de Tomás de la tabla actual + verificación en vivo de R1d
(27-oct-2026 ~11:13–11:15), donde el encabezado «Próximo paso» ya se veía
recortado como «Próx pasc».

## Estado general

COMPLETADO EN LOCAL, sin push, sin PR, sin merge y sin despliegue.
Los tres puntos del feedback de Tomás están implementados y verificados en
local (tests, build y smoke). La confirmación visual definitiva (última
columna dentro de la tarjeta y «En seguimiento» en una línea) queda para la
verificación en vivo post-merge, como en todas las fases.

## Objetivo

Corregir, sin tocar datos, textos, panel, menú ni contenedor:

1. «Próximo paso quedó fuera de la tabla»: la última columna se salía del
   borde de la tarjeta de la tabla.
2. «En seguimiento» dentro de la tabla queda partido en dos: debe estar
   todo junto, en una sola línea.
3. «Los colores de fondo deben ser más vivos, están muy apagados»: los
   Badge usaban tintes al 10% y la fila seleccionada un índigo pálido.

## Acciones

1. **Badges en una línea (solo donde corresponde).** En
   `OpportunitiesView.tsx`, los Badge de Estado y de Prioridad de la tabla
   llevan `className="whitespace-nowrap"` (el componente Badge ya aceptaba
   `className`). El texto «Sin pendiente» (span, no badge) también lleva
   `whitespace-nowrap`. El Badge «Atención humana requerida» NO lleva
   nowrap: su texto largo debe poder envolverse cuando haya un borrador
   pendiente real; si se le pusiera nowrap, esa columna crecería
   ~160 px y volvería a empujar la última columna fuera. No se acortó ni
   cambió ningún texto.
2. **Última columna dentro.** En `table.tsx`, cuando `scrollable={false}`
   (el modo de Oportunidades desde R1c), los encabezados pasan de `px-3`
   a `px-2` (el modo con scroll conserva `px-3`). En las 7 celdas de la
   tabla de `OpportunitiesView.tsx`, el padding pasa de `px-2` a `px-1.5`.
   Ahorro total frente a R1d: 7 columnas × 4 px (encabezados) +
   7 columnas × 4 px (celdas) = 56 px. No se tocaron el panel (440 px),
   el menú (200 px) ni el contenedor (`max-w-7xl`).
3. **Colores más vivos.** En `badge.tsx`, las variantes pasan de tintes
   al 10% con texto de color a colores sólidos con texto blanco, con los
   tokens SIS existentes: success `bg-success text-white` (#15803D),
   info `bg-info text-white` (#1D4ED8), warning `bg-warning text-white`
   (#B45309), danger `bg-danger text-white` (#B91C1C), neutral
   `bg-slate-500 text-white` (slate es paleta por defecto; no se inventó
   ningún token nuevo). Como el componente Badge es compartido, los
   badges del panel de detalle también quedan sólidos, con la misma
   paleta y sin cambiar ningún texto. La fila seleccionada de la tabla
   pasa de `bg-primary-subtle` (#EEF2FF, casi blanco) a `bg-primary/20`
   (#4F46E533, índigo al 20%, visiblemente más marcado). El hover de
   filas queda como estaba (`bg-primary-subtle`).
4. **Intacto todo lo demás de R1d:** fila única de filtros a ancho
   completo (Buscar, Estado, Prioridad, Fuente, Categoría, Limpiar, sin
   «Más filtros»), densidad compacta, sin barras de desplazamiento
   internas, diálogo «Nueva oportunidad» con trampa de foco, panel
   profesional, columnas en orden Oportunidad/Estado/Prioridad/Fuente/
   Agente/Atención humana/Próximo paso, primera fila seleccionada por
   defecto, paginación, 401 → acceso, estados de carga/error/vacío.

## Archivos

- Modificados:
  - `app/client/src/features/oportunidades/OpportunitiesView.tsx`
    (nowrap en Estado/Prioridad/Sin pendiente, celdas `px-1.5`,
    fila seleccionada `bg-primary/20`).
  - `app/client/src/components/ui/table.tsx`
    (encabezados `px-2` cuando `scrollable={false}`).
  - `app/client/src/components/ui/badge.tsx`
    (variantes sólidas con texto blanco).
- Creado: `docs/R1E-OPORTUNIDADES-TABLA-REPORTE.md` (este informe).
- No tocados: `app/public/*`, `app/src/routes.ts` (MD5 verificados
  iguales a main: `app.js` `44ef9ae6daf62c3b9c335f6f2501256a`,
  `routes.ts` `202ecb4059ffe878c5451ecd905f8ba6`), backend, APIs, auth,
  `render.yaml`, workflows. Sin dependencias nuevas.
  (`app/src/server.test.ts` no se tocó: los marcadores son por texto y
  ningún texto cambió.)

## Pruebas

- Typecheck + build del cliente limpios (Vite 3,80 s; JS
  `index-iMt6tZbJ.js`, CSS `index-BH7v3Zms.css`, base `/v2/`, PNG del
  logo incluidos).
- Clases de color verificadas en el CSS construido (una clase de token
  inexistente no fallaría el build pero no se vería): existen
  `bg-success`, `bg-info`, `bg-warning`, `bg-danger`, `bg-slate-500` y
  `.bg-primary\/20` (`#4f46e533` y su `color-mix` equivalente).
  `whitespace-nowrap` y `bg-primary/20` también están en el JS construido.
- Suite vitest: **123/123** (6 archivos), sin tocar ningún test.
- Smoke con servidor real (copia de la DB en `/tmp`, puertos libres,
  procesos matados por PID exacto, temporales borrados, ningún servidor
  quedó corriendo): `/health` 200, `/v2` 302, `/v2/` 200, asset JS 200,
  asset CSS 200, `/` 200, `POST /api/auth/login` con la cuenta demo 200,
  `GET /api/opportunities` 200.

## Evidencia

- Causa del desborde en R1d: con el contenedor capado en 1280 px, la
  tarjeta de la tabla queda en ~568 px de ancho (ver cuenta abajo) y el
  ancho natural de las 7 columnas con los paddings de R1d la superaba,
  de modo que, sin barra interna (R1c), el excedente quedaba visible
  fuera de la tarjeta, empezando por la última columna.
- Cuenta estimada de anchos a 1280 px de ventana (tipografías del
  sistema, texto de tabla 14 px, badges 12 px):
  - AppLayout: 1280 − padding 32 = 1248; menos menú 200 y gap 24 →
    main 1024.
  - Grilla Oportunidades: 1024 − panel 440 − gap 16 → tarjeta 568.
  - Columnas tras el recorte (contenido + paddings, con «Próximo paso»
    envolviéndose en dos líneas como ya hacía):
    Oportunidad ~93 (encabezado «Oportunidad»), Estado ~110 (badge
    «En seguimiento» en una línea: ~82 de texto + 16 de badge + 12 de
    celda), Prioridad ~79 (encabezado), Fuente ~61 («externa»),
    Agente ~58 (encabezado), Atención humana ~96 («Sin pendiente» en
    una línea), Próximo paso ~65 («Próximo» en dos líneas).
    Total ≈ 562 px, frente a 568 px de tarjeta: el recorte de 56 px
    absorbe el excedente que en R1d dejaba fuera la última columna.
  - Margen ajustado (unos pocos px): los encabezados y celdas llevan
    `break-words`, así que el layout automático puede absorber algún px
    extra envolviendo un encabezado; los únicos anchos duros son los
    nowrap («En seguimiento», «Sin pendiente») y ya están contados
    arriba. Por eso la confirmación definitiva es visual, en vivo.
- Antes/después de color: Badge Estado/Prioridad y resto de badges
  pasaban de fondo al 10% (por ejemplo éxito `#15803D` al 10% sobre
  blanco) a fondo sólido con texto blanco; la fila seleccionada pasaba
  de `#EEF2FF` a índigo al 20% (`#4F46E533`).

## Decisiones

- **nowrap solo en Estado/Prioridad y en «Sin pendiente», no en
  «Atención humana requerida»:** los dos primeros son textos cortos
  cuyo ancho en una línea (~110 px y ~96 px) cabe en la cuenta; el
  tercero es un texto largo (~160 px en una línea) que, forzado a una
  línea, rompería de nuevo la cuenta y sacaría la última columna.
  Dejarlo envolverse es lo que permite que la tabla quepa con los tres
  casos (sin pendiente / con pendiente) sin cambiar textos.
- **Recorte de padding en vez de tocar panel, menú o contenedor:**
  Tomás autorizó tocar el menú solo para el panel en R1d; en R1e pidió
  explícitamente no tocarlos. El recorte (encabezados `px-2`, celdas
  `px-1.5`) es el mínimo que devuelve la última columna dentro sin
  cambiar la estructura ni la densidad general.
- **Fila seleccionada `bg-primary/20`:** se eligió el modificador de
  opacidad sobre el token `--color-primary` existente (no `bg-indigo-100`
  ni un color nuevo) y se verificó que la clase existe en el CSS
  construido (`#4f46e533`).

## Riesgos

- El margen de la cuenta de anchos es ajustado (pocos px): si en la
  verificación en vivo la última columna siguiera apenas fuera (por
  ejemplo, por una fuente del sistema más ancha que la estimada), el
  ajuste siguiente sería recortar un poco más el padding de los
  encabezados o el ancho del panel, sin tocar datos ni textos. No se
  aplicó de entrada para no desviarse de lo pedido.
- Los badges sólidos cambian también los del panel de detalle (mismo
  componente): es el comportamiento esperado de la paleta viva, pero
  conviene mirarlo en vivo junto con la tabla.
- En pantallas de ~1024 px la tabla seguirá siendo angosta y con filas
  altas por el texto envuelto (comportamiento ya aceptado en R1c/R1d:
  sin barra interna); R1e no lo empeora (recorta 56 px de ancho total).

## Próximo paso

Aprobación de Tomás para subir y mergear (merge separado, como siempre).
Tras el merge: verificación en vivo post-merge, solo lectura, con foco
en los tres puntos: última columna dentro de la tarjeta, «En
seguimiento» en una línea y colores vivos en badges y fila seleccionada.

## Autorización requerida

- Subir R1e a `ui-fase1-foundations`, crear el PR y mergearlo a main.
