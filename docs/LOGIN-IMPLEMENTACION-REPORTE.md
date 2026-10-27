# Pantalla de acceso SIS — REPORTE DE IMPLEMENTACIÓN (L1+L2+L3)

**Fecha:** 26-oct-2026 (noche, ART)
**Diseño:** `docs/DIAGNOSTICO-LOGIN-SIS.md` (con la corrección de
Tomás: mini-dashboard ilustrativo de venta; logo pendiente).
**Estado:** IMPLEMENTADO EN LOCAL, pendiente de subir y mergear.
Sin cambios de backend, sin cambios en la demo hasta el merge.

## Estado general

La pantalla de acceso ahora es la de dos paneles de la
referencia: marca y propuesta a la izquierda, formulario a la
derecha. Se implementaron juntos L1 (layout y paneles), L2
(controles menores) y L3 (mini-dashboard ilustrativo) porque son
todos presentación y la pantalla quedaba incompleta sin el
mini-dashboard. L4 (verificación en vivo) corresponde tras el
merge.

## Objetivo

Acercar la experiencia de acceso a la imagen, reutilizando el
mecanismo real de autenticación, sin simular funciones que no
existen.

## Acciones

- `auth-section` reescrita en dos paneles (`.login-layout`):
  marca tipográfica SIS + SuperInteligent System + by PENSIA
  (sin asset de logo: Tomás lo provee más adelante), titular,
  descripción y 4 beneficios con los textos exactos del brief,
  y cierres de marca.
- Panel derecho: encabezado con marca, «Bienvenido» y subtítulo;
  campos correo electrónico y contraseña; botón «Iniciar
  sesión» (mismo handler y `withLoading`); «Tengo una
  invitación» con el formulario existente; línea de la cuenta
  demo preservada; enlace «¿No tenés una cuenta? Contactanos»
  que revela el formulario de contacto existente.
- Mini-dashboard ilustrativo de venta en el panel izquierdo:
  composición estática (4 mini tarjetas, gráfico de líneas y
  donut en SVG, mini tabla), con contenido decorativo marcado
  `aria-hidden`. No lleva leyenda visible (decisión de Tomás
  26-oct-2026: no dice «Vista ilustrativa»). No es interactivo
  (sin enlaces), no llama a ninguna API y no presenta sus
  números como datos del visitante ni de la demo.
- Toggle mostrar/ocultar contraseña (nuevo handler menor, con
  `aria-label` y `aria-pressed`); no cambia la autenticación.
- Contacto: el enlace solo aparece si `/api/contact/status`
  dice que el relay está configurado (mismo `fail-closed`);
  antes el formulario se mostraba directo, ahora se revela con
  el enlace y el foco va al primer campo. El envío es el mismo.
- Responsive: por debajo de 1024 px, una columna con el
  formulario primero y la marca compacta (beneficios, vista
  previa y cierres ocultos). Sin paleta, tipografía ni
  componentes nuevos: solo tokens existentes.
- Se eliminó el bloque «Qué hace» anterior: su sustancia quedó
  en el panel de marca (titular, descripción y beneficios).
  Ninguna funcionalidad se perdió: login, invitación, demo y
  contacto siguen intactos.

## Archivos

- `app/public/index.html` (solo `auth-section`)
- `app/public/app.js` (toggle + enlace de contacto + cambio de
  visibilidad del enlace; resto reutilizado)
- `app/public/styles/layout.css` (grid de dos paneles y colapso)
- `app/public/styles/components.css` (marca, beneficios, vista
  previa, password-wrap)
- `app/src/server.test.ts` (3 tests marcadores nuevos)
- Sin cambios en `src/` (backend), rutas ni sesión.

## Pruebas

- Estructura HTML verificada (sin etiquetas sin cerrar).
- `node --check public/app.js`: OK.
- Typecheck y build (`tsc`): limpios.
- Suite: **111/111** (108 previos + 3 nuevos).
- Smoke local (copia de la DB en /tmp, puerto libre): `/health`
  OK y la página servida contiene `login-layout`,
  `login-preview`, «Vista ilustrativa», «Bienvenido»,
  `btn-toggle-password` y `btn-show-contact`.

## Evidencia

- Suite 111/111, smoke `/health` `{"status":"ok"}`.
- Verificación en vivo pendiente (L4): solo corresponde tras
  el merge (la demo pública redespliega desde `main`).

## Decisiones

- L1+L2+L3 juntos: toda la pantalla es presentación y separarla
  dejaba el panel de marca sin su pieza central.
- El mini-dashboard es estático y no interactivo a propósito:
  si sus filas fueran enlaces, apuntarían a vistas que no
  existen.
- Sin leyenda visible en la vidriera, por decisión de Tomás:
  la salvaguarda restante es que la composición es estática, no
  interactiva y sin conexión a datos (no puede mostrar datos de
  nadie porque no consulta ninguno).
- El logo queda tipográfico hasta que Tomás provea el asset.

## Riesgos

- Ninguno funcional: no cambian endpoints, sesión, validación
  ni autorización. El único cambio de comportamiento es que el
  formulario de contacto ahora se revela con un enlace en vez
  de mostrarse directo (cuando el relay está configurado).
- La verificación en vivo debe comprobar: login con la cuenta
  demo, despliegue de invitación, enlace de contacto y vista en
  móvil (formulario primero).

## Próximo paso

Subir y mergear (con autorización de Tomás); luego L4,
verificación en vivo solo lectura más comprobación de login
con la cuenta demo.

## Autorización requerida

Merge a `main` (despliega la demo pública).

## Verificación en vivo L4 (26-oct-2026 ~22:38 ART)

- Mergeado PR #40, `main` `55c3ad66`. Al primer ingreso la
  demo todavía servía la versión anterior (caché); con una
  navegación fresca cargó la nueva.
- Pasó: panel derecho completo («Bienvenido», correo,
  contraseña, «Iniciar sesión», cuenta demo visible, «Tengo
  una invitación», «Contactanos»); toggle mostrar/ocultar
  funciona en ambos sentidos; invitación despliega el
  formulario (sin enviar); contacto revela el formulario (sin
  enviar); login con la cuenta demo entra bien (chip «Martín
  Demo · admin», píldora «Sistema operativo» tras pasar por
  «Conectando…»); indicadores 3/0/0/0; las 6 vistas sin
  errores; sin leyenda «Vista ilustrativa» en ningún lado.
- Hallazgo: en la vista verificada NO se vieron los 4
  beneficios ni el mini-dashboard del panel izquierdo. Causa
  verificada en `main` (no un faltante del despliegue): el
  código desplegado SÍ los contiene (`login-benefits`,
  `login-preview` presentes en `index.html` de `main`), pero
  la regla responsive los oculta por debajo de 1024 px
  (`display: none` en `layout.css`), que es el comportamiento
  diseñado para móvil según el brief (marca compacta,
  formulario primero). La verificación corrió en una vista
  angosta, por eso no se vieron.
- Pendiente: confirmación en ancho de escritorio (≥1024 px) de
  que beneficios y mini-dashboard se muestran.
- Verificación de Tomás en tablet 26-oct-2026 ~22:46
  (captura): por debajo de 1024 px primero se ve el
  formulario y debajo el panel de marca compacto (titular y
  descripción, sin beneficios ni mini-dashboard), que es el
  comportamiento diseñado para tablet/móvil.
- Sesión final: iniciada (no se cerró al terminar). No se
  crearon organizaciones, no se envió el contacto, no se
  aprobaron/rechazaron borradores ni se tocaron tareas u
  oportunidades.
