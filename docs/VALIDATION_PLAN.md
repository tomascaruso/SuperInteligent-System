# VALIDATION_PLAN — Demostración y supuestos (sin validación comercial)

Regla: ningún cliente, venta, entrevista ni métrica existe hasta que se
ejecuta y se registra. Todo lo de abajo son hipótesis y planes diseñados,
no resultados.

**Decisión 25-oct-2026 (D12): NO habrá entrevistas ni pilotos con agencias
reales.** SuperInteligent se construye como un sistema real y profesional
para el portafolio de Tomás, para vender sus servicios. La «validación» en
esta fase es demostrar que el sistema funciona de verdad y resulta
profesional y creíble para un potencial cliente de sus servicios.

## Hipótesis (supuestos del escenario de la demo, no hechos de mercado)

- **H1:** agencias de marketing y consultoras B2B pequeñas/medianas pierden
  oportunidades por captura, organización y seguimiento deficientes
  (información dispersa, seguimientos olvidados, tareas manuales y el
  fundador como cuello de botella). Detalle en `docs/BUYER_PERSONA.md`.
- **H2:** el dolor es frecuente y tiene un dueño claro (fundador/a o
  responsable comercial). Supuesto del escenario, no medido.
- **H3:** un sistema que garantice «ninguna oportunidad sin dueño ni
  siguiente acción» resulta creíble y valioso como demostración de
  capacidad, si el recorrido de la demo se entiende en minutos, no en
  semanas.
- **H4 (SIN EFECTO para la venta del SaaS):** el rango USD 29–99/mes era una
  hipótesis de precio de producto; ya no se mide. Puede orientar, sin
  decidir, el precio de los servicios de Tomás.
- **H5:** la diferenciación a demostrar no es «tener IA» sino el flujo
  guiado + auditoría + aprobaciones (lo que los CRM genéricos no imponen).

## Competencia (contexto de terceros, a verificar en webs oficiales)

Comparativas de 2026 listan para equipos pequeños: HubSpot (desde ~USD
15–20/usuario/mes, con salto fuerte a planes con automatización),
Pipedrive (~USD 14–19/usuario/mes), Close (~USD 9–49/usuario/mes), Attio
(gratis hasta 3 asientos, luego ~USD 29/usuario/mes), Folk (~USD 24),
Zoho CRM (~USD 14), Freshsales (~USD 9), Monday CRM (~USD 10–15) y
opciones «AI-native» como Breakcold (~USD 99/mes plano + asientos).
Fuentes consultadas en Gate 0: breakcold.com (lead tracking y CRM para
agencias), companyview.io, prospeo.io, rankite.com. Precios aproximados y
variables según plan: verificar en la web oficial antes de cualquier
afirmación comercial. Hueco que la demo debe mostrar: herramienta pequeña,
guiada y auditable, sin la complejidad ni el coste de una suite y sin
exigir un administrador a tiempo parcial.

## Experimentos

**E1 (entrevistas) y E3 (pilotos): CANCELADOS el 25-oct-2026.** No habrá
entrevistas ni pilotos con agencias reales. El plan queda así:

### D1 — Demo real con datos ficticios (Fases 1–3)

- Tenant de ejemplo: la agencia ficticia de Martín
  (`docs/BUYER_PERSONA.md`), con oportunidades, tareas y borradores
  inventados por un script de seed.
- Criterio: el flujo completo funciona de verdad (los 12 criterios del
  PRD con tests ejecutados), con auditoría, aprobaciones y controles de
  seguridad. No es una maqueta: es el sistema real, con datos de ejemplo.

### D2 — Revisión de portafolio (Fase 3)

- Tomás revisa la demo como si fuera un potencial cliente de sus
  servicios: ¿se entiende el problema, el flujo y el valor en menos de
  10 minutos? ¿El caso es creíble y profesional?
- Criterio: demo en entorno autorizado (requiere aprobación explícita),
  recorrido guiado y documentación del caso.

### E2 — Caso de portafolio y plantilla (Fase 4)

- Publicar el caso (problema, arquitectura, flujo, capturas o video) como
  vidriera de la plantilla para vender el servicio de implementación.
  Sin afirmaciones de clientes reales, ventas o métricas de mercado.
- Criterio de plantilla: un segundo negocio de ejemplo (de otro vertical)
  puede configurarse desde la plantilla sin modificar el núcleo; si exige
  bifurcar el núcleo, la plantilla está incompleta y se registra la deuda.

## Métricas (del sistema, con datos de ejemplo)

Producto: captura correcta, duplicados, tiempo hasta la primera acción,
seguimientos a tiempo, calidad de clasificación, borradores aceptados,
errores y recuperaciones. Operación: coste por ejecución, latencia,
fallos, intervenciones humanas. Las métricas de negocio (conversión, CAC,
retención, margen) quedan SIN EFECTO: no hay venta del SaaS en esta fase.

## Si la demo no resulta creíble

Se ajusta el alcance de la demo (flujo, datos de ejemplo, recorrido,
documentación). No se buscan clientes reales para validarla sin una nueva
decisión explícita.
