# Fase 1 — Informe (UI/UX System OS v1.1: Foundations)

**Fecha:** 25-oct-2026 (noche, ART)
**Rama:** `ui-fase1-foundations` (desde `d14-postgres`, HEAD `7e4a3e5`)
**Estado de la fase:** PASS
**Especificación aplicada:** `docs/UI-UX-SYSTEM-OS-v1.1.md`, secciones 2.2, 5.1–5.6, 5.8 parcial,
8.1 parcial y 9.3

## Estado de la fase

- Fase y objetivo: Foundations — tokens, tipografía, espaciado, estilos globales,
  botones, campos, badges, contenedores y foco visible, sin romper autenticación
  ni flujos actuales.
- Estado: PASS.
- Archivos modificados: `app/public/index.html`, `app/public/app.js`,
  `app/src/routes.ts`, `app/src/server.test.ts` (109 inserciones, 39 eliminaciones).
- Archivos creados: `app/public/styles/tokens.css`, `app/public/styles/base.css`,
  `app/public/styles/components.css`.
- Funcionalidades afectadas: ninguna rota. Cambios de presentación: sistema visual,
  etiquetas visibles, badges en prioridad/estado, clases de botones, alerta de error.
  La lógica de `app.js` (llamadas a la API, flujos, `esc()`) no cambió.
- Decisiones tomadas: ver abajo.
- Pruebas ejecutadas: typecheck, build, suite completa (20/20) y smoke con servidor real.
- Resultados reales: ver abajo.
- Riesgos detectados: verificación visual en navegador real pendiente del despliegue
  aprobado (el navegador en vivo no abre localhost); `.btn.is-loading` definido pero
  aún no cableado (los estados de envío llegan en Fase 3).
- Limitaciones pendientes: navegación, diálogos, estados universales, panel de
  aprobaciones completo, actividad/detalle (Fases 2–5).
- Próximo paso recomendado: decidir si se sube la rama `ui-fase1-foundations` a
  GitHub (sin mergear a `main`) o se continúa la Fase 2 en local.

## Resumen de cambios

### Implementado
- `tokens.css`: todos los tokens de la especificación — 17 colores, 8 tamaños
  tipográficos, escala de espaciado 4–48 px, radios 8/12/16 px, sombras suaves,
  breakpoints documentados.
- `base.css`: reset de box-sizing, fondo canvas, tipografía del sistema, jerarquía
  h1/h2/h3, foco visible con outline índigo, `.hidden` y `.row` preexistentes,
  ajuste móvil (<640 px) y `prefers-reduced-motion`.
- `components.css`: Button (primary/secondary/ghost/danger; sm/medium/lg; hover,
  active, disabled, loading), TextField (label, foco con anillo, disabled),
  Badge (neutral/info/success/warning/danger), Card, DataTable, Alert
  (error/info/success/warning, invisible cuando está vacío), cuerpo de borrador
  (`.draft-body`) y utilidades de texto secundario.
- `index.html`: sin CSS inline; linkea los tres CSS; secciones con `.card`;
  etiquetas `<label>` visibles en los 8 campos (auth y alta de oportunidad) con
  estructura `.field-wrap`; botones con jerarquía (Entrar primaria, Crear
  organización secundaria, Salir ghost, Crear oportunidad primaria); tabla con
  `.data-table`; error como `.alert-error`.
- `app.js`: botones dinámicos con clases (hecha secundaria, aprobar primaria,
  rechazar danger, reintentar secundaria); prioridad y estado de oportunidades
  como badges; cuerpo de borrador con `.draft-body`.
- `routes.ts`: `GET /styles/:file` con lista blanca (`tokens.css`, `base.css`,
  `components.css`); cualquier otro nombre da 404. Solo serving, sin cambios de API.
- `server.test.ts`: 3 tests nuevos (tokens 200 + token presente + sin secretos,
  components 200, nombre fuera de lista 404).

### Verificado
- `npm run typecheck`: limpio.
- `npm run build`: limpio.
- `npm test`: **20/20 en verde** (13 system + 2 postgres + 5 server, 3 de ellos nuevos).
- Smoke con servidor real (puerto 3211, copia temporal de la base local, luego
  eliminada): health OK; `/` sirve los 3 links CSS, 8 labels y clases; tokens.css
  200 `text/css` con `--color-primary`; estilo inexistente 404; login demo y stats
  `3/3/3/0/3/100` intactos; `app.js` servido contiene las clases de badges y botones.
  Servidor smoke apagado y temporales eliminados.

### Pendiente
- Cablear estados de envío/loading en los botones (`.is-loading` ya existe).
- Navegación y estructura de secciones (Fase 2).
- Oportunidades/tareas completas, Centro de aprobaciones, actividad (Fases 3–5).
- QA responsive/accesibilidad con navegador real (Fase 6, tras despliegue aprobado).

### Bloqueado
- Nada dentro de la fase. El push a GitHub y cualquier despliegue requieren
  aprobación explícita (además, Render redespliega solo al cambiar `main`).

### No verificado
- Renderizado visual en un navegador real (colores, foco, responsive): el navegador
  en vivo no abre servidores locales, y la rama no está desplegada. Se verificó por
  contenido servido (links, clases, CSS) y por revisión del CSS, no por captura.
  No se afirma que se vio en pantalla.

## Decisiones

- **Fuente del sistema:** stack de sistema (`system-ui, ...`), sin dependencia externa.
  La especificación prefiere Inter/Geist "siempre que se pueda incorporar sin
  complejidad innecesaria" y permite el stack de sistema en caso contrario; el
  servidor no tiene pipeline de fuentes y sumar una fuente externa añadiría
  complejidad sin beneficio funcional. Decisión reversible en cualquier fase.
- **Mapeo de badges (solo presentación, el texto acompaña siempre al color):**
  prioridad `high → danger`, `medium → warning`, `low → neutral`;
  estado `proposal_draft → info`, `in_follow_up → success`, `new → neutral`,
  resto → neutral. Valores tomados del código (`routes.ts`: `in_follow_up` tras
  aprobar, `new` tras rechazar; `proposal_draft` del seed). No se inventaron estados.
- **Etiquetas visibles:** los 8 campos ahora tienen `<label for>`; los placeholders
  duplicados se eliminaron (el placeholder no era la etiqueta). Los `id` no cambiaron,
  así que `app.js` no se tocó en ese punto.
- **Estructura `.field-wrap`:** necesaria para que etiqueta + campo se apilen dentro
  de las filas flex actuales; sin reestructurar el DOM más allá de eso.
- **Alerta vacía invisible:** `.alert:empty { display: none; }` porque el `<p id="error">`
  vive siempre en el DOM y antes era invisible solo por no tener fondo ni padding.
- **Foco en campos:** anillo `box-shadow` índigo suave + borde primario, en lugar
  del outline global, para que el foco sea visible sin doble contorno.
- **Corrección de copy:** el subtítulo decía "demo local"; la misma build ya sirve
  la demo pública, así que ahora dice "demo con datos ficticios". No es rediseño,
  es veracidad.
- **Rama de trabajo:** `ui-fase1-foundations`, separada de `d14-postgres`, para que
  el diff sea revisable y el push/merge sigan siendo decisiones aparte.

## Criterios de aceptación (Fase 1)

| ID | Criterio | Estado | Evidencia |
|---|---|---|---|
| DS-001 | Tokens centralizados | PASS | `tokens.css` con los 17 colores y escalas; servido 200 |
| DS-002 | Componentes consistentes | PASS | Botones, campos, badges, card, tabla y alert usados en la UI real |
| DS-003 | Estados de componentes definidos | PARCIAL | Hover/active/disabled/loading definidos en CSS; loading aún no cableado en JS |
| UX-002 | Flujos críticos preservados | PASS | Suite 20/20 + smoke (login, stats, serving) |
| QA-001 | Sin regresiones críticas | PASS | Suite 20/20, typecheck y build limpios |
| QA-003 | Sin errores críticos de consola | NOT_VERIFIED | Sin ejecución en navegador real todavía |

Los criterios de navegación, aprobaciones, accesibilidad completa y responsive
pertenecen a fases posteriores y quedan NOT_VERIFIED, como corresponde.
