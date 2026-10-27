# LOGIN-V2 — Rediseño del inicio de sesión de /v2/ (dos paneles, sin scroll)

- **Estado:** COMPLETO EN LOCAL (sin merge, sin despliegue).
- **Alcance:** solo cliente React. Sin cambios de servidor. Vanilla intacta
  (`public/app.js` MD5 `44ef9ae6…`, ver Pruebas). La pantalla actual en `/`
  no se toca: esto es solo la pantalla de acceso de `/v2/`.

## Objetivo

Rehacer la pantalla de acceso de `/v2/` en dos paneles, tal cual la
referencia aprobada por Tomás (27-oct ~19:38), con todo el contenido
visible sin scrollear, y con los 4 ajustes honestos aprobados
(27-oct ~19:40).

## Qué cambió

- `app/client/src/features/auth/LoginScreen.tsx` (reescrito, lógica intacta).
- `app/client/src/App.tsx` (mínimo, ver abajo).

### Panel izquierdo (fondo claro, oculto bajo 1024 px por diseño)

- Logo SIS aprobado (remolino, `sis-logo.png`) + título
  «Inteligencia artificial que trabaja para tu negocio» + subtítulo
  «Coordina procesos, supervisa agentes especializados y transforma tareas
  operativas en flujos de trabajo inteligentes.»
- 4 rubros con icono Lucide y descriptor breve y honesto: Agentes
  especializados, Procesos coordinados, Control y trazabilidad,
  Adaptación a tu negocio.
- Ilustración abstracta en SVG puro (panel de operaciones, tarjetas de
  flujo, diagrama de nodos): solo formas, sin texto, sin números, sin
  nombres inventados y sin métricas.
- Pie: «Tecnología sofisticada explicada con simplicidad empresarial.
  Menos tareas. Más sistema.»

### Panel derecho (blanco, centralizado)

- Arriba, marca pequeña (`sis-mark.png`) + «SIS / SuperInteligent System /
  by PENSIA».
- Tarjeta «Bienvenido» + «Inicia sesión para acceder a tu espacio de
  trabajo»: Correo electrónico (placeholder `nombre@empresa.com`),
  Contraseña con botón accesible mostrar/ocultar (mismo comportamiento
  que antes), botón «Iniciar sesión» ancho completo índigo.
- Debajo, el texto honesto de ayuda: «¿Necesitas ayuda para acceder?
  Contacta con el administrador de tu organización.» — cuando el relay
  está habilitado es un botón que abre el contacto real; si no, es texto
  plano (fail-closed intacto).
- Secundarios debajo de la tarjeta: «Tengo una invitación» (flujo C8
  intacto), cuenta demo visible (`demo@agenciamartin.demo` /
  `Demo1234!`) y pie «SuperInteligent System · by PENSIA».
- Intactos: login (`onAuthenticated`), invitación, contacto con honeypot,
  manejo de errores, foco inicial en los formularios secundarios y textos
  de error actuales.

### Sin scroll (principal)

- Shell con `100dvh`: en escritorio (≥1024 px) los dos paneles entran
  completos sin scroll de página (espaciados compactos, título con
  `clamp`, ilustración flexible con `min-h-0`); el panel derecho
  desplaza internamente solo si se expanden los formularios secundarios
  (invitación/contacto), que son la única excepción admitida.
- En móvil (<1024 px) el panel izquierdo se oculta por diseño
  (form-first) y solo se muestra el acceso.
- `App.tsx`: se quitó el envoltorio con margen (`mt-4`) de la rama de
  acceso (rompía el ajuste a `100dvh`) y el mensaje del padre (sesión
  expirada / servidor caído) ahora llega como prop `accessError` y se
  muestra dentro de la tarjeta. El `Alert` vacío ya no agregaba altura
  (retorna `null` sin hijos); se quitó además su import sin uso.

## Las 4 desviaciones honestas respecto de la referencia

1. **Logo:** remolino SIS aprobado, no la marca órbita de la referencia.
2. **Sin «Recordarme» ni «¿Olvidaste tu contraseña?» operativos:** no
   existen en el backend (sesión por cookie httpOnly del servidor; no hay
   recuperación). No aparecen en la interfaz renderizada (solo se los
   menciona en comentarios del código que explican la decisión).
3. **Invitación, demo y contacto se mantienen** como secundarios: la
   referencia no los mostraba, pero son funciones reales y no pueden
   desaparecer. El viejo «¿No tenés una cuenta? Contactanos» se unificó
   en la línea de ayuda al administrador (mismo destino: el contacto
   real).
4. **Gráfico abstracto sin datos inventados:** reemplaza al MiniDashboard
   anterior de la v2, que tenía números (24/18/6/12) y nombres de
   ejemplo (Juan, TechSolutions, Global Services, Industrias del Sur).
   Ninguno de esos valores existe ya en el código ni en el bundle.

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no hay tests
  nuevos de servidor; el cliente no tiene runner de tests en este repo).
- Build limpio; `tsc -p client/tsconfig.json --noEmit` limpio;
  `node --check public/app.js` OK.
- Vanilla intacta (MD5 `44ef9ae6daf62c3b9c335f6f2501256a`); DB real local
  intacta (MD5 `af175edc7673befe9b9f3ace3c556c12`); ningún proceso en pie.
- Smoke propio en copia de DB (puerto 3481, matado por PID, verificado
  con `ps`): health OK, login demo OK, `GET /api/opportunities` OK.
- Grep en fuente y bundle: presentes «Menos tareas. Más sistema.» y
  «Contacta con el administrador»; ausentes en el bundle «Recordarme»,
  «Olvidaste tu contraseña», «TechSolutions», «Global Services»,
  «Industrias del Sur» y «Bienvenido, Juan» (0 coincidencias cada uno).

## Verificación pendiente (no verificable en esta VM)

En esta VM NO hay Chromium/Playwright, así que el no-scroll NO se pudo
verificar visualmente: la estructura está preparada para eso (shell
`100dvh`, paneles sin desborde, ilustración flexible), pero la
verificación en vivo post-merge debe confirmar explícitamente el
no-scroll en escritorio (≥1024 px, ambos paneles) y en móvil (solo el
formulario), además del comportamiento habitual solo lectura.

## Lo NO construido

- Sin «Recordarme» real (exigiría cambio de servidor en la cookie) ni
  recuperación de contraseña (no hay backend): no se fingen.
- Sin cambios en la pantalla vanilla, sin endpoints nuevos, sin cambios
  de textos de error ni de flujos de login/invitación/contacto.
