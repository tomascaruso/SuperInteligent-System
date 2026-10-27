# Referencia visual objetivo — SIS (SuperInteligent System)

**Fecha:** 26-oct-2026 (noche, ART)
**Origen:** imagen provista por Tomás (mockup de dashboard SIS by
PENSIA). Archivo original guardado en:
`~/workspace/user/media_library/image/58/58abda769cb1d8ca3ff7f499c6d1d578aa1cb0f569200c3a6b3157da52c01d43.png`
(PNG 1312×1199). Esta nota es el registro durable de la
instrucción; la imagen NO se copia al repo.
**Estado:** GUARDADA como referencia. Sin cambios de código, sin
merge, sin despliegue. La implementación futura requiere primero el
diagnóstico de brechas (referencia vs. UI real) bajo las reglas del
UI/UX System OS.

## Qué muestra la referencia (lenguaje visual a tomar)

- Estética B2B SaaS premium, tema claro, acentos índigo/violeta,
  tarjetas redondeadas con sombra suave, jerarquía clara.
- Navegación lateral: Inicio, Procesos, Agentes, Clientes,
  Oportunidades, Tareas, Aprobaciones, Integraciones, Reportes,
  Configuración; bloque inferior «Orquestador» con descripción y
  estado Activo.
- Tarjetas de métricas con variación vs. período anterior
  (oportunidades activas, tareas en curso, aprobaciones pendientes,
  procesos completados hoy).
- Gráfico de líneas «Evolución de oportunidades» (total/ganadas/
  perdidas) y donut «Distribución por agente» (tareas por agente).
- Tabla operativa «Procesos en ejecución» (proceso/cliente, estado,
  agentes activos, paso actual, tiempo).
- Panel «Actividad reciente» (eventos con cliente y hora).
- Panel «Agentes en funcionamiento» (agentes con estado Activo).
- Panel «Orquestador»: flujo de proceso por pasos (Inicio →
  Agente Comercial → Agente de Análisis → Agente de Calidad →
  Aprobación Humana → Resultado), detalle del proceso con
  timeline, información del cliente, documentos generados y
  «Últimas ejecuciones» con estado (Exitosa / Con observaciones).

## Reglas de uso (instrucción de Tomás, 26-oct-2026)

- La imagen es referencia de diseño, NO especificación funcional
  literal. No se copia tal cual.
- Rigen las indicaciones, criterios de aceptación y restricciones
  del UI/UX System OS v1.1 existente. La referencia lo
  complementa, no lo reemplaza.
- Adaptar la composición a la arquitectura, componentes y
  funcionalidades reales del repositorio (oportunidades, tareas,
  borradores, agentes, procesos, ejecuciones, políticas).
- SIS es orquestación y supervisión de agentes inteligentes, NO
  un dashboard de CRM. La navegación y las vistas deben reflejar
  eso (procesos, agentes, ejecuciones, aprobaciones), sin reducir
  el sistema a clientes y oportunidades.
- No inventar datos, integraciones, agentes activos ni
  ejecuciones. Todo estado mostrado debe corresponder a
  información real o identificarse explícitamente como
  demostrativo. Los números de la imagen (24 oportunidades, 18
  tareas, 128 tareas por agente, clientes como TechSolutions) son
  ficticios/demostrativos y NO corresponden a la demo real.
- Preservar las funcionalidades existentes, trabajar
  incrementalmente. Sin cambios destructivos, merges ni
  despliegues sin autorización explícita de Tomás.
- Continuar desde el diagnóstico y el plan ya acordados, sin
  repetir trabajo. No modificar archivos de la app hasta completar
  la fase de diagnóstico de brechas de esta referencia, si está
  pendiente.

## Próximo paso (cuando Tomás lo pida)

Diagnóstico de brechas: comparar esta referencia con la UI real
(vistas actuales, tokens, componentes) bajo el System OS, y
proponer el plan incremental de acercamiento visual sin inventar
capacidades ni datos.
