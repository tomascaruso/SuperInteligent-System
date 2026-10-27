# R1g: Tabla de Oportunidades dentro de su tarjeta — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Base:** main 859a714d (PR #48, R1e+R1f ya mergeados)
**Estado general:** COMPLETADO EN LOCAL, sin push, sin PR, sin merge y sin despliegue.

## Objetivo

Cerrar los tres desbordes que Tomás reportó en vivo tras R1e+R1f, todos del mismo
problema (la tabla seguía siendo más ancha que su tarjeta), sin tocar lo que ya le
gustó: el formulario de Nueva oportunidad quedó arreglado (R1f) y los colores
sólidos le gustan (R1e). Los tres desbordes:

1. La columna «Próximo paso» sigue fuera de la tabla.
2. Con una oportunidad nueva creada por Tomás en la demo (Laura, El taller,
   borrador pendiente), el badge «Atención humana requerida» queda cortado en el
   borde derecho.
3. «Sin pendiente» de las otras filas también queda fuera de la tabla.

## Por qué R1e no alcanzó

R1e ahorró 56 px de padding, pero su cuenta olvidó el padding de la tarjeta
(Card compact p-4 = 32 px) y no contemplaba el caso real nuevo: la columna Agente
con «Seguimiento» (palabra larga que no se parte) y el badge de atención
pendiente, cuyo ancho preferido (~183 px en una línea) empuja la tabla aunque su
mínimo sea la palabra más larga. Cuenta estimada a 1280 px antes de R1g:
main 1024 − panel 440 − gap 16 = columna de tabla 568; menos padding de tarjeta
32 = 536 útiles; mínimos aproximados ~612. O sea, ~76 px por encima de lo útil.

## Acciones

Todas en la vista Oportunidades y en los componentes compartidos que usa, con
props nuevas opcionales para no cambiar otras vistas futuras:

1. **«Sin pendiente» vuelve a envolverse.** Se quitó el `whitespace-nowrap`
   de R1e del span «Sin pendiente»: envuelve en dos líneas («Sin» /
   «pendiente»). La fila ya tiene 3 líneas por la celda Oportunidad, así que
   no crece en alto.
2. **Badge «Atención humana requerida» acotado.** En la vista, el badge lleva
   `max-w-[120px] whitespace-normal text-center leading-tight`: la píldora no
   supera 120 px y su texto envuelve dentro de la píldora (centrado) en vez de
   empujarla fuera de la tarjeta. El texto NO se acorta.
3. **Paddings de tabla más chicos.** En `table.tsx`, con `scrollable={false}`,
   los encabezados pasan de `px-2` a `px-1.5` (el modo con scroll conserva
   `px-3`); en las 7 celdas de la vista, de `px-1.5` a `px-1`. El padding por
   columna pasa de 16 a 12 px: ahorro 4 × 7 = 28 px.
4. **Fuente de ESTA tabla más chica.** `Table` ganó la prop opcional `textSize`
   (por defecto `text-sm`, como antes); Oportunidades pasa `text-[13px]`.
   Solo cambia esta tabla, no el resto de la app. Los badges siguen en
   `text-xs` (12 px), así que «En seguimiento» no se achica.
5. **Más ancho útil.** Panel de 440 a 420 px (sigue siendo más ancho que los
   370 originales), gap de la grilla de 16 a 12 px, y tarjeta de la tabla de
   `p-4` a `p-3` (nueva prop opcional `pad` en `Card`, que reemplaza al
   padding por defecto en vez de convivir con él; la tarjeta de filtros sigue
   en `p-4`). Ganancia: 20 + 4 + 8 = 32 px.
6. **NO se tocó:** menú (200 px), contenedor (`max-w-7xl`), colores sólidos de
   R1e, diálogo de R1f, fila única de filtros, textos (ninguno se acorta:
   «En seguimiento» sigue en una línea, como exigió Tomás), ni se agregó
   ninguna barra de desplazamiento interna.

## Cuenta de anchos final

Medición con PIL/DejaVu (fuente ancha; ver Riesgos) a 13 px para celdas y
encabezados y 12 px para badges y categoría. Ancho útil final a 1280 px:
contenido 1248 − menú 200 − gap principal 24 = main 1024; columna de tabla
1024 − panel 420 − gap 12 = 592; menos tarjeta `p-3` (24) = **568 útiles**.

Mínimos duros por columna (palabra más larga o badge sin quiebre + padding):

| Columna | Contenido que manda | Ancho |
|---|---|---|
| Oportunidad | categoría «automatización» 92,6 (12 px) | ~105 |
| Estado | badge «En seguimiento» 93,3 + padding badge 16 | ~117 |
| Prioridad | encabezado «Prioridad» 57,9 | ~70 |
| Fuente | «Entrada» 51,1 | ~63 |
| Agente | «Seguimiento» 81,9 | ~94 |
| Atención humana | badge mínimo «requerida» 57,9 + padding badge 16 (preferido capado a 120) | ~82 |
| Próximo paso | encabezado «Próximo» 52,1 | ~64 |
| **Total** | | **~595** |

El total DejaVu (~595) queda ~27 px por encima de los 568 útiles **en esa
métrica**. Se documenta así, sin redondearlo a favor: DejaVu es una fuente
ancha y es una cota superior. La máquina de Tomás usa Windows (Segoe UI, más
angosta que DejaVu, del orden de un 8–10 % menos), donde la estimación queda en
~545–550 px, o sea ~20 px por debajo de lo útil. Y los dos desbordes observados
en sus capturas quedan estructuralmente cerrados sea cual sea la fuente: el
badge de atención ya no puede superar 120 px y «Sin pendiente» ya envuelve.
La verificación en vivo en su máquina es la prueba definitiva (ver Riesgos).

## Archivos

- Modificados:
  - `app/client/src/features/oportunidades/OpportunitiesView.tsx` (grilla a
    420 px y gap-3, tarjeta de tabla `p-3`, tabla a `text-[13px]`, celdas a
    `px-1`, badge de atención con `max-w-[120px]`, «Sin pendiente» sin nowrap).
  - `app/client/src/components/ui/table.tsx` (prop opcional `textSize`,
    encabezados `px-1.5` cuando `scrollable={false}`).
  - `app/client/src/components/ui/card.tsx` (prop opcional `pad`).
- Creado: `docs/R1G-OPORTUNIDADES-TABLA-DENTRO-REPORTE.md` (este informe).
- No tocados: `app/public/*`, `app/src/routes.ts` (MD5 idénticos a main:
  `app.js` `44ef9ae6daf62c3b9c335f6f2501256a`,
  `routes.ts` `202ecb4059ffe878c5451ecd905f8ba6`), `badge.tsx` (colores
  sólidos de R1e intactos), `dialog.tsx` (corrección de foco de R1f intacta),
  `filter-bar.tsx`, `AppLayout.tsx` (menú sigue en 200 px), backend, APIs,
  auth, `render.yaml`, workflows. Sin dependencias nuevas.
  `app/src/server.test.ts` no se tocó (ningún texto cambió).

## Pruebas

- Typecheck + build del cliente limpios (Vite 4,30 s; JS
  `index-Bx8wzTfJ.js`, CSS `index-B0H1pTNY.css`, base `/v2/`, PNG del logo
  incluidos). Clases nuevas verificadas en el JS construido: `420px`,
  `max-w-[120px]`, `text-[13px]`.
- Suite vitest: **123/123** (6 archivos), sin tocar ningún test.
- Smoke con servidor real (copias de la DB en `/tmp`, puertos libres,
  procesos matados por PID exacto, ningún servidor quedó corriendo):
  `/health` 200, `/v2` 302, `/v2/` 200, `/` 200, login demo 200,
  `GET /api/opportunities` 200.
- Caso real reproducido SOLO en la copia de la DB (nunca en la DB real local,
  que no se escribió; las copias se borraron): alta manual de Laura
  («El taller») vía API → borrador `pending_approval` (columna de atención)
  y tarea abierta con agente `Seguimiento` y título
  «Enviar propuesta en 48 h» (columnas Agente y Próximo paso). Es el mismo
  perfil de datos que desbordaba en la demo de Tomás.
- Nota: un primer intento de alta en la copia falló por nombres de campo
  (`contact_name` en vez de `contactName`/`contactEmail`); se corrigió y la
  segunda alta fue 200 con el borrador y la tarea esperados.

## Evidencia

- Build: JS `index-Bx8wzTfJ.js`, CSS `index-B0H1pTNY.css`.
- Smoke: `/health` 200, `/v2` 302, `/v2/` 200, `/` 200, login 200,
  `GET /api/opportunities` 200, caso Laura en copia: borrador pendiente +
  agente Seguimiento.
- No hay captura de navegador en este entorno: el ajuste visual final se
  verifica en vivo post-merge.

## Decisiones

- Se aplicaron todas las palancas pedidas (Sin pendiente con quiebre, badge
  de atención capado, paddings, 13 px) MÁS panel 420 y tarjeta `p-3`, porque
  la cuenta no cerraba solo con las primeras.
- No se bajó el panel a menos de 420 ni se achicaron los badges a 11 px:
  Tomás pidió el panel más ancho y los badges en su tamaño actual; esos
  recortes quedan como fallback cuantificado (ver Riesgos), no aplicados de
  entrada.
- No se usó `px-1.5` por className para achicar badges: se verificó en el CSS
  construido que `.px-1.5` aparece ANTES que `.px-2`, así que `.px-2` de la
  base del Badge ganaría y el cambio no tendría efecto. Un recorte de badge
  exigiría una prop en el componente, no un className.
- No se agregó scroll horizontal interno como «solución»: Tomás ya dijo que
  no le gustan las barras.

## Riesgos

- La cuenta de anchos es una estimación con métrica DejaVu (cota superior
  ancha); en la máquina Windows de Tomás (Segoe UI) se espera que cierre con
  ~20 px de margen, pero solo la verificación en vivo con una fila con
  atención pendiente real lo confirma. Si allí siguiera fuera, el siguiente
  recorte, ya cuantificado, sería panel 420 → 400 (+20 px) y/o badges de la
  tabla a 11 px con padding menor (Estado −12 px aprox.), sin tocar textos
  ni colores.
- En ~1024 px la tabla seguirá angosta con filas altas por el texto envuelto
  (comportamiento ya aceptado en R1c/R1d); R1g no lo empeora.
- Los badges sólidos también afectan al panel de detalle (mismo componente):
  conviene mirarlo en vivo junto con la tabla (sin cambios en R1g).

## Próximo paso

Aprobación de Tomás para subir y mergear (el agente principal ejecuta push,
PR y merge como en R1e+R1f). Verificación en vivo post-merge, con una fila
con atención pendiente real: «Próximo paso» dentro de la tarjeta, badge
«Atención humana requerida» completo dentro de su píldora, «Sin pendiente»
dentro, «En seguimiento» en una línea, colores vivos, y tipear en «Nueva
oportunidad» sin salto de foco.

## Autorización requerida

Aprobar subir y mergear (no se hizo push, PR, merge ni despliegue).
