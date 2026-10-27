# SIS — Frontend Modernization & Visual Design System
## Instrucción de implementación (guardada 26-oct-2026)

**Origen:** instrucción de Tomás del 26-oct-2026 (noche, ART).
**Estado:** GUARDADA. Fase 1 (diagnóstico) completada en
`docs/FRONTEND-MODERNIZATION-DIAGNOSTICO.md`. Fases 2–5
pendientes de autorización por fase. Sin merges ni despliegues
sin autorización explícita.

## 1. Objetivo

Modernizar el frontend de SuperInteligent System (SIS, por
PENSIA) a una plataforma B2B SaaS profesional: interfaz
coherente, moderna, sofisticada, responsive y preparada para
crecer. Referencias visuales: las imágenes del dashboard y de
la pantalla de acceso ya entregadas. NO una versión ligeramente
mejorada: una base profesional con componentes reutilizables y
un sistema de diseño consistente para implementar
progresivamente todas las pantallas. SIS es consola de
operaciones, supervisión y control de IA (orquestador + agentes
especializados), NO un CRM genérico.

## 2. Stack objetivo (si es compatible y migrable con seguridad)

React (interfaces modulares), TypeScript, Vite (si encaja),
Tailwind CSS (tokens y responsive), shadcn/ui (accesibles y
personalizables, NO como biblioteca independiente de React),
Lucide React (iconografía), React Router (si la estructura lo
requiere), Recharts (solo si hay datos reales), React Hook Form
y Zod (cuando aporten valor). No instalar todo
indiscriminadamente: comprobar versiones compatibles, build y
dependencias existentes; usar versiones estables compatibles
entre sí. Si el frontend es vanilla, preparar una migración
controlada a React + TypeScript.

## 3. Protección del sistema existente

Antes de modificar: inspeccionar Git/rama/cambios, punto de
entrada, backend, rutas, autenticación, APIs, estilos y flujos;
comprobaciones iniciales; riesgos y regresiones; estrategia
incremental. Reglas: preservar backend, contratos de API,
persistencia, autenticación y permisos; no eliminar
funcionalidades; no reescribir backend ni cambiar la base de
datos por una tarea visual; no datos ficticios ni
integraciones/ejecuciones/actividad simuladas; no mostrar éxito
sin confirmación del backend; no sobrescribir cambios locales;
no merges, despliegues ni migraciones destructivas sin
autorización. Se puede implementar tras la inspección si hay
estrategia segura y alcance claro; ante riesgo para datos,
seguridad o funciones esenciales, detenerse y pedir
autorización.

## 4. Sistema de diseño obligatorio

Tokens centralizados, sin estilos arbitrarios ni componentes
duplicados. Identidad: SaaS B2B premium, claro, ordenado,
minimalista y profesional. Fondo `#F7F8FC`, superficies
`#FFFFFF`, primario `#4F46E5`, hover `#4338CA`, fondo primario
sutil `#EEF2FF`, texto principal `#172033`, secundario
`#64748B`, atenuado `#94A3B8`, bordes `#E2E8F0`, éxito
`#15803D`, advertencia `#B45309`, error `#B91C1C`,
información `#1D4ED8`. Tipografía Inter, Geist Sans o
alternativa de sistema; escala tipográfica consistente; espaciado
en múltiplos de 4 px; radios 8 px controles, 12 px tarjetas,
16 px diálogos (salvo excepción justificada); sombras sutiles.
Biblioteca interna reutilizable (según necesidades reales):
botones, campos/selectores/formularios, badges, tarjetas,
tablas y filtros, menús y navegación, diálogos, alertas,
estados vacíos, carga y skeletons, errores y recuperación,
paneles de aprobación, cronologías de ejecución, indicadores de
agentes y procesos. shadcn/ui como base personalizable
adaptada, no como interfaz predeterminada.

## 5. Arquitectura de la interfaz

Módulos claros (adaptados al código existente, sin carpetas
vacías): `app` (init, rutas, config), `components/ui`,
`components/layout`, `features/auth`, `features/dashboard`,
`features/processes`, `features/agents`,
`features/opportunities`, `features/tasks`,
`features/approvals`, `features/activity`, `lib` (API,
utilidades), `types`. Separar presentación de llamadas al
backend; estados de carga, error, autenticación y datos claros.

## 6. Pantallas

- **Acceso:** diseño de la referencia, identidad SIS/PENSIA,
  accesible, validaciones, errores claros, mostrar/ocultar
  contraseña, estados de carga, responsive. Sin Google,
  recuperación ni otras opciones sin soporte en el backend.
- **Dashboard operativo:** nav lateral, cabecera con
  organización y usuario, indicadores y estado del sistema,
  resumen de procesos/tareas/aprobaciones, actividad reciente,
  estado de agentes, procesos en ejecución, panel del
  orquestador cuando haya datos reales suficientes. Todo de la
  API o fuentes identificadas; sin métricas inventadas.
- **Procesos y ejecuciones:** estado, etapa, agente
  responsable, cronología, errores y reintentos, acciones según
  permisos y estado real.
- **Agentes:** identidad y función, estado operativo real
  cuando esté disponible, procesos asignados, últimas
  ejecuciones, herramientas y permisos efectivos (sin secretos).
- **Oportunidades y tareas:** conservar flujos actuales;
  mejores tablas, filtros, formularios, detalle y vacíos;
  lectura rápida; no convertirlo en CRM genérico.
- **Aprobaciones y auditoría:** distinguir borradores de
  acciones aprobadas/ejecutadas; qué se aprueba y con qué
  contenido/parámetros; vínculo con la versión exacta; si el
  contenido cambia materialmente, nueva aprobación; resultados
  confirmados por el backend; auditoría y errores
  comprensibles. Sin módulos, permisos ni capacidades
  inventadas.

## 7. UX y calidad visual

Jerarquía clara, espaciado uniforme, tablas legibles, navegación
intuitiva, estados de carga/vacío/error/éxito/acceso denegado,
formularios con etiquetas y validación, confirmación antes de
acciones sensibles, responsive, teclado y foco visible,
contraste, objetivos táctiles ~44×44 px, movimiento reducido,
sin desbordes horizontales, sin errores críticos en consola,
sin botones decorativos que aparenten funcionar. No solo
colores y bordes: composición, espacios, navegación, densidad
y experiencia completa por pantalla.

## 8. Plan por fases

- **Fase 1 — Diagnóstico y preparación:** inspeccionar repo y
  Git, confirmar arquitectura, funcionalidades y dependencias,
  estrategia de migración, comprobaciones iniciales.
- **Fase 2 — Fundamentos:** React + TypeScript + build,
  Tailwind, shadcn/ui personalizado, Lucide, tokens, tipografía,
  componentes base, rutas; backend sigue accesible.
- **Fase 3 — Acceso y estructura:** diseño de autenticación,
  layout principal, navegación, cabecera, contenedores;
  sesiones y permisos conservados.
- **Fase 4 — Pantallas operativas:** dashboard, procesos y
  ejecuciones, agentes y orquestador, oportunidades y tareas,
  aprobaciones y auditoría. Primero las que conecten de forma
  fiable a las APIs actuales; sin backend, limitación explícita
  en vez de simulación.
- **Fase 5 — Verificación:** pruebas disponibles, nuevas
  pruebas de flujos afectados, compilación y TypeScript,
  autenticación, navegación y APIs, errores/carga/vacíos,
  responsive, regresiones. No declarar aprobado lo no ejecutado
  ni evidenciado.

## 9. Criterios de aceptación

Stack acordado y arquitectura mantenible; sistema de diseño
centralizado y componentes reutilizables; acceso y dashboard
próximos a las referencias; demás pantallas con la misma
identidad; funciones existentes operativas; autenticación,
permisos y APIs compatibles; datos reales; sin acciones falsas
ni éxitos inventados; errores/carga/vacíos verificados;
responsive y accesibilidad básica; pruebas, resultados,
limitaciones y riesgos documentados.

## 10. Informe final

Stack y versiones adoptados; arquitectura anterior y nueva;
archivos creados/modificados; pantallas completadas; funciones
preservadas; pruebas y resultados verificables; capturas si el
entorno lo permite; pendientes, limitaciones y riesgos; qué
sigue siendo simulación o necesita soporte del backend.
Prioridad: interfaz profesional y coherente sin sacrificar
funcionalidad, seguridad ni la visión de PENSIA; la calidad
visual proviene de arquitectura y sistema de diseño sólidos,
no de cambios cosméticos aislados.
