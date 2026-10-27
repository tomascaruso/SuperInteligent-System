# R1f: Corrección del foco del diálogo «Nueva oportunidad» — REPORTE

**Fecha:** 27-oct-2026 (ART)
**Base:** main `9e70750a` (PR #47, R1d) + árbol local con R1e sin mergear (badge.tsx, table.tsx, OpportunitiesView.tsx ya modificados por R1e; R1e NO se revirtió, este cambio se suma al mismo árbol)
**Estado general:** COMPLETADO EN LOCAL, sin push, sin PR, sin merge y sin despliegue.

## Objetivo

Corregir el bug reportado por Tomás en la demo en vivo: en el formulario
«Nueva oportunidad», al hacer clic en una casilla y agregar una letra, el
foco saltaba automáticamente a la opción de cierre del formulario. Tipear
debe quedarse en el campo y la letra debe aparecer; ninguna tecla debe
interpretarse como cierre (salvo Escape, que es cierre por diseño, y la
activación normal de un botón enfocado con Enter/Espacio).

## Causa raíz (verificada en el código antes de tocar nada)

El diagnóstico del agente principal era correcto, con un matiz: el salto
no era a «cualquier cierre» en general sino, en concreto, al botón X.

- `app/client/src/features/oportunidades/OpportunitiesView.tsx` línea
  ~229 (antes del cambio): `closeDialog` era una función común del cuerpo
  del componente, NO `useCallback`. Cada render creaba una identidad
  nueva de `onClose`.
- `app/client/src/components/ui/dialog.tsx`, efecto con dependencias
  `[open, onClose]`: cada pulsación en un campo controlado del formulario
  dispara un `setState` → render de la vista → `onClose` nuevo → el
  efecto se limpia y vuelve a correr.
- En cada re-ejecución pasaban dos cosas encadenadas: (1) el cleanup del
  efecto anterior restauraba el foco al elemento previo (el botón que
  abrió el diálogo) y (2) el temporizador de foco inicial (0 ms) volvía a
  enfocar el primer enfocable del contenedor según el selector FOCUSABLE.
  El primer enfocable en el DOM es el botón X de cierre de la cabecera
  del diálogo (está antes que el formulario), así que cada letra
  terminaba con el foco en la X. El comentario del código decía «foco
  inicial en el primer campo visible», pero el código elegía el primer
  enfocable sin distinguir campos de botones: comentario y código no
  coincidían, y el código mandaba.

Secuencia por letra tipeada (antes): tecla → `setState` → render →
`onClose` nuevo → cleanup (foco al botón que abrió) → efecto nuevo →
timer → foco en la X. La letra sí entraba en el campo, pero el foco ya
no estaba ahí para la letra siguiente, lo que se percibía como «el
sistema entiende que cualquier tecla es para cerrar».

## Acciones

1. **`app/client/src/components/ui/dialog.tsx` (componente compartido,
   reutilizable en R3):**
   - `onClose` se guarda en `onCloseRef` (`onCloseRef.current = onClose`
     en cada render) y el handler de Escape llama a `onCloseRef.current()`.
   - El efecto depende SOLO de `[open]`. Su cleanup (restaurar el foco al
     elemento previo, quitar el listener, restaurar el scroll de la
     página) corre solo al cerrar de verdad o desmontar, no en cada
     pulsación.
   - Foco inicial al abrir: primer campo de formulario visible
     (`input`/`select`/`textarea` no deshabilitados, selector nuevo
     `FORM_FIELD`); solo si no hay ninguno, el primer enfocable. La X
     ya no es el primer foco por defecto.
   - Sin cambios en el resto: cierre con Escape, clic en el fondo, X y
     Cancelar; trampa de foco con Tab/Shift+Tab ciclando dentro del
     diálogo (la X sigue siendo parte del ciclo de Tab, como
     corresponde: es un control del diálogo, solo deja de ser el foco
     inicial); al cerrar, el foco vuelve al elemento que lo tenía al
     abrir.
2. **`app/client/src/features/oportunidades/OpportunitiesView.tsx`:**
   - `clearCreateForm` y `closeDialog` pasan a `useCallback` (cinturón y
     suspensores): `onClose` es estable entre renders. Ambas solo usan
     setters de estado, así que no hay estado capturado que quede
     desactualizado.
3. No se tocó nada más: ni textos, ni datos, ni colores de R1e, ni
   panel, ni menú, ni filtros, ni tabla.

## Archivos

- Modificados: `app/client/src/components/ui/dialog.tsx`,
  `app/client/src/features/oportunidades/OpportunitiesView.tsx`.
- Creado: `docs/R1F-DIALOGO-FOCO-REPORTE.md` (este informe).
- No tocados: `app/public/*`, `app/src/routes.ts` (MD5 verificados
  iguales a main: `app.js` `44ef9ae6daf62c3b9c335f6f2501256a`,
  `routes.ts` `202ecb4059ffe878c5451ecd905f8ba6`), backend, APIs, auth,
  `render.yaml`, workflows. Sin dependencias nuevas. `server.test.ts`
  no se tocó (ningún texto cambió).

## Pruebas

- Typecheck + build del cliente limpios: `npm run build` (tsc + Vite)
  sin errores; JS `index-DHHfyeHn.js` (310,33 kB), CSS
  `index-BH7v3Zms.css`, base `/v2/`, PNG del logo incluidos.
- Suite vitest: **123/123** (6 archivos), sin tocar ningún test.
- Smoke con servidor real (copia de la DB en `/tmp`, puerto 3424,
  proceso matado por PID exacto, temporales borrados):
  `/health` 200, `/v2` 302, `/v2/` 200, asset JS 200, asset CSS 200,
  `/` 200, `POST /api/auth/login` con la cuenta demo 200,
  `GET /api/opportunities` 200 con 3 oportunidades en la DB local
  copiada (no es la DB de la demo pública). Ningún servidor quedó
  corriendo.
- No se inventó un test de foco: el repo no tiene infraestructura de
  tests de componentes React (vitest corre tests de servidor/eval
  solamente), así que un test de foco no correría en la suite. La
  prueba de teclado queda para la verificación en vivo (ver abajo).

## Evidencia

- Código: `dialog.tsx` con `onCloseRef`, efecto con deps `[open]` y
  selector `FORM_FIELD` para el foco inicial; `OpportunitiesView.tsx`
  con `clearCreateForm` y `closeDialog` en `useCallback` (el import de
  `useCallback` ya existía en la vista).
- Los identificadores del JS construido están minificados, por lo que
  no se puede verificar la corrección por grep del bundle; la evidencia
  es el código fuente + typecheck + build + suite en verde.

## Decisiones

- Guardar `onClose` en un ref en vez de solo estabilizarlo con
  `useCallback` en la vista: defensa en dos capas. Si otra vista futura
  pasa un `onClose` no memoizado al `Dialog`, el efecto tampoco se
  re-correrá por pulsaciones; el ref siempre tiene la versión más
  reciente para Escape.
- Foco inicial en el primer campo y no en la X: es lo que el usuario
  espera al abrir un formulario (empezar a tipear sin un clic previo) y
  lo que el propio comentario original del diálogo ya declaraba.
- No se cambió la trampa de Tab: la X sigue dentro del ciclo, solo
  deja de ser el foco inicial y deja de ser reenfocada en cada tecla.

## Riesgos

- Si una vista futura necesitara reaccionar a un cambio de `onClose`
  mientras el diálogo está abierto (por ejemplo, cambiar el destino del
  cierre a mitad de camino), el ref lo cubre porque siempre apunta a la
  última versión; Escape usa la versión vigente, no una vieja.
- El foco inicial con `setTimeout(0)` se mantiene: corre una sola vez
  al abrir, así que no hay riesgo de reenfoque por render.

## Próximo paso

Aprobación de Tomás para subir y mergear (junto con R1e, que comparte
el mismo árbol local sin mergear). Tras el merge, la verificación en
vivo DEBE incluir explícitamente: abrir el diálogo «Nueva oportunidad»,
escribir varias letras en «Nombre de contacto», verificar que las
letras aparecen y el foco se queda en el campo, comprobar que Tab cicla
dentro del diálogo, y que Escape cierra y devuelve el foco al botón.

## Autorización requerida

Subir y mergear (decisión de Tomás, como siempre; no se hizo push, PR,
merge ni despliegue en esta fase).
