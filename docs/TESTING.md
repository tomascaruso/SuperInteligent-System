# TESTING — Estrategia y requisitos de calidad

## Niveles

1. **Unitarias (Vitest):** normalización, dedup, reglas de clasificación,
   cálculo de prioridad, validación de esquemas, Policy Engine.
2. **Integración:** flujo completo contra base de datos de prueba
   descartable (Postgres de prueba; sin datos reales, sin servicios externos
   reales: proveedor de IA con stub).
3. **Seguridad:** escape multiempresa, rol sin permiso, webhook sin firma,
   duplicado de acción externa, inyección de instrucciones en texto libre.
4. **E2E del flujo crítico:** alta → clasificación → tarea → borrador →
   aprobación → registro, con datos ficticios, en entorno reproducible.
5. **Evaluación de IA (Fase 2):** conjunto fijo de casos con salida esperada;
   la IA solo se adopta si supera a las reglas con margen definido antes de
   medir (propuesta: +10 puntos en exactitud de clasificación sin bajar la
   precisión en casos sensibles).

## Requisitos de calidad (MVP)

- Los 12 criterios de aceptación del PRD tienen al menos un test que los
  cubre; un criterio sin test ejecutado es NOT_VERIFIED, nunca PASS.
- Sin `skip` ni controles desactivados para lograr un verde artificial.
- Cada cambio: tests del módulo afectado + flujo crítico, revisión del diff
  y registro de deuda técnica visible en `BACKLOG.md`.
- Datos de prueba: ficticios y generados por script; nunca copias de datos
  reales ni secretos.

## Entornos

- **Local:** desarrollo y tests unitarios.
- **Prueba:** base de datos descartable + stub de IA; es el entorno donde se
  demuestra el flujo reproducible del criterio 12.
- **Producción:** no existe en Gate 0; su creación requiere autorización
  explícita y queda fuera del MVP inicial (el piloto correrá en entorno de
  prueba autorizado o en producción solo con aprobación).

## CI (propuesta, no instalada)

Pipeline en el proveedor de git que se elija (GitHub Actions como candidato):
lint + tipos + tests unitarios + integración en cada pull request. La
instalación real es tarea de Fase 1 (ítem F1-CI) y requiere decidir dónde
vive el repositorio remoto (decisión humana, ver `BACKLOG.md` G0-D3).
