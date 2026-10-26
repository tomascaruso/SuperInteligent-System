# Catálogo de componentes (reales, de `app/public/`)

| Componente | Clases | Uso real |
|---|---|---|
| Button | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger`, `.btn-sm` / `.btn-lg` | Todas las acciones. Primario: entrar, crear, aprobar, confirmar. Secundario: ver pasos, reintentar, actualizar. Ghost: salir. Danger: rechazar. |
| TextField | `.field-wrap`, `.field-label`, `.field` (+ `textarea.field`) | Todos los formularios. Siempre con etiqueta asociada (`for`/`id`). |
| Badge | `.badge` + `-neutral` / `-info` / `-success` / `-warning` / `-danger` | Prioridad, estado de oportunidad, borrador, ejecución, proceso. Siempre con texto. |
| Card | `.card` | Secciones de cada vista y borradores. |
| DataTable | `.data-table` | Oportunidades. A ≤767 px se convierte en tarjetas (ver responsive). |
| Alert | `.alert` + `-error` / `-info` / `-success` / `-warning` | Errores y mensajes por sección y global. Vacío se oculta (`:empty`). |
| Empty state | `.empty-state` | Listas y tablas sin datos, con texto que explica el siguiente paso. |
| Task list | `.task-list` | Tareas abiertas con botón de completar. |
| Dialog | `.dialog-overlay`, `.dialog` | Confirmación de aprobar, rechazar y reintentar. |
| ApprovalPanel | `.draft-body` | Cuerpo del borrador en texto preformateado. |
| Stat card | `.stat-card`, `.stat-value`, `.stat-label` | Indicadores de Inicio, enlazan a su vista. |
| Nav link | `.nav-link`, `.nav-count` | Navegación lateral (horizontal en móvil). Contador oculto en cero. |
| Feedback | `#*-feedback`, `#error` | Mensajes por sección y global (ver interacción). |
