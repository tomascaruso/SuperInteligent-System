# Paso 1 — Composición (referencia visual SIS) — REPORTE

**Fecha:** 26-oct-2026 (noche, ART)
**Plan:** `docs/DIAGNOSTICO-REFERENCIA-VISUAL-SIS.md`, paso 1.
**Estado:** IMPLEMENTADO EN LOCAL, pendiente de subir y mergear.
Sin cambios de backend, sin cambios en la demo hasta el merge.

## Estado general

El encabezado de la app ahora muestra quién está adentro y si el
sistema respondió, con datos reales, y las tarjetas de Inicio
tienen más jerarquía. Nada de deltas, buscador decorativo ni
vistas nuevas: todo lo que se ve sale de `/api/me` o de la última
actualización comprobada.

## Objetivo

Acercar la composición a la referencia visual (usuario visible,
estado del sistema, jerarquía de métricas) sin inventar ningún
dato ni funcionalidad.

## Acciones

- Encabezado: chip de usuario (nombre y rol de `/api/me`) y
  píldora de estado junto a los botones existentes (Recorrido,
  Actualizar, Salir). La línea de sesión pasó a ser una
  bienvenida: «Hola, {nombre} — {organización} ({rol})».
- Indicador de sistema honesto: empieza en «Conectando…»; tras
  cada actualización dice «Sistema operativo» solo si la carga de
  la API tuvo éxito y «Sin conexión» si falló. Nunca afirma un
  estado que no se acaba de comprobar.
- Tarjetas de Inicio: el valor usa el tamaño display (32 px) en
  vez del título de página (28 px), con los tokens existentes.
- Estilos nuevos solo con tokens existentes (sin colores nuevos):
  `.user-chip`, `.status-pill`, `.status-dot`, `.header-actions`,
  `.header-meta`.

## Archivos

- `app/public/index.html` (encabezado: chip + píldora)
- `app/public/app.js` (`showApp`, `setSystemStatus`, `refresh`)
- `app/public/styles/layout.css` (header-actions, header-meta,
  valor de stat-card)
- `app/public/styles/components.css` (chip y píldora)
- `app/src/server.test.ts` (3 tests marcadores nuevos)

## Pruebas

- `node --check public/app.js`: OK.
- Typecheck y build (`tsc`): limpios.
- Suite: **108/108** (105 previos + 3 nuevos del paso).
- Smoke local (copia de la DB en /tmp, puerto libre): `/health`
  OK y la página servida contiene `user-chip`, `system-status` y
  «Conectando…».

## Evidencia

- Suite 108/108, smoke `/health` `{"status":"ok"}`.
- Verificación en vivo pendiente: solo corresponde tras el merge
  (la demo pública redespliega desde `main`).

## Decisiones

- Sin sublíneas en las tarjetas: no hay un dato real obvio por
  tarjeta sin trabajo nuevo, y la jerarquía se logra con tamaño y
  color, no con texto inventado.
- `textContent` sin escape en la bienvenida y el chip: el
  navegador no interpreta el texto como HTML, así que es seguro
  por construcción (el código anterior escapaba y luego asignaba
  a `textContent`, lo que era incorrecto).
- El rol se muestra tal como lo da la API (`admin`/`member`), sin
  inventar etiquetas traducidas.

## Riesgos

- Ninguno funcional: no cambia rutas, permisos ni datos. El único
  cambio visual sensible es el encabezado en móvil (los elementos
  envuelven por `flex-wrap`); la matriz RWD se re-verifica en
  vivo tras el merge, como en Fase 6.

## Próximo paso

Subir y mergear (con autorización de Tomás); luego verificación
en vivo solo lectura (indicador en «Sistema operativo», chip con
la cuenta demo, indicadores 3/3/1/0) y después el paso 2 del plan
(panel Orquestador).

## Autorización requerida

Merge a `main` (despliega la demo pública).
