# SuperInteligent System — UI/UX System OS v1.1
## Contrato de diseño e implementación para el agente de desarrollo

**Versión:** 1.1  
**Producto:** SuperInteligent System  
**Tipo:** Especificación ejecutable de UX/UI  
**Prioridad:** Alta  
**Estado:** LISTO PARA IMPLEMENTACIÓN CONTROLADA  
**Audiencia:** Agente de desarrollo, frontend engineer, QA y responsable de producto.

---

# 1. DIRECTIVA PRINCIPAL

Actuá como **Senior Frontend Engineer, Design Systems Engineer y UX Implementation Lead** de SuperInteligent System.

Tu misión es implementar el UI/UX System OS sobre la aplicación existente, transformando la interfaz de demostración actual en una experiencia profesional de software B2B SaaS.

No te limites a recomendar cambios. Inspeccioná el código, implementá las mejoras autorizadas, ejecutá pruebas, corregí defectos y documentá los resultados.

## 1.1 Objetivo del producto

SuperInteligent System es un orquestador de operaciones comerciales que ayuda a las empresas a organizar oportunidades, tareas, seguimientos, propuestas y acciones asistidas por IA.

La interfaz debe transmitir cinco cualidades:

1. **Claridad:** el usuario comprende qué está pasando y qué debe hacer.
2. **Control:** ninguna acción sensible ocurre sin los permisos y las aprobaciones requeridos.
3. **Confianza:** el sistema distingue entre recomendaciones, borradores, aprobaciones y acciones ejecutadas.
4. **Eficiencia:** la información importante se encuentra rápidamente y las tareas repetitivas requieren menos pasos.
5. **Recuperabilidad:** los errores muestran qué ocurrió y cómo continuar sin perder información.

## 1.2 Contexto técnico existente

El repositorio `tomascaruso/SuperInteligent-System` ya contiene una aplicación inicial. No la trates como un proyecto vacío.

Según la inspección estática previa, el proyecto incluye:

- Backend TypeScript con Fastify.
- Autenticación y separación organizacional.
- Gestión de oportunidades comerciales.
- Clasificación y priorización basada en reglas.
- Tareas y seguimientos.
- Borradores y flujo de aprobación.
- Auditoría, ejecuciones y reintentos.
- Interfaz web basada en `app/public/index.html` y `app/public/app.js`.
- Estilos CSS actualmente básicos y parcialmente integrados en el HTML.

Estos datos deben verificarse contra el estado actual de la rama antes de actuar.

**No reemplaces la aplicación por una plantilla nueva. No migres de framework por razones estéticas. No reescribas el backend para resolver un problema de interfaz.**

Primero identificá las rutas, los contratos de API, los estados reales y las pruebas disponibles.

## 1.3 Límites de autoridad

El agente puede inspeccionar, planificar, modificar código de frontend dentro del alcance autorizado, ejecutar pruebas y preparar cambios revisables.

No debe:

- Eliminar ni alterar silenciosamente funcionalidades existentes.
- Crear acciones de envío externo que no estén implementadas y autorizadas.
- Simular éxitos cuando una operación falla.
- Debilitar autenticación, autorización o aislamiento entre organizaciones.
- Ejecutar migraciones destructivas o modificar datos reales sin autorización.
- Fusionar cambios en `main` ni desplegar producción sin aprobación explícita.
- Declarar que una prueba pasó si no se ejecutó y verificó.
- Agregar dependencias grandes sin justificar su necesidad.
- Cambiar la arquitectura por preferencia personal.

Si una decisión afecta seguridad, contratos de API, permisos o comportamiento comercial, documentala y solicitá aprobación antes de continuar con ese cambio.

---

# 2. SISTEMA VISUAL

## 2.1 Dirección de diseño

Construir una interfaz **premium B2B SaaS**, sobria, moderna y orientada a operaciones.

Referencias conceptuales:

- Densidad de información propia de herramientas de operaciones.
- Jerarquía visual clara de productos SaaS profesionales.
- Estados explícitos y controles predecibles.
- Componentes consistentes y reutilizables.
- Interfaces limpias sin decoración innecesaria.

La interfaz no debe parecer una landing page, un dashboard genérico generado automáticamente ni una colección de tarjetas decorativas.

### Principios visuales

- Fondo claro como tema inicial.
- Superficies blancas y bordes discretos.
- Color índigo reservado principalmente para acciones primarias y selección.
- Estados semánticos inequívocos.
- Tipografía legible y jerarquía tipográfica limitada.
- Espaciado consistente.
- Tablas y listas cuando permitan trabajar más rápido que una grilla de tarjetas.
- Iconografía consistente y comprensible.
- Animaciones discretas, nunca necesarias para entender un estado.

No agregar gradientes decorativos, sombras fuertes, gráficos ficticios, contadores inventados ni indicadores que sugieran actividad inexistente.

## 2.2 Design tokens obligatorios

Crear una fuente centralizada de tokens. Adaptá la ubicación al frontend existente; por ejemplo, `app/public/styles/tokens.css`, si resulta compatible con la estructura real.

Los siguientes valores son la referencia inicial oficial del sistema. Si encontrás una restricción técnica relevante, documentá la desviación.

### Colores

| Token | Valor | Uso |
|---|---|---|
| `color-primary` | `#4F46E5` | Acciones primarias |
| `color-primary-hover` | `#4338CA` | Hover de acción primaria |
| `color-primary-subtle` | `#EEF2FF` | Selección y fondos suaves |
| `color-text-primary` | `#172033` | Texto principal |
| `color-text-secondary` | `#64748B` | Texto secundario |
| `color-text-muted` | `#94A3B8` | Información auxiliar |
| `color-surface` | `#FFFFFF` | Superficies |
| `color-canvas` | `#F7F8FC` | Fondo general |
| `color-border` | `#E2E8F0` | Bordes y separadores |
| `color-success` | `#15803D` | Éxito |
| `color-success-bg` | `#F0FDF4` | Fondo de éxito |
| `color-warning` | `#B45309` | Advertencia |
| `color-warning-bg` | `#FFFBEB` | Fondo de advertencia |
| `color-danger` | `#B91C1C` | Error y acciones destructivas |
| `color-danger-bg` | `#FEF2F2` | Fondo de error |
| `color-info` | `#1D4ED8` | Información |
| `color-info-bg` | `#EFF6FF` | Fondo informativo |

El color no puede ser el único indicador de estado. Acompañar badges e indicadores con texto, iconografía accesible cuando corresponda y etiquetas comprensibles.

### Tipografía

Preferencia: Inter o Geist Sans, siempre que se pueda incorporar sin introducir complejidad innecesaria. Si el proyecto no puede cargar una fuente externa, utilizar un stack de sistema.

| Token | Tamaño | Peso | Uso |
|---|---:|---:|---|
| `text-display` | 32 px | 600 | Encabezados destacados |
| `text-page-title` | 28 px | 600 | Títulos de página |
| `text-section-title` | 20 px | 600 | Secciones |
| `text-card-title` | 16 px | 600 | Títulos de componentes |
| `text-body` | 14 px | 400 | Texto principal de interfaz |
| `text-body-lg` | 16 px | 400 | Lectura extendida |
| `text-label` | 13 px | 500 | Etiquetas y controles |
| `text-caption` | 12 px | 400 | Metadatos secundarios |

Usar una altura de línea adecuada, no depender del tamaño pequeño para aumentar artificialmente la densidad y respetar las preferencias de zoom del usuario.

### Espaciado

Usar una escala base de 4 px:

`4, 8, 12, 16, 20, 24, 32, 40, 48 px`.

No introducir valores arbitrarios repetidos si existe un token equivalente.

### Radios y sombras

- Controles: 8 px.
- Tarjetas: 12 px.
- Diálogos: 16 px.
- Campos y botones: bordes discretos.
- Sombras: suaves, limitadas a elementos que deban separarse del fondo.

### Breakpoints

- Mobile: menos de 640 px.
- Tablet: 640–1023 px.
- Desktop: 1024–1439 px.
- Wide: 1440 px o más.

Los breakpoints son orientativos. Adaptar tablas, navegación, formularios y paneles según su contenido real. No producir scroll horizontal global en pantallas pequeñas.

---

# 3. ARQUITECTURA DE LA INTERFAZ

## 3.1 Estructura principal

La aplicación autenticada debe adoptar una estructura consistente:

1. Navegación principal.
2. Área de contenido de la página.
3. Encabezado con título, contexto y acciones.
4. Zona de filtros o controles, cuando corresponda.
5. Contenido principal.
6. Feedback de operaciones y estados del sistema.

En escritorio, preferir una navegación lateral compacta o expandible. En móvil, utilizar un patrón de navegación adaptable que no comprima el contenido.

No agregar un menú completo antes de que las páginas estén implementadas. Los destinos no disponibles no deben parecer funcionalidades terminadas.

## 3.2 Navegación del producto

Orden de navegación recomendado:

1. **Inicio**
2. **Oportunidades**
3. **Tareas y seguimientos**
4. **Aprobaciones**
5. **Actividad y ejecuciones**
6. **Configuración**

La vista de empresas y contactos puede incorporarse cuando exista una funcionalidad real para administrarlos de forma independiente.

### Reglas

- La sección activa debe ser evidente.
- Los enlaces deben navegar a una página o sección real.
- Los contadores deben provenir de datos reales.
- Los elementos sin permisos no deben permitir acceso.
- Las opciones futuras deben permanecer fuera de la navegación principal hasta que estén listas.
- En móvil, la navegación debe permitir acceder a las secciones sin bloquear el contenido.

## 3.3 Página de inicio: Operations Center

La página de inicio debe responder rápidamente:

- ¿Qué requiere atención?
- ¿Qué oportunidades están activas?
- ¿Qué tareas están pendientes?
- ¿Qué aprobaciones esperan una decisión?
- ¿Hubo ejecuciones fallidas?

### Orden de contenido

**A. Encabezado**

- Título: “Centro de operaciones”.
- Texto auxiliar breve que explique la finalidad de la vista.
- Selector de período solo si el backend permite obtener métricas para ese período.
- Acciones relevantes, por ejemplo, crear oportunidad si está permitido.

**B. Indicadores operativos**

Mostrar solo métricas respaldadas por el backend. Candidatas:

- Oportunidades activas.
- Tareas pendientes.
- Aprobaciones pendientes.
- Ejecuciones fallidas.

Cada indicador debe incluir un nombre claro, valor y, si corresponde, acceso a la vista relacionada.

No mostrar porcentajes de conversión, crecimiento ni tendencias sin datos suficientes y una definición de cálculo documentada.

**C. Acciones prioritarias**

Una lista de elementos que requieran atención inmediata, como tareas vencidas, aprobaciones pendientes o ejecuciones fallidas, siempre que puedan identificarse con datos reales.

**D. Actividad reciente**

Mostrar eventos relevantes de auditoría o ejecución con fecha, tipo de evento, resultado y enlace al detalle si existe.

**E. Estado vacío**

Cuando una organización no tenga actividad, explicar cómo comenzar y ofrecer una acción útil, por ejemplo, crear la primera oportunidad.

No mostrar un dashboard lleno de tarjetas vacías.

---

# 4. ESPECIFICACIÓN DE PANTALLAS

## 4.1 Autenticación

Mantener los flujos de registro e inicio de sesión existentes.

### Requisitos

- Formularios simples y visualmente consistentes.
- Etiquetas visibles.
- Validación comprensible.
- Errores junto al campo afectado cuando sea posible.
- Mensajes generales para errores de autenticación que no revelen información sensible.
- Botón con estado de procesamiento durante la solicitud.
- Evitar envíos duplicados.
- Permitir navegación por teclado.
- Recuperar el estado correcto tras un error.

No cambiar el mecanismo de autenticación del backend como parte de una tarea exclusivamente visual.

La utilización actual de tokens en `localStorage`, si sigue existiendo, debe permanecer registrada como una limitación de seguridad a resolver por separado. No ocultar ni presentar esa arquitectura como lista para producción.

## 4.2 Oportunidades

Esta es una de las vistas principales del producto.

### Encabezado

- Título: “Oportunidades”.
- Descripción breve.
- Acción primaria: “Nueva oportunidad”.
- Indicadores o filtros solo cuando existan datos y contratos que los respalden.

### Lista o tabla

Mostrar, según los campos realmente disponibles:

- Nombre de la oportunidad.
- Empresa o contacto, si está disponible.
- Estado.
- Prioridad.
- Próxima tarea o seguimiento.
- Fecha de creación o actualización.
- Acciones disponibles.

No inventar datos para completar columnas.

### Comportamientos

- Crear oportunidad mediante un formulario claro.
- Validar campos antes del envío.
- Informar errores de duplicación o conflicto si el backend los devuelve.
- Mostrar el estado real de la operación.
- Evitar duplicar solicitudes durante un envío.
- Mantener la lista coherente después de crear o actualizar.
- Confirmar antes de acciones destructivas, si se incorporan.

### Filtros y búsqueda

Implementar búsqueda, filtros o paginación solo si la API los soporta o si pueden resolverse de forma segura sobre los datos cargados.

No simular filtrado en servidor ni indicar que se buscaron todos los registros si solo se cargó una página.

### Estado vacío

Título sugerido: “Todavía no hay oportunidades”.

Explicar cómo registrar la primera oportunidad y ofrecer la acción correspondiente.

### Sin resultados

Distinguir entre una organización sin oportunidades y una búsqueda que no encontró coincidencias.

## 4.3 Tareas y seguimientos

### Objetivo

Permitir que el usuario identifique rápidamente qué debe hacer y qué está pendiente.

### Información

- Descripción de la tarea.
- Oportunidad relacionada, si existe.
- Fecha de vencimiento, si existe.
- Estado.
- Prioridad, si está disponible.
- Acción autorizada para completar o actualizar la tarea.

### Comportamientos

- Completar una tarea debe reflejarse únicamente después de una respuesta exitosa del servidor o mediante una actualización optimista con rollback correctamente implementado.
- Evitar cambios duplicados.
- Informar errores y permitir recuperarse.
- No confundir una tarea completada con una comunicación externa enviada.
- Diferenciar tareas vencidas, pendientes y completadas con etiquetas explícitas.

No introducir un calendario ni una automatización de seguimientos si no existe soporte funcional.

## 4.4 Centro de aprobaciones de IA

**Esta es la pantalla de mayor prioridad desde la perspectiva de confianza y control.**

El usuario debe entender exactamente qué está aprobando antes de autorizar una acción.

### Estructura

Cada borrador pendiente debe mostrar, según los datos existentes:

1. Tipo de acción propuesta.
2. Oportunidad relacionada.
3. Destinatario o canal, si corresponde y si está definido.
4. Contenido íntegro del borrador.
5. Motivo o contexto de la propuesta, cuando esté disponible.
6. Estado actual.
7. Acciones disponibles: aprobar, rechazar o solicitar revisión, únicamente si están implementadas.

Si no existe destinatario o canal, mostrar “No definido” o “No disponible”, según corresponda. No inventarlos.

### Panel de revisión

El contenido debe ser legible, editable solo si existe soporte real y distinguible de una acción ya ejecutada.

Mostrar una etiqueta clara como “Borrador pendiente de aprobación”.

Antes de la aprobación, el usuario debe conocer el alcance real de la acción. Si el flujo actual solamente actualiza el estado de la oportunidad y registra una auditoría, la interfaz debe decirlo con precisión.

**Una aprobación en el MVP no debe representarse como un envío de mensaje si no se envía ningún mensaje.**

### Acciones

- “Aprobar”: explica o confirma qué transición ocurrirá.
- “Rechazar”: permite registrar el rechazo si el backend lo soporta.
- “Solicitar cambios”: mostrar solo cuando exista una implementación funcional.

Durante una operación, deshabilitar temporalmente las acciones que puedan duplicar solicitudes.

### Confirmación

Para acciones sensibles, utilizar un diálogo que indique:

- Qué acción se está autorizando.
- Sobre qué oportunidad o elemento.
- Qué ocurrirá después.
- Qué no ocurrirá, si es relevante para evitar una interpretación incorrecta.

No utilizar una confirmación genérica como “¿Estás seguro?” cuando se puede describir el efecto real.

### Aprobaciones obsoletas

Si un borrador cambió, expiró o ya no está pendiente, el cliente debe reconocer el estado devuelto por el servidor.

No reutilizar una aprobación antigua para un contenido materialmente diferente. La validación definitiva corresponde al backend.

## 4.5 Actividad y ejecuciones

### Objetivo

Ofrecer trazabilidad comprensible de las operaciones del sistema.

### Información de ejecución

Mostrar, cuando esté disponible:

- Identificador.
- Tipo de workflow o acción.
- Estado.
- Inicio y finalización.
- Pasos realizados.
- Error relevante.
- Disponibilidad de reintento.

### Estados

Utilizar etiquetas visibles y consistentes:

- Pendiente.
- En ejecución.
- Completada.
- Fallida.
- Reintentando, si existe ese estado.

No traducir estados de forma que cambie su significado técnico.

### Reintentos

El botón “Reintentar” debe mostrarse únicamente si el servidor permite esa acción.

Antes de reintentar:

- Mostrar qué ejecución se repetirá.
- Explicar que el resultado puede depender del estado actual del sistema.
- Evitar clics duplicados.
- Refrescar la información tras la respuesta.
- Informar errores sin declarar éxito prematuramente.

La idempotencia debe ser responsabilidad del backend y verificarse mediante pruebas. La interfaz no puede garantizarla por sí sola.

## 4.6 Configuración

Incluir únicamente opciones funcionales y autorizadas.

Candidatas futuras:

- Datos de organización.
- Usuarios y roles.
- Integraciones.
- Límites de uso.
- Preferencias.

No presentar formularios ficticios ni botones que no produzcan una operación real.

---

# 5. CATÁLOGO DE COMPONENTES

Implementar componentes reutilizables sin crear una abstracción excesiva. Si el frontend sigue siendo JavaScript sin framework, pueden ser módulos, funciones de renderizado o patrones de HTML/CSS coherentes con la arquitectura actual.

## 5.1 Button

Variantes:

- Primary.
- Secondary.
- Tertiary o Ghost.
- Danger.

Tamaños:

- Small.
- Medium.
- Large.

Estados:

- Default.
- Hover.
- Focus visible.
- Active.
- Disabled.
- Loading.

Reglas:

- Un botón debe ejecutar una acción definida.
- Los botones de envío deben evitar solicitudes duplicadas.
- El estado loading debe comunicar qué está ocurriendo.
- No usar botones deshabilitados sin explicar el motivo cuando este no resulte evidente.
- Acciones destructivas deben tener una jerarquía visual apropiada.

## 5.2 TextField y Textarea

Requisitos:

- Etiqueta visible.
- Texto auxiliar opcional.
- Mensaje de error asociado.
- Estado de foco.
- Estado disabled.
- Validación coherente con el servidor.
- Compatibilidad con teclado y lectores de pantalla.

No utilizar un placeholder como única etiqueta.

## 5.3 Select y Checkbox

- Nombre y propósito claros.
- Estado seleccionado evidente.
- Teclado compatible.
- Mensajes de error accesibles.
- No usar controles personalizados si los controles nativos resuelven adecuadamente la necesidad.

## 5.4 Badge

Variantes semánticas:

- Neutral.
- Info.
- Success.
- Warning.
- Danger.

Utilizarlo para estados y categorías, no para decorar títulos.

Cada badge debe incluir texto legible. El color debe respetar el contraste.

## 5.5 Card y Section

Las tarjetas deben agrupar contenido relacionado.

- Borde sutil.
- Padding consistente.
- Título opcional.
- Área de contenido.
- Acciones opcionales.

No colocar cada párrafo dentro de una tarjeta. Las secciones simples pueden utilizar separación y encabezados.

## 5.6 DataTable

Requisitos:

- Encabezados identificables.
- Filas legibles.
- Alineación consistente.
- Estados vacíos y errores.
- Acciones por fila con nombres accesibles.
- Comportamiento responsive.
- Tratamiento de contenido largo.

En móvil, priorizar columnas esenciales, un patrón de filas compactas o una vista alternativa. No comprimir una tabla de escritorio hasta volverla ilegible.

## 5.7 Dialog

Para confirmaciones y decisiones que requieren atención.

Requisitos:

- Título descriptivo.
- Explicación del efecto.
- Acciones claramente diferenciadas.
- Foco inicial apropiado.
- Gestión del foco y cierre por teclado.
- Prevención de interacciones accidentales con el fondo.
- Restauración del foco al elemento que abrió el diálogo.

No usar diálogos para mensajes informativos que podrían presentarse directamente en la página.

## 5.8 Alert y Toast

**Alert:** errores persistentes, advertencias o información que necesita permanecer visible.

**Toast:** confirmaciones breves y no críticas.

Los errores que requieran intervención no deben desaparecer automáticamente antes de que el usuario pueda leerlos.

## 5.9 EmptyState

Debe incluir:

- Título.
- Explicación breve.
- Próximo paso, si existe una acción útil.

Distinguir estados vacíos iniciales, filtros sin resultados y ausencia temporal de información.

## 5.10 Skeleton y Loading

- Mostrar carga solo cuando exista una operación real en curso.
- Mantener estable el layout cuando sea posible.
- Evitar indicadores infinitos sin salida.
- Informar errores si la carga falla.
- No utilizar skeletons para esconder retrasos o fallos permanentes.

## 5.11 ApprovalPanel

Componente específico del producto.

Debe contener:

- Contexto de la propuesta.
- Estado del borrador.
- Contenido completo.
- Alcance de la acción.
- Controles de aprobación autorizados.
- Resultado de la operación.

No debe enviar comunicaciones directamente por el simple hecho de renderizarse ni asumir permisos desde el cliente.

## 5.12 ExecutionTimeline

Componente para representar pasos de una ejecución.

Debe diferenciar:

- Pasos completados.
- Paso actual, si se conoce.
- Pasos pendientes.
- Pasos fallidos.

Si el backend no devuelve los pasos o sus marcas temporales, no inventarlos.

---

# 6. ESTADOS UNIVERSALES DE INTERFAZ

Toda pantalla que dependa de datos o acciones del servidor debe definir los estados pertinentes.

## 6.1 Estados obligatorios

1. Loading inicial.
2. Datos disponibles.
3. Vacío inicial.
4. Búsqueda o filtro sin resultados.
5. Envío o actualización en curso.
6. Éxito confirmado por el servidor.
7. Error recuperable.
8. Error no recuperable.
9. Permiso insuficiente.
10. Sesión expirada.
11. Datos obsoletos o conflicto.
12. Conectividad degradada, cuando pueda detectarse de forma fiable.
13. Resultado parcial, si la operación admite resultados parciales.

No todas las pantallas necesitan todos estos estados, pero cada excepción debe justificarse.

## 6.2 Contrato de comunicación

Todo mensaje de estado debe responder, en la medida posible:

- ¿Qué pasó?
- ¿Cuál es la situación actual?
- ¿Qué puede hacer el usuario ahora?

Ejemplo de error:

“**No pudimos guardar la oportunidad.** Los datos siguen disponibles en el formulario. Volvé a intentarlo.”

Usar ese mensaje solamente si se confirmó que los datos permanecen disponibles.

No exponer stack traces, secretos, tokens ni mensajes internos del servidor.

## 6.3 Veracidad del estado

- No mostrar éxito antes de recibir una confirmación válida.
- No cambiar el estado visual a “Completado” si la operación falló.
- No asumir que una petición cancelada no produjo cambios en el servidor.
- No descartar formularios con información sin guardar sin advertirlo.
- No usar indicadores visuales que sugieran que un proceso continúa ejecutándose si ya terminó.

---

# 7. MODELO DE CONFIANZA PARA ACCIONES DE IA

La interfaz debe distinguir claramente el contenido generado por IA de las acciones efectivamente ejecutadas.

## 7.1 Ciclo conceptual

El ciclo previsto es:

`GENERATING → DRAFT → PENDING_APPROVAL → APPROVED → EXECUTING → SUCCEEDED`

Estados alternativos:

- `REJECTED`
- `FAILED`
- `EXPIRED`
- `CANCELLED`
- `NEEDS_REVISION`

Este es el modelo conceptual del producto, no una orden para introducir estados nuevos en la API sin revisión.

El agente debe mapear los estados existentes al diseño y documentar cualquier brecha entre el modelo conceptual y el backend.

## 7.2 Reglas de aprobación

- La aprobación debe corresponder a una acción específica.
- El usuario debe conocer el contenido y el alcance.
- Una modificación material debe invalidar la aprobación anterior cuando así lo requiera la política del sistema.
- La autorización debe validarse en el servidor.
- Un reintento no debe implicar una nueva autorización implícita.
- La interfaz debe diferenciar una acción autorizada de una acción completada.
- Los permisos del usuario no pueden inferirse solamente por los controles visibles.

## 7.3 No fingir inteligencia

Si una clasificación se realiza mediante reglas deterministas, describirla como clasificación automática basada en reglas, no como una decisión de un agente de IA.

Si una recomendación no dispone de explicación, no inventar una justificación.

La UI debe reflejar el sistema real, no una visión futura del producto.

---

# 8. ACCESIBILIDAD Y RESPONSIVE DESIGN

## 8.1 Estándar

Objetivo: WCAG 2.2 AA, en la medida aplicable al producto.

Requisitos mínimos:

- Navegación por teclado.
- Foco visible.
- Contraste adecuado.
- Etiquetas para formularios.
- Errores asociados a sus controles.
- Estructura semántica de encabezados.
- Nombre accesible para controles e iconos.
- Diálogos accesibles.
- Estados no comunicados exclusivamente mediante color.
- Zoom sin pérdida crítica de funcionalidad.
- Respeto por `prefers-reduced-motion`.
- Tamaños de interacción táctil de aproximadamente 44 × 44 px cuando sea viable.

No declarar cumplimiento completo de WCAG sin realizar pruebas suficientes.

## 8.2 Responsive

### Desktop

- Navegación persistente.
- Área de trabajo con ancho legible.
- Tablas y paneles con densidad moderada.
- Formularios con agrupación visual clara.

### Tablet

- Reducir la navegación cuando sea necesario.
- Mantener visibles las acciones prioritarias.
- Reorganizar paneles según su importancia.

### Mobile

- Priorizar contenido y acción principal.
- Navegación accesible.
- Formularios en una columna.
- Diálogos adaptados al viewport.
- Tablas convertidas en una presentación legible.
- Sin acciones importantes fuera del área visible sin indicación.
- Sin scroll horizontal de toda la página.

No considerar responsive una pantalla solo porque sus elementos se reducen de tamaño.

---

# 9. ARQUITECTURA DE IMPLEMENTACIÓN FRONTEND

## 9.1 Inspección previa obligatoria

Antes de modificar:

1. Verificar rama y estado de Git.
2. Inspeccionar `app/package.json`.
3. Revisar `app/public/index.html` y `app/public/app.js`.
4. Revisar las rutas y contratos de API que consume la UI.
5. Revisar las pruebas existentes.
6. Identificar cómo se sirve el frontend y cómo se construye el proyecto.
7. Registrar las funcionalidades actuales que deben preservarse.

La inspección debe realizarse sobre el estado real de la rama. No asumir que la inspección previa sigue reflejando los últimos cambios.

## 9.2 Organización propuesta

Adaptar a la arquitectura existente; no crear carpetas vacías ni mover archivos por estética.

Una estructura posible:

```text
app/
  public/
    index.html
    app.js
    styles/
      tokens.css
      base.css
      layout.css
      components.css
      pages.css
    modules/
      api.js
      state.js
      components.js
      navigation.js
      opportunities.js
      tasks.js
      approvals.js
      executions.js
```

Esta estructura es una propuesta, no una migración obligatoria.

Si el proyecto no utiliza módulos ES o tiene restricciones en su servidor estático, seleccionar una organización compatible y documentarla.

## 9.3 Principios de implementación

- Mantener TypeScript en el backend.
- No incorporar React, Next.js u otro framework sin una decisión arquitectónica justificada.
- Evitar dependencias innecesarias.
- Separar tokens, estilos base, componentes y estilos de página.
- Centralizar la comunicación con la API cuando sea razonable.
- Centralizar el manejo de errores sin perder contexto de cada operación.
- Mantener las responsabilidades del frontend limitadas a presentación, interacción y validación de experiencia.
- Mantener validación de seguridad y autorización en el servidor.
- Escapar o insertar de forma segura el contenido dinámico.
- No insertar HTML no confiable directamente en el DOM.
- No almacenar secretos en el frontend.

Si la implementación actual utiliza JavaScript nativo, conservarlo inicialmente es preferible a una reescritura completa sin una necesidad demostrada.

---

# 10. PLAN DE IMPLEMENTACIÓN POR FASES

## Fase 0 — Baseline técnico

Objetivo: establecer el estado inicial antes de tocar la interfaz.

Tareas:

- Inspección de repositorio.
- Identificación de rutas y funcionalidades existentes.
- Ejecución de pruebas disponibles.
- Verificación de scripts de build y typecheck.
- Captura del estado inicial de la aplicación, si el entorno lo permite.
- Inventario de problemas visuales y funcionales.

**Salida:** informe baseline con comandos ejecutados, resultados, limitaciones y funcionalidades que deben preservarse.

No continuar como si el baseline fuera correcto si aparecen fallos preexistentes. Registrarlos y distinguirlos de los nuevos.

## Fase 1 — Foundations

Implementar:

- Tokens visuales.
- Tipografía y escala de espaciado.
- Estilos globales.
- Botones, campos, badges y contenedores básicos.
- Foco visible y estados de interacción.
- Estructura principal responsive.

Criterio de salida: los elementos principales utilizan un sistema consistente, sin romper autenticación ni flujos actuales.

## Fase 2 — Layout y navegación

Implementar:

- Navegación principal.
- Encabezados de página.
- Estructura de contenido.
- Selección de sección activa.
- Adaptación para móvil.
- Estados de navegación y permisos cuando existan.

Criterio de salida: las secciones disponibles son accesibles, los destinos funcionan y no se muestran funciones inexistentes como si estuvieran implementadas.

## Fase 3 — Oportunidades y tareas

Implementar el diseño de:

- Lista de oportunidades.
- Formulario de creación.
- Estados vacíos y de error.
- Tareas y seguimientos.
- Feedback de operaciones.
- Diseño responsive de tablas y listas.

Criterio de salida: se mantienen los flujos existentes y se puede completar una operación real desde la interfaz.

## Fase 4 — Centro de aprobaciones

Implementar:

- Panel de revisión.
- Contexto del borrador.
- Contenido íntegro.
- Confirmación de acciones.
- Estados pendientes, aprobados, rechazados y fallidos según soporte real.
- Tratamiento de conflictos y estados obsoletos.

Criterio de salida: ningún estado visual confunde aprobación con ejecución efectiva y las acciones están respaldadas por el backend.

## Fase 5 — Actividad y ejecuciones

Implementar:

- Estado de ejecución.
- Historial de actividad.
- Detalle de pasos cuando exista.
- Errores comprensibles.
- Reintentos autorizados.
- Estados vacíos y de carga.

Criterio de salida: la información mostrada coincide con la información del servidor.

## Fase 6 — QA y cierre

Ejecutar:

- Pruebas funcionales.
- Pruebas responsive.
- Pruebas de accesibilidad.
- Pruebas de errores y recuperación.
- Pruebas de permisos en coordinación con el backend.
- Revisión de regresiones.
- Revisión del diff.
- Documentación de resultados y limitaciones.

No declarar el UI/UX System OS implementado hasta que las fases y criterios pertinentes estén verificados.

---

# 11. CRITERIOS DE ACEPTACIÓN

Cada criterio debe registrar un estado: `PASS`, `FAIL`, `BLOCKED` o `NOT_VERIFIED`.

| ID | Criterio | Evidencia requerida |
|---|---|---|
| DS-001 | Tokens centralizados | Archivos y referencias verificadas |
| DS-002 | Componentes consistentes | Inventario y uso real en pantallas |
| DS-003 | Estados de componentes definidos | Pruebas o revisión documentada |
| UX-001 | Navegación funcional | Verificación de cada destino |
| UX-002 | Flujos críticos preservados | Pruebas de creación, tareas y aprobaciones |
| UX-003 | Errores recuperables | Pruebas con respuestas fallidas |
| IA-001 | Borradores y acciones diferenciados | Inspección del flujo de aprobación |
| IA-002 | Aprobación asociada a una acción concreta | Verificación del contrato de backend |
| IA-003 | Reintentos seguros | Pruebas de idempotencia en backend |
| A11Y-001 | Navegación por teclado | Prueba manual documentada |
| A11Y-002 | Foco y contraste adecuados | Mediciones o auditoría de accesibilidad |
| RWD-001 | Layout adaptable | Pruebas en varios tamaños de viewport |
| SEC-001 | Autorización en servidor | Pruebas negativas de permisos |
| QA-001 | Sin regresiones críticas conocidas | Resultado de suite y pruebas de flujo |
| QA-002 | Sin acciones falsas | Verificación de estados frente a respuestas reales |
| QA-003 | Sin errores críticos de consola | Evidencia de ejecución en navegador, si disponible |

No marcar `PASS` por haber leído el código o por haber escrito una prueba. Debe existir evidencia de que el criterio se verificó.

## Bloqueos de lanzamiento

No declarar el frontend listo para un piloto con usuarios reales si existe alguno de estos problemas:

- Una acción sensible puede ejecutarse sin autorización.
- La UI indica éxito cuando el servidor falla.
- Los datos de una organización pueden quedar expuestos a otra.
- La aprobación no corresponde al contenido o acción autorizados.
- Hay un defecto crítico que impide utilizar un flujo principal.
- No puede recuperarse una operación fallida sin pérdida o ambigüedad grave.

Los defectos visuales menores deben registrarse, priorizarse y corregirse según impacto.

---

# 12. ESTRATEGIA DE PRUEBAS

## 12.1 Pruebas funcionales

Verificar como mínimo:

1. Registro e inicio de sesión.
2. Acceso al área autenticada.
3. Creación de una oportunidad.
4. Manejo de duplicados y validaciones.
5. Visualización de tareas.
6. Completar una tarea.
7. Revisión y aprobación de un borrador.
8. Rechazo de un borrador, si está soportado.
9. Consulta de auditoría.
10. Visualización de ejecuciones.
11. Reintento de una ejecución autorizada.
12. Manejo de errores de red o servidor.
13. Cierre de sesión y tratamiento de sesión expirada.

Utilizar datos ficticios en pruebas.

## 12.2 Pruebas de estados

Simular o provocar, de manera controlada:

- Carga lenta.
- Error HTTP.
- Respuesta de validación.
- Permiso denegado.
- Sesión expirada.
- Elemento eliminado o modificado desde otra sesión.
- Doble clic sobre una acción.
- Conflicto al aprobar.
- Fallo de un reintento.

No simular una respuesta exitosa como único escenario de prueba.

## 12.3 Pruebas visuales

Verificar al menos:

- 375 px de ancho.
- 640 px.
- 768 px.
- 1024 px.
- 1440 px.

Los tamaños son referencias de prueba, no una lista exhaustiva de dispositivos.

Revisar:

- Overflow.
- Jerarquía.
- Legibilidad.
- Alineación.
- Formularios.
- Tablas.
- Diálogos.
- Foco.
- Mensajes de error.
- Estados vacíos.

Si no se dispone de navegador automatizado, documentar esa limitación y no afirmar que se realizó una prueba visual real.

---

# 13. SEGURIDAD Y RESPONSABILIDADES

El rediseño visual no reemplaza las medidas de seguridad de la aplicación.

El agente debe mantener estas reglas:

- El backend valida la identidad y los permisos de cada operación.
- La organización se determina y valida en el servidor.
- Ocultar un botón no constituye autorización.
- Las respuestas de error no deben revelar secretos.
- Los datos dinámicos deben renderizarse de manera segura.
- No confiar en IDs, roles ni estados enviados únicamente por el cliente.
- Las aprobaciones y transiciones críticas se validan en el servidor.
- No exponer claves privadas en JavaScript o CSS.
- No registrar tokens ni información sensible en logs de frontend.
- Los enlaces externos deben tener un propósito legítimo y un destino verificado.

Los riesgos existentes de autenticación, almacenamiento de tokens, rate limiting y despliegue deben permanecer en el registro de seguridad correspondiente. No declarar que quedaron resueltos por haber mejorado la interfaz.

---

# 14. DOCUMENTACIÓN A ENTREGAR

Crear o actualizar, adaptando los nombres a la documentación existente:

```text
docs/design-system/
  README.md
  DESIGN_PRINCIPLES.md
  VISUAL_FOUNDATIONS.md
  DESIGN_TOKENS.md
  COMPONENT_CATALOG.md
  COMPONENT_STATES.md
  INFORMATION_ARCHITECTURE.md
  SCREEN_SPEC.md
  INTERACTION_PATTERNS.md
  AI_TRUST_AND_APPROVALS.md
  ACCESSIBILITY.md
  RESPONSIVE_BEHAVIOR.md
  ACCEPTANCE_TESTS.md
  DECISIONS.md
```

No crear archivos redundantes si la información ya está bien documentada en otro lugar. En ese caso, actualizar la fuente existente y registrar la decisión.

La documentación debe reflejar la implementación real, no solamente los objetivos del diseño.

---

# 15. INFORME FINAL OBLIGATORIO DEL AGENTE

Al terminar cada fase, presentar un informe con:

## Estado de la fase

- Fase y objetivo.
- Estado: `PASS`, `FAIL`, `BLOCKED` o `NOT_VERIFIED`.
- Archivos modificados.
- Funcionalidades afectadas.
- Decisiones tomadas.
- Pruebas ejecutadas.
- Resultados reales.
- Riesgos detectados.
- Limitaciones pendientes.
- Próximo paso recomendado.

## Resumen de cambios

Separar claramente:

- **Implementado:** existe en el código.
- **Verificado:** existe evidencia de funcionamiento.
- **Pendiente:** todavía no se implementó.
- **Bloqueado:** requiere acceso, decisión o intervención.
- **No verificado:** no hay evidencia suficiente.

No utilizar “terminado”, “seguro”, “responsive” o “accesible” como afirmaciones generales sin explicar el alcance de las verificaciones.

---

# 16. ORDEN DE EJECUCIÓN PARA EL AGENTE

Seguí este orden sin saltar directamente a una reescritura:

1. Inspeccioná la rama, los archivos y el estado actual.
2. Establecé el baseline técnico y funcional.
3. Compará la implementación existente con esta especificación.
4. Presentá un plan breve con archivos afectados y riesgos.
5. Implementá primero los tokens y la estructura visual.
6. Continuá con navegación y componentes compartidos.
7. Rediseñá oportunidades y tareas sin romper sus contratos.
8. Implementá el Centro de aprobaciones con especial atención al control humano.
9. Rediseñá actividad y ejecuciones.
10. Ejecutá pruebas funcionales, responsive y de accesibilidad.
11. Revisá el diff y documentá las desviaciones.
12. Presentá la evidencia y solicitá autorización antes de cualquier merge o despliegue no autorizado.

Si una fase está bloqueada, continuá con tareas independientes que no amplíen el riesgo.

**Criterio rector:** implementar la interfaz más clara y confiable que permita la funcionalidad real del producto, no simular un producto más avanzado de lo que realmente es.

**Resultado esperado:** una primera versión coherente, usable y verificable del UI/UX System OS, preparada para evolucionar hacia un producto B2B profesional sin sacrificar seguridad, control ni mantenibilidad.

Usá `SuperInteligent System — UI/UX System OS v1.1` como contrato de implementación.

Comenzá por la Fase 0: inspección del repositorio y baseline. No asumas que la documentación describe exactamente el código actual.

Después, identificá las diferencias entre la UI existente y la especificación, y proponé un plan de cambios por incrementos pequeños. Implementá los cambios autorizados, ejecutá las pruebas disponibles y reportá evidencia verificable.

Preservá la lógica de negocio, los contratos de API, la autenticación y las funcionalidades existentes. No introduzcas capacidades ficticias ni declares aprobaciones, ejecuciones o envíos que no hayan ocurrido.

No hagas merge a `main`, despliegues de producción ni cambios destructivos sin autorización explícita.

Al finalizar cada fase, entregá el estado, los archivos modificados, las pruebas ejecutadas, los resultados, los riesgos y los pendientes. No marques criterios como PASS sin evidencia.
