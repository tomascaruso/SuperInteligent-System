# Diagnóstico de brechas — Referencia visual SIS vs. UI real

**Fecha:** 26-oct-2026 (noche, ART)
**Referencia:** mockup SIS by PENSIA guardado en
`docs/REFERENCIA-VISUAL-SIS.md` (imagen original en la biblioteca
de medios; sus números son demostrativos, no datos reales).
**UI real comparada:** `app/public/index.html`, `app/public/app.js`,
`app/public/styles/` (tokens, layout, componentes) y las APIs
reales (`/api/stats`, `/api/opportunities`, `/api/tasks`,
`/api/drafts`, `/api/agents`, `/api/processes`,
`/api/executions`, `/api/audit`, `/api/me`).
**Estado:** DIAGNÓSTICO COMPLETO. Sin cambios de código, sin
merge, sin despliegue. La implementación requiere autorización de
Tomás por paso.

## Método

Elemento por elemento de la referencia, verificado contra la UI
real y contra la fuente de datos que lo alimentaría. Veredicto por
elemento: YA EXISTE (solo formato), ADAPTABLE CON DATOS REALES
(hay fuente real, falta la presentación) o NO ADOPTABLE TAL CUAL
(no hay entidad, dato o funcionalidad que lo respalde; inventarlo
violaría el System OS y la instrucción de Tomás).

## Mapa de correspondencias

| Elemento de la referencia | Real hoy | Veredicto |
|---|---|---|
| Tema claro, acentos índigo, tarjetas redondeadas | Tokens reales: canvas `#f7f8fc`, primario `#4f46e5`, radio tarjeta 12 px, sombras sm/md/lg | YA EXISTE (base; la brecha es de composición, no de paleta) |
| Navegación lateral | `.sidebar` sticky vertical en escritorio, tira con scroll en móvil (verificado en la matriz RWD) | YA EXISTE (6 vistas reales) |
| Encabezado con buscador, campana, config, usuario | Encabezado con título + Recorrido/Actualizar/Salir; `#who` con sesión debajo | ADAPTABLE EN PARTE (usuario real sí; buscador y campana no) |
| Chip de usuario «Juan Diaz, Administrador» | `/api/me` da usuario, org y rol reales | ADAPTABLE (mostrar sesión real, no un nombre ficticio) |
| «Sistema operativo» (punto verde) | Sin indicador; la app carga stats en cada actualización | ADAPTABLE si se define honesto: mostrarlo solo cuando la última carga de la API tuvo éxito |
| Tarjetas de métricas (4, con valores) | 4 stat-cards enlazadas con conteos reales de `/api/stats` | YA EXISTE (formato y 4ª métrica a revisar) |
| Variación % vs. período anterior (+12 %, −33 %) | No hay serie temporal guardada para «semana anterior» | NO ADOPTABLE TAL CUAL (ver § Deltas) |
| «Procesos completados hoy» (12) | Existe la tabla `process_runs` (C3); falta confirmar si guarda fin de proceso para afirmar «hoy» | A CONFIRMAR contra el esquema antes de prometerlo |
| Gráfico de líneas «Evolución» (total/ganadas/perdidas) | No hay gráficos (sin SVG/canvas/librería) | ADAPTABLE SOLO REDEFINIDO (ver § Gráficos) |
| Donut «Distribución por agente» (128 tareas) | Tareas con `agent_id` real + catálogo `/api/agents` | ADAPTABLE (agregación en cliente, sin backend nuevo) |
| Tabla «Procesos en ejecución» | Tarjeta «Procesos» como lista simple en Actividad | ADAPTABLE (evolución de esa tarjeta; «paso actual» y «tiempo» a confirmar contra `process_runs`) |
| Panel «Orquestador» / flujo por pasos | Pasos reales por ejecución (`GET /api/executions/:id/steps`, «Ver pasos») + diálogo real de aprobación | ADAPTABLE (flujo desde steps + mapa paso→agente existente) |
| «Actividad reciente» con «hace X» | Ya existe: 5 eventos comerciales reales (F3-DEMO) | YA EXISTE (el «hace X» es solo formato, derivable de timestamps reales) |
| «Agentes en funcionamiento» con «Activo» | Vista Agentes real con conteos de tareas abiertas | YA EXISTE con una condición: «Activo» debe definirse sin mentir (ver § Agentes) |
| «Últimas ejecuciones» (Exitosa / Con observaciones) | Lista real de ejecuciones con estado `done`/`failed` | YA EXISTE (badge = estado real, solo formato) |
| «Clientes» como vista | No hay entidad cliente; «empresa» es un campo de la oportunidad | NO ADOPTABLE (no crear una vista cáscara) |
| «Integraciones» | Solo existen manual, webhook HMAC y relay de contacto | NO ADOPTABLE como lista (no mostrar logos ni integraciones ficticias) |
| «Reportes», «Configuración» | No hay motor de reportes ni panel de configuración | NO ADOPTABLE (las políticas se leen por API, no se editan por UI) |
| Buscador global | No existe búsqueda ni filtros en la UI | NO ADOPTABLE como caja decorativa; solo si filtra de verdad (oportunidades/tareas en cliente) |
| «Documentos generados» (PDF) | No se generan PDFs; el borrador es texto con aprobación | NO ADOPTABLE (no mostrar descargas ficticias) |
| Campana de notificaciones | No hay sistema de notificaciones | NO ADOPTABLE |
| Fecha «28 de abril de 2025» | Demostrativa en la imagen | La fecha real es la local del navegador, nada más |

## Deltas %: por qué no se copian

La referencia muestra +12 %, +8 %, −33 %, +50 % vs. semana o mes
anterior. Hoy no existe ninguna serie guardada que permita
calcularlos: las stats son conteos actuales y la auditoría no se
usa para comparar períodos. Mostrar esos porcentajes sería
inventar datos. Opciones honestas, en orden de preferencia:
(a) tarjetas sin variación; (b) variación calculada desde la
auditoría real (eventos con fecha, últimos 7 días vs. 7 previos),
definida y probada como funcionalidad nueva, no como adorno.
Nunca copiar los % de la imagen.

## Gráficos: qué se puede dibujar de verdad

- No hay librería de gráficos ni código SVG/canvas en la app.
  Recomendado: SVG hecho a mano con los tokens (sin dependencias
  nuevas, coherente con el minimalismo del proyecto).
- Donut por agente: agregación en cliente de tareas abiertas por
  `agent_id` contra el catálogo de `/api/agents`. Datos reales,
  sin backend nuevo.
- Evolución: la única serie temporal real es la auditoría
  (eventos con fecha: oportunidad creada, borrador aprobado, etc.).
  La serie debe redefinirse con esos eventos (por ejemplo,
  oportunidades creadas por día). «Ganadas/Perdidas» NO existe
  como concepto (no hay estados ganado/perdido) y no se inventa.

## Agentes: «Activo» sin mentir

Los agentes son reglas deterministas, no procesos en ejecución
continua. Marcarlos «Activo» con punto verde como si estuvieran
corriendo sería ficticio. Definición honesta si se adopta el
formato: agente «Disponible» (definido en el catálogo) + conteo
real de tareas abiertas, que es lo que la vista Agentes ya
muestra. Sin proceso real en curso, no hay «en funcionamiento».

## Orquestador: el panel con más sustento real

Es el elemento de la referencia con mejor correspondencia: el
flujo por pasos existe (`steps` por ejecución, con su agente por
el mapa paso→agente de C4) y la aprobación humana existe (diálogo
real, que no envía mensajes). Un panel «Flujo de proceso» es
construible sin inventar nada: pasos, agente de cada paso y
estado, más la aprobación pendiente como paso explícito. Es el
candidato natural para el Paso 2 del plan.

## Riesgos y reglas que rigen cualquier cambio

- System OS v1.1: tokens centralizados, contraste AA, foco
  visible, sin capacidades ficticias. Cada cambio de layout
  re-verifica la matriz RWD (375/768/1280/1920) y el recorrido
  con Tab, como se hizo en Fase 6.
- SIS es supervisión de orquestación, no CRM: no se agregan
  vistas por imitar la referencia (Clientes, Integraciones,
  Reportes, Configuración) sin una entidad real detrás.
- Suite 105/105 + typecheck + build + smoke antes de cada merge;
  verificación en vivo post-merge solo si cambia la UI; nunca
  aprobar/rechazar/marcar nada en la verificación.
- Nada de merges ni despliegues sin autorización explícita.

## Plan incremental propuesto (sin implementar)

1. **Composición (sin nuevas vistas):** encabezado con usuario
   real (`/api/me`) e indicador de sistema derivado de la carga
   exitosa de la API; densidad y jerarquía de tarjetas acercadas
   a la referencia con los tokens actuales. Sin deltas, sin
   buscador decorativo, sin nuevas vistas.
2. **Panel Orquestador / flujo:** pasos reales por ejecución con
   agente y aprobación humana explícita, reutilizando «Ver
   pasos» y el diálogo existente.
3. **Visualizaciones con datos reales:** donut de tareas por
   agente (cliente, SVG a mano) y evolución desde auditoría con
   series redefinidas (sin «ganadas/perdidas»).
4. **Opcional, a decidir por Tomás:** búsqueda real en cliente
   (oportunidades/tareas) y variación por período desde
   auditoría. Solo si se definen como funcionalidad, no como
   adorno.

Lo que NO se hace en ningún paso: vistas cáscara (Clientes,
Integraciones, Reportes, Configuración), porcentajes inventados,
PDFs ficticios, «Activo» sin definición, campana de
notificaciones.
