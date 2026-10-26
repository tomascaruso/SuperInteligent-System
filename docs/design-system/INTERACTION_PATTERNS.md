# Patrones de interacción

- **Carga inicial:** `/api/me` por cookie. Con sesión, carga la app;
  sin ella, queda la pantalla de acceso.
- **Actualización:** `refresh()` recarga todo (me, stats, oportunidades,
  tareas, borradores, auditoría, procesos, ejecuciones) y reconstruye
  las listas. El botón «Actualizar» usa el mismo camino.
- **Envío:** `withLoading` deshabilita el botón y muestra carga en
  crear, completar, confirmar, entrar, aceptar y actualizar. No hay
  dobles envíos en esas acciones.
- **Feedback por sección:** cada sección tiene su mensaje (`#*-feedback`)
  con `aria-live="polite"`; el error global (`#error`) tiene
  `role="alert"`. Un error de sección no borra los datos visibles.
- **Errores y recuperación:** 409 (conflicto) cierra el diálogo, informa
  y recarga para mostrar el estado real; 403/404 informan con el mensaje
  del servidor; 401 en una actualización devuelve a la pantalla de
  acceso («La sesión expiró»); fallo de red se explica en español.
- **Diálogo:** confirmar con efecto real escrito, foco en Cancelar,
  Escape, clic fuera, trampa de foco y foco restaurado.
- **Pasos bajo demanda:** «Ver pasos» carga una vez por ejecución y
  luego solo muestra/oculta; un fallo de carga queda visible en la lista.
- **Navegación:** hash + `aria-current`; la vista desconocida cae a
  Inicio.
- **Salida:** «Salir» cierra la sesión en el servidor y vuelve al
  acceso aunque la llamada falle (sesión ya vencida).
