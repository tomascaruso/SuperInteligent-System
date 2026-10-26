# Fase 6 — Informe (UI/UX System OS v1.1: QA y cierre)

**Fecha:** 26-oct-2026 (tarde, ART)
**Rama:** `ui-fase1-foundations` (local, sin subir ni mergear)
**Estado de la fase:** PASS con limitaciones documentadas
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, sección
Fase 6, criterios de la sección 11 y estrategia de la sección 12

## Estado de la fase

- Fase y objetivo: QA y cierre — pruebas funcionales, responsive,
  accesibilidad, errores y recuperación, permisos, regresiones,
  revisión del diff y documentación del design system (sección 14).
- Estado: PASS. Ningún criterio en FAIL y ningún bloqueo de lanzamiento
  detectado. En la entrega original, tres criterios quedaron en
  NOT_VERIFIED con su motivo (ver tabla): recorrido de teclado, matriz
  real de viewports y captura de consola. El 26-oct-2026, verificación
  en vivo posterior (ver sección al final): A11Y-001 y RWD-001 pasan a
  PASS con evidencia; QA-003 sigue NOT_VERIFIED. No se afirma lo que
  no se probó.
- Archivos modificados: `app/public/index.html`,
  `app/public/app.js`, `app/public/styles/tokens.css`,
  `app/src/server.test.ts`, `README.md`.
- Archivos creados: los 14 de `docs/design-system/` (ver abajo) y este
  informe.
- Funcionalidades afectadas: ninguna rota. Los endpoints, la
  autenticación y los datos son los mismos; cambian solo la
  recuperación ante sesión expirada/red, la protección de dobles
  envíos, los anuncios para lectores de pantalla y dos tokens de color.
- Decisiones tomadas: ver abajo y `docs/design-system/DECISIONS.md`.
- Pruebas ejecutadas: build/typecheck, suite completa (72/72), sintaxis
  de `app.js`, smoke con servidor real y auditoría estática de CSS/HTML/
  JS con contrastes medidos.
- Resultados reales: ver abajo.
- Riesgos detectados: ninguno crítico. Ver limitaciones.
- Limitaciones pendientes: QA-003 (NOT_VERIFIED; consola no leída directamente, solo ausencia de errores visibles).
- Próximo paso recomendado: decidir si se sube la Fase 6 a la rama
  remota (sin mergear a `main`) o se mergea; la verificación visual en
  vivo post-merge puede cubrir el recorrido de teclado y la ausencia de
  roturas visibles, pero no la matriz de viewports ni la consola.

## Resumen de cambios

### Implementado

- `app.js`: `api()` adjunta el estado HTTP al error; `refresh()` ante
  401 vuelve a la pantalla de acceso («La sesión expiró. Volvé a
  entrar.») en vez de dejar la app visible con datos viejos; ante fallo
  de red muestra el mensaje en español en vez del mensaje del navegador.
- `app.js`: entrar, aceptar invitación y actualizar usan `withLoading`
  (antes solo crear, completar y confirmar lo usaban): no hay dobles
  envíos en ninguna acción principal.
- `app.js`: al mostrar el formulario de invitación, el foco va al campo
  del código.
- `index.html`: `#error` con `role="alert"`; los cuatro mensajes de
  sección con `aria-live="polite"`.
- `styles/tokens.css`: texto secundario `#64748B` → `#5A6A80` y
  auxiliar `#94A3B8` → `#63738C` (desviación documentada, ver abajo).
- `server.test.ts`: 3 tests nuevos de Fase 6 (anuncios, recuperación y
  dobles envíos, tokens).
- `docs/design-system/`: README, DESIGN_PRINCIPLES, VISUAL_FOUNDATIONS,
  DESIGN_TOKENS, COMPONENT_CATALOG, COMPONENT_STATES,
  INFORMATION_ARCHITECTURE, SCREEN_SPEC, INTERACTION_PATTERNS,
  AI_TRUST_AND_APPROVALS, ACCESSIBILITY, RESPONSIVE_BEHAVIOR,
  ACCEPTANCE_TESTS, DECISIONS. Documentan la implementación real y
  enlazan los informes de fase en vez de duplicarlos.

### Verificado

- Build/typecheck limpios; **72/72 tests en verde** (3 nuevos Fase 6).
- `node --check public/app.js` sin errores (el build no compila el JS
  de la UI: este chequeo cubre ese hueco).
- Smoke con servidor real sobre COPIA de la base local (la base real no
  se tocó): `aria-live` servido, token nuevo servido, login demo 200,
  `/api/me` y stats correctos.
- Contrastes medidos con cálculo de luminancia (no estimados): todos
  los pares texto/fondo pasan WCAG AA en blanco y en canvas (tabla en
  `docs/design-system/ACCESSIBILITY.md`).
- Reglas responsive inspeccionadas: 1023 (layout), 767 (tablas a
  tarjetas), 640 (indicadores y botones), sin scroll horizontal global
  por construcción (`min-width: 0`, `minmax(0, 1fr)`, `flex-wrap`,
  scroll interno en tarjetas).
- Permisos: el servidor exige admin para aprobar/rechazar/reintentar
  (tests de C5/C6) y la UI oculta esas acciones al resto con nota de
  rol; ocultar no autoriza (documentado).
- Regresiones: suite completa en verde y smoke sin cambios de
  comportamiento fuera de lo listado.

### Pendiente

- Captura de consola en navegador real (QA-003): revisión manual pendiente (ver sección al final).
- UI de operador para crear invitaciones (C8 la dejó solo por API).
- Servicio worker en Render (pendiente desde C7, plan gratis por
  verificar).
- Cargar `OPERATOR_TOKEN` en Render (acordado para más adelante).

### Bloqueado

Nada. La falta de navegador automatizado en el entorno limita las
pruebas visuales reales, pero no bloquea la fase: se documenta como
NOT_VERIFIED en vez de afirmarse.

### No verificado

- QA-003 (ver tabla y sección al final). A11Y-001 y RWD-001 se verificaron
  en vivo el 26-oct-2026 (ver sección al final); la consola requiere
  revisión manual dedicada porque las herramientas disponibles no leen
  el registro de consola del navegador.

## Auditoría: hallazgos y qué se hizo con cada uno

1. **Sesión expirada dejaba la app visible con datos viejos.** Hallado
   en `refresh()`: el catch solo ponía el mensaje. Corregido (401 →
   acceso + mensaje). La salida con «Salir» ya existía como vía
   alternativa.
2. **Doble clic en Entrar, Crear mi organización y Actualizar.**
   Esas tres acciones no usaban `withLoading` (el resto sí).
   Corregido.
3. **Errores invisibles para lectores de pantalla.** Los mensajes de
   sección y el global no tenían anuncio. Corregido con `role="alert"`
   y `aria-live="polite"`.
4. **Contraste bajo en texto auxiliar y secundario.** Medido: auxiliar
   2,56:1 sobre blanco (falla AA) y secundario 4,48:1 sobre canvas
   (falla por 0,02). Corregido oscureciendo ambos tokens; la
   jerarquía se mantiene y la desviación queda documentada.
5. **Sin hallazgos en:** etiquetas de campos (todas asociadas),
   botones reales, foco visible, trampa de foco del diálogo, Escape,
   `aria-current`, `prefers-reduced-motion`, objetivos táctiles (40 px),
   badges con texto, estados vacíos y de carga, manejo de 409/403,
   reintento con tope y solo admin, alcance real de aprobaciones.

## Criterios de aceptación (sección 11)

| ID | Estado | Evidencia |
|---|---|---|
| DS-001 | PASS | Tokens verificados contra la especificación; una desviación documentada. |
| DS-002 | PASS | Inventario real en `COMPONENT_CATALOG.md`. |
| DS-003 | PASS | `COMPONENT_STATES.md` + marcadores en tests Fase 6. |
| UX-001 | PASS | 5 destinos por hash + `aria-current`; verificados en vivo tras cada merge. |
| UX-002 | PASS | Suite 72/72 + smokes + verificaciones en vivo. «Registro» adaptado a invitación (C8). |
| UX-003 | PASS | 409/403/401/red con manejo en UI; tests de marcadores. |
| IA-001 | PASS | Diálogo con alcance real; canal «No disponible» honesto. |
| IA-002 | PASS | Aprobación por id; 409 vencido/desactualizado (C5). |
| IA-003 | PASS | Nueva ejecución por reintento; tope y solo admin (C6). |
| A11Y-001 | PASS | Recorrido completo con Tab en vivo 26-oct-2026 (6 vistas + acceso + diálogo; ver sección al final). Observación menor: tras varios Tab desde Cancelar, el contorno quedó fijo sin moverse visiblemente (Shift+Tab volvía a Aprobar; nada inalcanzable). |
| A11Y-002 | PASS | Foco visible; contrastes medidos. |
| RWD-001 | PASS | Matriz real en vivo 26-oct-2026 (375/768/1280/1920, un ancho por cada rango de la especificación; ver sección al final). Detalle menor: en 768 el ítem Agentes queda cortado al borde, alcanzable con desplazamiento. |
| SEC-001 | PASS | 401/403/404 en suite; ocultar no autoriza. |
| QA-001 | PASS | Suite 72/72 + smoke, sin regresiones conocidas. |
| QA-002 | PASS | Solo estados reales; carga y vacío etiquetados. |
| QA-003 | NOT_VERIFIED | Sin errores visibles en página durante el recorrido 26-oct-2026, pero el registro de consola no pudo leerse directamente (sin acceso a devtools); falta revisión manual. |

## Bloqueos de lanzamiento (sección 11, revisión punto por punto)

- Acción sensible sin autorización: no. El servidor exige admin y
  org propia; la UI solo oculta.
- Éxito falso ante fallo del servidor: no. Los errores se muestran y
  el diálogo se cierra con mensaje + recarga del estado real.
- Datos de otra organización expuestos: no. Filtrado por `org_id` en
  servidor + tests de escape.
- Aprobación que no corresponde al contenido: no. Foto del mensaje y
  409 vencido/desactualizado (C5).
- Defecto crítico en un flujo principal: ninguno hallado.
- Operación fallida irrecuperable: no. Reintento, recarga, nuevo
  ingreso y rechazo de borradores vencidos existen como vías.

## Revisión del diff

Cambios acotados a 5 archivos de código/estilos/tests + 15 de
documentación. Sin cambios en `routes.ts`, `server.ts`, `db.ts` ni
contratos de API. Sin capacidades nuevas: solo recuperación, anuncios,
dobles envíos y color. El diff completo queda en el commit de la fase.

## Próximo paso

Esperar la decisión de Tomás: subir Fase 6 a la rama y/o mergear a
`main` (con su verificación visual posterior), o encarar lo siguiente
(F1-CI, revisión demo, `OPERATOR_TOKEN`, servicio worker).

## Verificación en vivo posterior — 26-oct-2026 (A11Y-001, RWD-001, QA-003)

Solo lectura en la demo pública, sin cambios de estado (indicadores
3/3/1/0 idénticos al inicio y al final; borrador de Lucía Fernández
sigue pendiente). La ventana se redimensionó a mano (las herramientas
no permiten redimensionar) con ayuda de Tomás.

### A11Y-001 → PASS

Recorrido completo con Tab: encabezado (Recorrido guiado → Actualizar
→ Salir), navegación (Inicio → Oportunidades → Tareas y seguimientos
→ Aprobaciones → Actividad y ejecuciones → Agentes) y contenido.
Paradas: Inicio 14 (ciclo completo verificado), Oportunidades 14
(formulario completo; celdas de tabla no enfocables), Tareas 12 (3
«Marcar hecha» solo recorridos), Aprobaciones 11 (Aprobar → Rechazar
solo recorridos), Actividad 12 (3 «Ver pasos» solo recorridos),
Agentes 9 (solo tarjetas), acceso 9 (Correo → Contraseña → Entrar →
Tengo una invitación → Nombre → Correo → Empresa → Mensaje → Enviar;
ningún formulario enviado). Diálogo «Aprobar borrador» (Lucía): foco
inicial en Aprobar, orden Aprobar → Cancelar, cierre con Escape y con
Cancelar verificados, sin aprobar ni rechazar. Observación menor:
tras varios Tab desde Cancelar, el contorno visible quedó fijo sin
moverse; Shift+Tab volvía a Aprobar. Nada inalcanzable.

### RWD-001 → PASS

Un ancho por cada rango de la especificación (móvil <640, tablet
640–1023, escritorio 1024–1439, ancho ≥1440): 375 (tabla colapsada en
tarjetas con etiqueta y valor; navegación en tira con desplazamiento;
formulario apilado sin cortes), 768 (tabla completa 5 columnas
legible; navegación en tira, ítem Agentes cortado al borde pero
alcanzable con desplazamiento), 1280 (navegación completa sin
desplazamiento; formulario en 3 columnas; indicadores en grilla de 2
columnas), 1920 (todo completo, sin roturas). El panel del recorrido
guiado nunca se inició: en todos los anchos es solo un botón y no tapa
contenido.

### QA-003 → sigue NOT_VERIFIED

Durante el recorrido no apareció ningún error visible en la página y
todas las vistas cargaron completas, pero el registro de consola no
pudo leerse directamente con las herramientas disponibles (sin acceso
a las herramientas de desarrollo del navegador). No se afirma consola
limpia: falta una revisión manual de la consola.
