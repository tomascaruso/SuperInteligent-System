# R1i: Tabla de Oportunidades más ancha, celdas más chicas — REPORTE

**Fecha:** 27-oct-2026
**Origen:** el usuario, con la referencia visual de Oportunidades:
«sigue igual en tres líneas... tal vez lo mejor sería reducir el
tamaño de las celdas y agrandar la tabla... como la imagen está».
**Alcance:** anchos y fuente de la tabla. No se tocan textos, colores,
fila única de filtros, diálogo ni resto de badges.

## Problema

El 11 px de R1h no alcanzó en la pantalla del usuario: la píldora
«Atención humana requerida» siguió en 3 líneas. La causa no era solo
la letra: la tabla estaba apretada entre el menú (200 px) y el panel
(420 px) dentro de un contenedor de 1280 px, y la píldora tenía tope
de 120 px, sin margen para que «Atención humana» entrara en una línea.

## Cambios

- Panel de detalle: 420 → **360 px** (como en la referencia, el panel
  es proporcionalmente más angosto que la tabla).
- Menú izquierdo en escritorio: 200 → **190 px**. No se bajó a 180 px
  porque las etiquetas no se cortan (`whitespace-nowrap`) y la más
  larga («Actividad y ejecuciones») necesita ~175-185 px.
- Contenedor general (`AppLayout`, cabecera, alerta y grilla):
  1280 px (`max-w-7xl`) → **1440 px**. En pantallas anchas la tabla
  gana hasta 160 px; en pantallas de 1280 px o menos no cambia nada.
  Este cambio afecta también a Inicio (sus tarjetas se estiran), no
  solo a Oportunidades, porque el contenedor es compartido.
- Fuente de la tabla: 13 px → **12 px** (`text-xs`). Los badges
  siguen en 12 px (atención en 11 px), así que sus columnas no
  cambian; lo que se achica es el texto de Oportunidad, Fuente,
  Agente y Próximo paso.
- Píldora de atención: tope 120 → **150 px** (sigue en 11 px con
  `compact`). «Atención humana» pasa a tener ~30 px de margen sobre
  lo que necesita para entrar en la primera línea, y «requerida»
  queda en la segunda.

Cuenta aproximada del aire ganado para la tabla: 60 px (panel) +
10 px (menú) + hasta 160 px (contenedor en pantalla ancha) +
~30-40 px (fuente 12 px en las columnas de texto), menos 30 px del
tope mayor de la píldora. «Próximo paso», ya confirmado dentro por
el usuario, queda con margen en vez de justo.

## Archivos

- `app/client/src/components/layout/AppLayout.tsx` (contenedor y menú).
- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (panel, fuente de la tabla, tope de la píldora).

## Pruebas

- Suite: **123/123** sin tocar ningún test.
- Build (tsc + cliente Vite): limpio. Las clases nuevas
  (`max-w-[150px]`, `1440px`, panel `360px`) están presentes en el
  CSS/JS construido.
- Smoke local (copia de DB, puerto libre, servidor apagado al
  terminar): /health 200, /v2/ 200, / 200.
- Vanilla intacto: `app/public/app.js` y `app/src/routes.ts` con los
  MD5 de referencia.

## Limitación honesta

En esta VM no hay navegador para una comprobación visual local: la
píldora de 2 líneas y «Próximo paso» dentro son estimaciones por
medida (la línea «Atención humana» a 11 px necesita ~110-115 px de
contenido y ahora tiene 134 px). La confirmación definitiva es la
verificación en vivo post-merge con la fila de Laura, y en última
instancia la captura del usuario. Si aun así siguiera en 3 líneas,
quedaría por revisar la fuente real que renderiza su navegador.
