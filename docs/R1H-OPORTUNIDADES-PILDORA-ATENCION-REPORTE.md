# R1h: Píldora «Atención humana requerida» — REPORTE

**Fecha:** 27-oct-2026
**Alcance:** solo la píldora de atención de Oportunidades. No se tocan textos, colores, resto de badges, tabla, panel, filtros ni diálogo.

## Problema (captura del usuario, 27-oct ~12:08)

«Próximo paso» ya quedó bien (confirmado por el usuario con captura;
cierra el punto que la verificación de R1g había dejado sin confirmar
del todo). Pero la píldora «Atención humana requerida» de Laura quedó
fea y mal: con el tope de 120 px de R1g y letra de 12 px, el texto caía
en 3 líneas («Atención» / «humana» / «requerida») y la píldora quedaba
alta y angosta, con el texto pegado a los bordes, muy distinta de las
demás píldoras horizontales de la tabla.

## Causa

R1g priorizó que la píldora no empujara la tabla fuera de la tarjeta
(max-w 120 px, texto envolvente) pero no su aspecto: a 12 px ninguna
línea admite dos palabras («Atención humana» ≈ 111 px + 16 px de
padding > 120 px), así que el texto se apila en 3 líneas.

## Corrección

- La píldora de atención pasa a 11 px en vez de 12 px, con el mismo
  tope de 120 px: «Atención humana» entra en la primera línea y
  «requerida» en la segunda. Queda una píldora horizontal normal de
  2 líneas, sin ensanchar la tabla, así «Próximo paso» (ya confirmado
  dentro) no vuelve a salirse.
- `leading-tight` → `leading-snug` en esa píldora, para que las dos
  líneas respiren.
- El 11 px se implementa como prop `compact` de Badge (no como
  className): `cx()` concatena sin resolver conflictos, así que un
  `text-[11px]` agregado por className competiría con el `text-xs`
  base según el orden del CSS construido y no sería determinista.
  Por defecto todos los badges siguen en 12 px; solo esta píldora
  usa `compact`.

## Archivos

- `app/client/src/components/ui/badge.tsx` (prop `compact`).
- `app/client/src/features/oportunidades/OpportunitiesView.tsx`
  (píldora de atención con `compact` y `leading-snug`).

## Pruebas

- Suite: **123/123** sin tocar ningún test.
- Build (tsc + cliente Vite): limpio. La clase `text-[11px]` está
  presente en el CSS construido.
- Smoke local (copia de DB, puerto libre, servidor apagado al
  terminar): /health 200, /v2/ 200, / 200, login demo 200,
  GET /api/opportunities 200.
- Vanilla intacto: `app/public/app.js` y `app/src/routes.ts` con los
  MD5 de referencia.

## Limitación honesta

En esta VM no hay navegador para una comprobación visual local: la
píldora de 2 líneas es la estimación por medida de texto (a 11 px
«Atención humana» ≈ 100 px de contenido, dentro de los 104 px útiles
de la píldora; y aun si en alguna fuente cayera «Atención» /
«humana requerida», seguirían siendo 2 líneas, nunca 3). La
confirmación visual definitiva es la verificación en vivo post-merge
con la fila de Laura: píldora horizontal de 2 líneas, texto sin
pegarse a los bordes, y «Próximo paso» dentro.
