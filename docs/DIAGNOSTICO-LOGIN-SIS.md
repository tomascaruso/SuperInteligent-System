# Diagnóstico y diseño — Pantalla de acceso SIS

**Fecha:** 26-oct-2026 (noche, ART)
**Referencia:** imagen de acceso SIS by PENSIA (dos paneles) +
brief en `docs/LOGIN-EXPERIENCE-BRIEF.md`.
**Realidad comparada:** `app/public/index.html` (sección
`auth-section`), `app/public/app.js` (login, invitación,
contacto), `app/public/styles/` (tokens, base, componentes,
layout) y endpoints reales (`/api/auth/login`,
`/api/auth/accept-invitation`, `/api/auth/logout`,
`/api/contact/status`, `/api/contact`).
**Estado:** DIAGNÓSTICO Y DISEÑO COMPLETOS. Sin cambios de
código, sin merges ni despliegues. La implementación espera
autorización de Tomás por paso.
**Corrección 26-oct-2026 (decisión de Tomás):** el
mini-dashboard SÍ se implementa, como presentación comercial
ilustrativa para el público que todavía no adquirió SIS (no
como captura real ni como datos del visitante); el logo lo
provee Tomás más adelante y se adapta entonces.

## Realidad actual de la pantalla de acceso

Una sola columna, en este orden: bloque «Qué hace» (problema,
para quién, 3 pasos), «Acceso» (correo + contraseña, botones
Entrar y «Tengo una invitación»), formulario de invitación
desplegable (código, nombre, contraseña, «Crear mi
organización»), línea de la cuenta demo visible y formulario de
contacto «Quiero una demo para mi empresa» (oculto hasta que
`/api/contact/status` dice que el relay está configurado).

Flujos reales que se reutilizan tal cual, sin tocar:

- Entrar: `POST /api/auth/login` con `withLoading` (sin dobles
  envíos), luego `refresh()`; error en `#error` con
  `role="alert"`.
- Invitación: botón que despliega el formulario y pone el foco
  en el código; `POST /api/auth/accept-invitation` con
  `withLoading`.
- Contacto: `POST /api/contact` con `withLoading`, honeypot,
  límite 5/hora/IP y `fail-closed` (sin relay, oculto y 503);
  feedback con `aria-live`.
- Sesión expirada (401): vuelve a la pantalla de acceso con
  mensaje, en vez de dejar la app visible con datos viejos.
- Cierre de sesión real (`POST /api/auth/logout`, cookie
  httpOnly) y rate limit de login (20 fallidos/15 min por IP).
- Sin registro público, sin OAuth, sin recuperación de
  contraseña, sin «Recordarme».

## Diseño tal cual está (especificación)

Composición de la imagen, adaptada solo donde el brief o la
realidad lo exigen (cada adaptación está marcada). Sin paleta,
tipografía ni componentes nuevos: tokens actuales.

**Estructura (escritorio, ≥1024 px):** dos paneles. Fondo
`--color-canvas` (`#f7f8fc`); paneles en `--color-surface`
(blanco), borde `--color-border`, radio tarjeta 12 px, sombras
existentes. Izquierda ~55–60 %, derecha el resto, centrada
verticalmente.

**Panel izquierdo (marca y propuesta):**

- Marca tipográfica «SIS» en `--color-primary` + «SuperInteligent
  System» + «by PENSIA». No hay asset de logo en el repo: el
  isotipo de la imagen NO se reproduce como archivo inventado;
  la marca se resuelve con texto por ahora. Tomás proveerá el
  logo más adelante y se adaptará al sistema entonces.
- Titular exacto: «Inteligencia artificial que trabaja para tu
  negocio» (con «tu negocio» destacado en índigo).
- Descripción exacta: «Orquesta agentes, automatiza procesos y
  toma el control de tus operaciones con una plataforma diseñada
  para empresas que quieren avanzar».
- Cuatro beneficios con título y texto exactos del brief:
  Agentes especializados («Cada tarea, el agente ideal»),
  Procesos automatizados («Menos tareas manuales, más
  resultados»), Control y trazabilidad («Visibilidad total en
  cada paso»), Adaptable a tu negocio («Configura, integra y
  escala»).
- Región de vista previa del producto: ocupa el lugar del
  mini-dashboard de la imagen, como composición ilustrativa de
  venta (decisión de Tomás; ver «El punto honesto» abajo).
- Cierre de marca: «Tecnología sofisticada explicada con
  simplicidad empresarial» y «Menos tareas. Más sistema.»

**Panel derecho (formulario):**

- Encabezado: marca SIS + «SuperInteligent System» + «by
  PENSIA», título «Bienvenido», subtítulo «Iniciá sesión para
  acceder a tu sistema de agentes inteligentes».
- Campos con etiquetas explícitas (las actuales): correo
  electrónico y contraseña. Nuevo menor: control
  mostrar/ocultar contraseña (cambia el `type` del campo, sin
  componente nuevo, con `aria-label` y `aria-pressed`).
- Botón destacado «Iniciar sesión» (`btn-primary` +
  `withLoading` existente, sin dobles envíos).
- Debajo, en texto atenuado, la línea de la cuenta demo
  (preservada: es la única vía de entrada a la demo pública).
- Botón secundario «Tengo una invitación» que despliega el
  formulario existente, mismo comportamiento y foco actual.
- Enlace «¿No tenés una cuenta? Contactanos» que revela el
  formulario de contacto existente; si el relay no está
  configurado, el enlace no se muestra (mismo `fail-closed`
  actual, no un destino inventado).
- `#error` con `role="alert"` dentro del panel (el mismo
  mecanismo actual).
- Pie discreto: «PENSIA — Intelligent Business Automation».

**Responsive:** por debajo de 1024 px, una columna con el
formulario primero; la marca se compacta a logo textual +
titular (beneficios y vista previa se ocultan en móvil para no
empujar el formulario). Por debajo de 640 px, igual que el resto
de la app.

**Accesibilidad (patrones existentes que se conservan):**
etiquetas explícitas, foco visible, contraste de tokens,
`role="alert"` en errores, `aria-live` en el feedback de
contacto, objetivos táctiles de los botones actuales, sin
depender solo del color.

## El punto honesto: lo que la imagen muestra y NO va

| Elemento de la imagen | Veredicto |
|---|---|
| Dos paneles, marca, titular, 4 beneficios, formulario | SE DISEÑA TAL CUAL (textos exactos del brief) |
| Mini-dashboard con 24/18/6/12, +12 %, −33 %, vistas Clientes/Reportes/Configuración, «Juan», «TechSolutions» | SÍ SE IMPLEMENTA, como presentación comercial ilustrativa (decisión de Tomás 26-oct-2026): es la vidriera para el público que todavía no adquirió SIS. Composición estática, NO interactiva, NO conectada a datos reales y claramente identificada como ilustrativa: no son los datos del visitante ni de la demo. Los números y vistas del mockup se mantienen como contenido ilustrativo de venta, no como afirmaciones sobre el sistema real |
| «Continuar con Google» | NO VA como operativo: no existe OAuth. El brief lo permite omitir. No se simula |
| «Recordarme» | NO VA: no hay comportamiento definido y cambiaría la semántica de la sesión |
| «¿Olvidaste tu contraseña?» | NO VA: no existe flujo de recuperación |
| Fecha «28 de abril de 2025» del mockup | Demostrativa; la fecha real, si se muestra alguna, es la del navegador |
| Tipografía geométrica de la imagen | NO VA: rige `--font-sans` (system stack) del System OS |
| Isotipo SIS de la imagen | NO se reproduce como asset; marca tipográfica por ahora; el logo lo provee Tomás más adelante y se adapta entonces |
| Errores asociados a cada campo (brief §6) | BRECHA: hoy el error es global (`#error`). En fase 1 se conserva el global (accesible); la asociación por campo queda como mejora posterior porque exige cambiar el manejo de errores del login |

## Riesgos

- Ninguno sobre la autenticación si se cumple el alcance: el
  rediseño toca solo `auth-section` + CSS + dos handlers menores
  (toggle de contraseña, revelar contacto). No se tocan
  endpoints, sesión, validación ni autorización.
- Riesgo principal, evitado por diseño: convertir la maqueta en
  funciones simuladas (Google, recuperar, recordarme, dashboard
  con datos falsos). Cada uno está marcado NO VA arriba.
- La vista previa es ilustrativa de venta: el riesgo es que se
  confunda con datos reales. Mitigación: composición estática,
  no interactiva, sin conexión a APIs ni enlaces a vistas;
  nunca presenta sus números como datos del visitante ni de la
  demo. Sin leyenda visible «Vista ilustrativa», por decisión
  de Tomás (26-oct-2026).

## Plan de implementación (para después, sin ejecutar)

- **L1 — Layout y paneles:** `auth-section` en dos paneles con
  los textos exactos; se reutilizan todos los handlers
  existentes. Sin tocar backend.
- **L2 — Controles menores:** toggle mostrar/ocultar
  contraseña y enlace «Contactanos» que revela el contacto
  existente (respetando `fail-closed`).
- **L3 — Mini-dashboard ilustrativo:** composición estática de
  venta según la referencia (tarjetas, gráfico y tabla
  ilustrativos, sin datos reales ni interactividad).
- **L4 — Verificación:** tests marcadores (mismo patrón del
  paso 1: `GET /` con los nuevos elementos, `GET /app.js` con
  el toggle), typecheck, build, smoke y verificación en vivo
  post-merge solo lectura (incluye entrar con la cuenta demo y
  comprobar que login, invitación y contacto siguen
  funcionando; sin crear organizaciones ni enviar contactos de
  prueba salvo un único envío si Tomás lo autoriza).

## Archivos a modificar (identificados, no modificados)

- `app/public/index.html` (solo `auth-section`).
- `app/public/styles/layout.css` (layout de dos paneles y su
  colapso responsive).
- `app/public/styles/components.css` (panel y formulario solo
  si hace falta más allá de los componentes existentes).
- `app/public/app.js` (toggle de contraseña y revelar
  contacto; resto reutilizado).
- Sin cambios en `src/routes.ts`, `src/db.ts`, `src/auth` ni
  en ningún endpoint.
