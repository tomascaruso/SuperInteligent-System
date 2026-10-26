# Principios de diseño

1. **Sobrio y B2B.** Fondo claro, índigo solo para acciones primarias y
   foco. Nada decorativo que compita con los datos.
2. **Claro antes que denso.** Texto de 14 px, jerarquía por tamaño y peso,
   sin comprimir información para que entre más.
3. **Sin capacidades ficticias.** La UI muestra solo estados reales del
   servidor (Fase 5): no hay pendientes, ejecuciones en curso ni envíos
   inventados. Aprobar actualiza estado y audita; no envía mensajes.
4. **Control humano explícito.** Cada decisión sensible pasa por un
   diálogo con efecto real escrito, y el servidor valida permisos, tope y
   vigencia (ver `AI_TRUST_AND_APPROVALS.md`).
5. **El color nunca es el único indicador.** Badges e indicadores llevan
   texto; los errores llevan mensaje, no solo color.
6. **Recuperable.** Todo fallo termina en un mensaje y un estado real
   (reintentar, volver a entrar, recargar), nunca en un éxito falso.
