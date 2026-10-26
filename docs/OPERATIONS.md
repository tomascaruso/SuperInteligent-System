# OPERATIONS — Ejecución, configuración, monitoreo y recuperación

## Configuración

- Todo por variables de entorno (nunca en código): conexión a base de datos,
  secreto de webhook por canal, clave del proveedor de IA (Fase 2),
  presupuestos por ejecución y por organización, origen permitido.
- Sin valores por defecto inseguros; si falta una variable crítica, el
  proceso no arranca y lo dice explícitamente.
- Un archivo `.env.example` (sin valores reales) documenta cada variable.

## Ejecución

- API + worker outbox en el mismo despliegue en MVP (un proceso web y un
  proceso worker, o worker integrado con intervalo; a decidir en Fase 1
  según el hosting).
- Cada ejecución tiene `execution_id` visible en logs y auditoría.

## Monitoreo (mínimo del MVP)

- Logs estructurados (JSON) con `execution_id`, `org_id`, paso y resultado;
  sin secretos ni cuerpos sensibles.
- Métricas por organización: ejecuciones, latencia media, fallos,
  reintentos, coste estimado por ejecución, intervenciones humanas.
- Alertas (propuesta, a implementar en Fase 1): tasa de fallos > 5% en 1 h,
  coste diario por encima del presupuesto, worker sin procesar > 10 min.

## Recuperación

- Worker caído: al reiniciar, reprocesa el outbox pendiente; la idempotencia
  evita duplicados.
- Base de datos caída: la API responde 503 sin perder eventos aceptados
  (el webhook debe reintentarse desde el emisor; documentarlo en el contrato
  del canal).
- Despliegue fallido: volver a la versión anterior (el hosting candidato,
  Vercel, lo permite por despliegue); nunca «arreglar en producción» sin
  pasar por rama y revisión.
- Pérdida de datos: restaurar desde el backup del proveedor (procedimiento
  a verificar al crear el proyecto; NOT_VERIFIED en Gate 0).

## Despliegue demo (Render + Neon, plan gratis) — D14

- Blueprint: `render.yaml` en la raíz del repo (servicio web Node, plan
  gratis). Comandos: build `cd app && npm install && npm run build`,
  start `cd app && npm start`, health check `/health`.
- Variables en el dashboard de Render (nunca en el repo): `HOST=0.0.0.0`
  (Render inyecta `PORT` solo), `JWT_SECRET` con `generateValue: true`,
  `DATABASE_URL` de Neon con `sync: false`, `NODE_VERSION=24.22.1`
  (versión por defecto de Render según su documentación oficial).
- Pasos manuales pendientes (requieren cuentas, no automatizables acá):
  1. subir la rama a un repo remoto (GitHub/GitLab/Bitbucket),
  2. crear el proyecto Neon gratis y pegar su `DATABASE_URL`,
  3. crear el servicio en Render desde el blueprint,
  4. sembrar la demo una vez desde la Shell de Render
     (`cd app && npm run seed`, con las variables del servicio),
  5. verificar `/health`, login demo y `/api/stats` en la URL pública.
- Límites del plan gratis a tener en cuenta: el servicio duerme a los
  15 min sin tráfico (~1 min en despertar) y el disco es efímero; por
  eso los datos viven en Neon y no en SQLite. La demo usa solo datos
  ficticios; no es un entorno de producción para clientes reales.
- Postgres real (Neon) NO verificado todavía: los tests cubren el camino
  Postgres contra pg-mem; la primera verificación real es el paso 5.

## Costes (a medir desde Fase 1)

- Infraestructura (hosting + base de datos) y consumo de modelos por
  ejecución. Sin claves de IA en Gate 0, el coste de modelos es 0 en MVP
  (reglas + stub). Todo gasto nuevo requiere autorización previa.
