# ROADMAP — Fases, dependencias y criterios de salida

## Gate 0 — Descubrimiento y diseño (esta fase)

- Entregables: README, PRD, ARCHITECTURE, SECURITY, WORKFLOWS, TESTING,
  OPERATIONS, ROADMAP, DECISIONS, VALIDATION_PLAN, BUYER_PERSONA, BACKLOG.
- **Criterio de salida:** revisión humana + decisiones G0-D1 (stack) y
  G0-D3 (repo remoto y cuentas). G0-D2 quedó CANCELADA el 25-oct-2026 (no
  habrá entrevistas; ver D12). Sin G0-D1 y G0-D3, Gate 0 NO está aprobado,
  aunque la documentación exista.

## Fase 1 — MVP Core (sin IA real)

1. Scaffold TS + Fastify + Postgres de prueba; repo y CI básica.
2. Auth + organizaciones + RLS + tests de aislamiento.
3. Ingesta (manual + webhook firmado), normalización, dedup, upsert.
4. Clasificación por reglas, tareas, borradores por plantilla, aprobaciones.
5. Auditoría, outbox + worker, límites de uso/coste, logs y métricas.
6. Tests de los 12 criterios de aceptación en entorno reproducible.
- **Salida:** demo reproducible del flujo completo con datos ficticios,
  informe de pruebas y lista de deudas. Sin clientes reales todavía (ni
  los habrá en esta fase).

## Fase 2 — IA medida

- Conjunto de evaluación fijo; proveedor de IA con claves aprobadas;
  clasificación y borradores con IA solo donde superen a las reglas.
- **Salida:** informe de evaluación con números (no afirmaciones) y
  decisión documentada de qué usa IA y qué sigue siendo determinista.

## Fase 3 — Demo de portafolio (sin clientes reales)

- Tenant ficticio con datos de ejemplo (la agencia de Martín), flujo
  completo funcionando, recorrido guiado y documentación del caso.
- **Salida:** demo revisada por Tomás como si fuera un potencial cliente
  de sus servicios: comprensible en menos de 10 minutos, profesional y
  creíble. El despliegue del entorno demo requiere autorización explícita.

## Fase 4 — Plantilla y venta de implementaciones

- Empaquetar la plantilla (cómo clonar y configurar para un nuevo cliente
  sin tocar el núcleo) y publicar el caso (problema, arquitectura, flujo,
  capturas o video) como vidriera.
- Vender el servicio de implementación: cada empresa cliente obtiene su
  propio sistema adaptado desde la plantilla (orquestador + agentes para
  su negocio). No hay venta de licencias del SaaS ni métricas de mercado
  que afirmar en esta fase.
- **Salida:** plantilla documentada y reutilizable + primer cliente de
  implementación (cuando llegue) adaptado por configuración, sin
  bifurcación del núcleo.

## Dependencias críticas

G0-D1/D3 → Fase 1 → evaluación (Fase 2) → demo (Fase 3) → plantilla y venta
de implementaciones (Fase 4). No hay validación comercial en paralelo: la
demo de la Fase 3 depende de que las Fases 1 y 2 demuestren un sistema real
y profesional.
