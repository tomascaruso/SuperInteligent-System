# Criterios de aceptación (sección 11 de la especificación)

Estados: `PASS`, `FAIL`, `BLOCKED`, `NOT_VERIFIED`. No se marca PASS
solo por haber leído el código: la evidencia indicada es la que sostiene
cada marca. Detalle completo en `docs/FASE-6-REPORTE.md`.

| ID | Criterio | Estado | Evidencia |
|---|---|---|---|
| DS-001 | Tokens centralizados | PASS | `styles/tokens.css` verificado contra la especificación; una desviación documentada (texto secundario/auxiliar). |
| DS-002 | Componentes consistentes | PASS | Inventario real en `COMPONENT_CATALOG.md`; uso en pantallas. |
| DS-003 | Estados definidos | PASS | `COMPONENT_STATES.md`; marcadores en tests de Fase 6. |
| UX-001 | Navegación funcional | PASS | 5 destinos por hash + `aria-current`; verificados en vivo en la demo tras cada merge. |
| UX-002 | Flujos críticos preservados | PASS | Suite 72/72 + smokes + verificaciones en vivo. Ítem «registro» adaptado a invitación (C8). |
| UX-003 | Errores recuperables | PASS | 409/403/401/red con manejo en UI; tests de marcadores Fase 6. |
| IA-001 | Borradores y acciones diferenciados | PASS | Diálogo con alcance real; canal «No disponible» honesto. |
| IA-002 | Aprobación asociada a acción concreta | PASS | Aprobación por id de borrador; 409 vencido/desactualizado (C5). |
| IA-003 | Reintentos seguros | PASS | Nueva ejecución por reintento; tope y solo admin (C6); tests. |
| A11Y-001 | Navegación por teclado | NOT_VERIFIED | Implementada (foco, trampa, Escape), sin recorrido manual registrado. |
| A11Y-002 | Foco y contraste adecuados | PASS | Foco visible en CSS; contrastes medidos (ver `ACCESSIBILITY.md`). |
| RWD-001 | Layout adaptable | NOT_VERIFIED | Reglas inspeccionadas; sin matriz real de viewports (sin navegador automatizado). |
| SEC-001 | Autorización en servidor | PASS | 401/403/404 en suite; ocultar botones no autoriza. |
| QA-001 | Sin regresiones críticas | PASS | Suite 72/72 + smoke + verificaciones en vivo sin regresiones. |
| QA-002 | Sin acciones falsas | PASS | Solo estados reales; carga y vacío etiquetados; sin envíos simulados. |
| QA-003 | Sin errores críticos de consola | NOT_VERIFIED | Consola no capturada; las verificaciones en vivo no mostraron roturas, pero eso no es captura de consola. |

Bloqueos de lanzamiento (sección 11): ninguno detectado. Ver el informe
Fase 6 para la revisión punto por punto.
