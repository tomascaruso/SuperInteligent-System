# Especificación de pantallas (resumen real)

- **Acceso:** correo + contraseña + Entrar; botón «Tengo una
  invitación» que muestra código + nombre + contraseña + «Crear mi
  organización». Nota de la demo sembrada. Errores en `#error`.
- **Inicio:** indicadores (oportunidades, tareas pendientes,
  aprobaciones pendientes, ejecuciones fallidas), acciones prioritarias
  calculadas (vencidas, pendientes, fallidas) y actividad reciente (5).
- **Oportunidades:** formulario de alta manual (contacto, correo,
  empresa opcional, mensaje) + tabla (contacto, empresa, categoría,
  prioridad, estado). Sin filtros ni búsqueda: no existen en el backend.
- **Tareas:** lista de abiertas con título, agente, vencimiento y
  «Marcar hecha». Sin filtros por estado en la UI (la API los soporta).
- **Aprobaciones:** pendientes con contacto, empresa, categoría, canal
  («No disponible»: no existe en el backend), alcance real, cuerpo,
  marcas de vencido/desactualizado y aprobar/rechazar (solo admin);
  decididos con quién, cuándo y motivo si lo hubo.
- **Actividad:** auditoría (20) con acción y entidad en lenguaje claro,
  procesos (20) con workflow, versión y ejecución asociada, ejecuciones
  (20) con detalle real y «Ver pasos» bajo demanda; «Reintentar» solo
  en fallidas y solo para admin, siempre con diálogo previo.

Las listas se limitan a 20 en la UI (la API permite hasta 100).
