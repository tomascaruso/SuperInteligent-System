# Fase 2 — Informe (UI/UX System OS v1.1: Layout y navegación)

**Fecha:** 25-oct-2026 (noche, ART)
**Rama:** `ui-fase1-foundations` (commit local `c7744b4`, sobre `5cfef17` Fase 1)
**Estado de la fase:** PASS
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, secciones 3.1–3.3 y 5.12 parcial
(no aplica), con criterios UX-001 y UX-002

## Estado de la fase

- Fase y objetivo: Layout y navegación — navegación principal, encabezados de
  página, estructura de contenido, sección activa, adaptación móvil y estados de
  navegación y permisos cuando existen.
- Estado: PASS.
- Archivos modificados: `app/public/index.html`, `app/public/app.js`,
  `app/public/styles/base.css`, `app/src/routes.ts`, `app/src/server.test.ts`
  (347 inserciones, 64 eliminaciones).
- Archivos creados: `app/public/styles/layout.css`.
- Funcionalidades afectadas: ninguna rota. La interfaz pasa de una página única
  apilada a 5 vistas navegables con los mismos datos y endpoints.
- Decisiones tomadas: ver abajo.
- Pruebas ejecutadas: typecheck, build, suite completa (22/22) y smoke con servidor real.
- Resultados reales: ver abajo.
- Riesgos detectados: verificación visual en navegador real pendiente del despliegue
  aprobado (el navegador en vivo no abre localhost); las fechas de vencimiento se
  comparan por fecha UTC recortada, igual que antes (aproximación conocida).
- Limitaciones pendientes: responsive de tablas, diálogos de confirmación, estados
  universales completos, panel de aprobaciones con contexto (Fases 3–5).
- Próximo paso recomendado: decidir si se sube la Fase 2 a la rama remota
  `ui-fase1-foundations` (sin mergear a `main`) o se continúa la Fase 3 en local.

## Resumen de cambios

### Implementado
- `layout.css`: encabezado de vista, grilla lateral (220 px + contenido) en
  escritorio, navegación horizontal con scroll en tablet/móvil (≤1023 px),
  enlaces con estado activo (`aria-current="page"`), contadores, tarjetas de
  indicadores y tarjetas de contenido con scroll horizontal interno para tablas.
- `index.html`: `app-section` reestructurada en encabezado (título, subtítulo,
  Actualizar, Salir) + `nav.sidebar` + 5 vistas (`inicio`, `oportunidades`,
  `tareas`, `aprobaciones`, `actividad`). Sin enlace a Configuración: todavía no
  existen opciones funcionales que mostrar, y la especificación prohíbe mostrar
  destinos inexistentes como si estuvieran implementados.
- `app.js`: navegación por hash (`#inicio`, `#oportunidades`, `#tareas`,
  `#aprobaciones`, `#actividad`) con `showView`, título y subtítulo por vista,
  sección activa evidente y navegación por teclado (enlaces nativos).
- Inicio (Centro de operaciones): 4 indicadores clicables con datos reales de
  `/api/stats` (Oportunidades, Tareas pendientes, Aprobaciones pendientes,
  Ejecuciones fallidas), lista de acciones prioritarias (tareas vencidas,
  borradores pendientes, ejecuciones fallidas, calculadas con los datos ya
  cargados) y actividad reciente (primeros 5 eventos de auditoría).
- Contadores reales en la navegación (oportunidades, tareas abiertas,
  aprobaciones pendientes) que se ocultan cuando son cero.
- Permisos: aprobar/rechazar solo se renderizan para rol `admin` (el servidor ya
  lo exigía); los demás roles ven el borrador con una nota que explica que su rol
  no permite decidir.
- `base.css`: ancho de página 960 → 1200 px para que sidebar + contenido respiren.
- `routes.ts`: `layout.css` agregado a la lista blanca de estilos.
- `server.test.ts`: 2 tests nuevos (la raíz sirve la navegación sin Configuración
  y `layout.css` responde 200 con `.nav-link`).

### Verificado
- `npm run typecheck`: limpio.
- `npm run build`: limpio.
- `npm test`: **22/22 en verde** (13 system + 2 postgres + 7 server, 2 de ellos nuevos).
- Smoke con servidor real (puerto 3212, copia temporal de la base local, luego
  eliminada): health OK; `/` sirve los 5 enlaces, las 5 vistas y el link a
  `layout.css`, sin "Configuración"; `layout.css` 200; `app.js` servido contiene
  `showView`, `stat-opps`, `aria-current` y `count-drafts`; login demo y stats
  `3/3/3/0/3/100` intactos. Servidor smoke apagado y temporales eliminados.

### Pendiente
- Responsive de tablas y listas en móvil (Fase 3).
- Diálogos de confirmación con alcance real (Fase 4).
- Estados universales: loading, sesión expirada, permiso insuficiente, conflicto,
  sin resultados (Fases 3–5).
- Panel de aprobaciones con contexto completo (Fase 4) y detalle de ejecuciones
  (Fase 5).

### Bloqueado
- Nada dentro de la fase. El push de la rama y el merge a `main` requieren
  aprobación explícita (Render redespliega solo al cambiar `main`).

### No verificado
- Renderizado visual en un navegador real (sidebar, navegación móvil, tarjetas):
  pendiente del despliegue aprobado. Se verificó por contenido servido y revisión
  del CSS, no por captura.

## Decisiones

- **Navegación por hash, sin framework:** los enlaces `#vista` dan sección activa,
  botón atrás del navegador y vistas enlazables sin añadir dependencias ni router.
- **Sin Configuración en la navegación:** la especificación (3.2 y 4.6) solo admite
  opciones funcionales y autorizadas; como no existe ninguna, el destino queda fuera
  hasta tener contenido real. El test lo fija (`not.toContain('Configuración')`).
- **Etiquetas de indicadores veraces:** "Oportunidades" (total, no "activas") porque
  `/api/stats` devuelve el total; no se inventó un filtro de activas.
- **Contadores ocultos en cero:** un contador en cero no aporta y ensucia la
  navegación; reaparece cuando hay algo pendiente. Los valores siguen siendo
  siempre datos reales.
- **Ancho de página 1200 px:** con sidebar de 220 px, los 960 px previos dejaban
  ~700 px de contenido, insuficientes para tablas de operaciones.
- **Subtítulo de Aprobaciones con el alcance real:** "Aprobar actualiza el estado y
  audita; no envía mensajes", porque el flujo actual no envía ningún mensaje y la
  especificación exige decirlo con precisión.
- **Aprobación por rol en el cliente:** solo presentación (el servidor sigue siendo
  quien autoriza); un miembro ve el borrador y una nota, en vez de botones que
  fallarían al hacer clic.
- **Fechas de vencimiento:** la comparación de "vencidas" usa la fecha UTC recortada
  (`due_at.slice(0, 10)`), igual que el render anterior. Cerca de la medianoche
  puede diferir un día de la fecha local; queda registrado como aproximación a
  revisar si las fechas pasan a mostrarse con zona horaria.

## Criterios de aceptación (Fase 2)

| ID | Criterio | Estado | Evidencia |
|---|---|---|---|
| UX-001 | Navegación funcional | PASS | 5 destinos reales con hash, sección activa y tests de serving |
| UX-002 | Flujos críticos preservados | PASS | Suite 22/22 + smoke (login, stats, serving) |
| DS-002 | Componentes consistentes | PASS | Navegación, tarjetas e indicadores usan el sistema |
| QA-001 | Sin regresiones críticas | PASS | Suite 22/22, typecheck y build limpios |
| QA-003 | Sin errores críticos de consola | NOT_VERIFIED | Sin ejecución en navegador real todavía |
| RWD-001 | Layout adaptable | PARCIAL | Grilla responsive verificada por CSS y serving; sin captura en viewports reales |
| A11Y-001 | Navegación por teclado | PARCIAL | Enlaces nativos y `aria-current`; sin prueba manual documentada todavía |
