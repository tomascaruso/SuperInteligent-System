# Confianza y aprobaciones

- **Alcance escrito.** Cada borrador muestra qué hace la decisión:
  actualiza el estado de la oportunidad y registra la decisión en la
  auditoría. Y qué NO hace: «No envía ningún mensaje.»
- **Canal honesto.** El canal se muestra «No disponible»: el backend no
  tiene campo de canal. No se inventa uno.
- **Quién decide.** Solo admin ve aprobar/rechazar/reintentar; el resto
  ve una nota de rol. Ocultar no autoriza: el servidor exige admin y
  devuelve 403.
- **Vigencia.** Un borrador vencido (>7 días, configurable por política)
  o desactualizado (el mensaje cambió) no se puede aprobar: el botón se
  deshabilita y el servidor rechaza con 409. Rechazarlo sigue permitido
  para descartarlo.
- **Conflictos.** Si el borrador ya fue decidido, el servidor responde
  409; la UI cierra el diálogo, informa y recarga el estado real.
- **Reintentos.** Solo ejecuciones fallidas, solo admin, con tope por
  ejecución original según políticas y diálogo previo con el efecto
  real. Cada reintento crea una ejecución nueva y queda auditado.
- **Trazabilidad.** Auditoría con actor, acción, entidad y detalle real;
  pasos de ejecución persistidos y expuestos bajo demanda.
