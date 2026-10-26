# C6 — Policy/Tool Registry mínimo + reintento con tope y solo admin

- **Fecha:** 2026-10-26
- **Rama:** `ui-fase1-foundations` (local, sin subir ni mergear)
- **Alcance:** P-C6 (depende de P-C5). Criterio de aceptación: tests de permisos en verde.

## Estado general

PASS. El reintento ya no es una acción libre de cualquier miembro: lo rige
un registry de políticas con valores en base de datos, con tope por
ejecución original y solo admin. Las herramientas del sistema quedan
expuestas como lo que realmente son (los pasos del pipeline), sin inventar
herramientas externas que no existen.

## Qué se hizo, en palabras simples

1. **Registry de políticas.** Nueva tabla `policies` (global, no por org)
   con 4 reglas sembradas en arranque: reintentar solo lo hace un admin,
   máximo 3 reintentos por ejecución original, aprobar/rechazar solo lo
   hace un admin, y un borrador vence a los 7 días. Endpoint
   `GET /api/policies` (con auth) las lista.
2. **Las políticas mandan de verdad.** El reintento y el vencimiento de
   borradores leen sus valores de la tabla, no de constantes en el código:
   cambiar una fila cambia el comportamiento (probado: con `max_attempts`
   en 1, el segundo reintento se bloquea; con `expiry_days` en 1, un
   borrador de 2 días no aprueba). La regla de admin para aprobar/rechazar
   sigue impuesta por el pre-handler `requireAdmin` (anterior al registry);
   su fila en la tabla la documenta en el mismo lugar.
3. **Reintento con tope y vínculo.** La tabla `executions` suma
   `retry_of` (la ejecución original; migración portable probar-columna →
   ALTER, sin backfill: los reintentos pre-C6 no se cuentan, porque su
   vínculo solo vivía en la auditoría y reconstruirlo desde JSON sería
   frágil). El tope cuenta por ejecución original (raíz de la cadena):
   reintentar un reintento no reinicia el contador. Superado el tope, el
   servidor responde 409 `retry_limit`. Un member que intenta reintentar
   recibe 403.
4. **Registry de herramientas.** No hay herramientas externas: el sistema
   no llama a ningún servicio ni envía nada. Las herramientas reales son
   los 6 pasos del pipeline, cada uno de un agente. `GET /api/tools`
   (con auth) los deriva del catálogo de agentes de C4, para no duplicar
   el mapeo en otra tabla.
5. **UI.** El botón Reintentar solo aparece para admins (antes, cualquier
   miembro lo veía y el servidor lo dejaba pasar). El diálogo de
   confirmación aclara la regla.
6. **Corrección de C4, encontrada por C6.** Al derivar las herramientas
   apareció que el paso `upsert` no tenía agente asignado (C4 mapeó 5 de
   los 6 pasos). Se asigna a Captación (normaliza, deduplica y persiste la
   oportunidad entrante) y el catálogo ahora se sincroniza en cada
   arranque, para que la corrección llegue también a bases creadas antes
   de C6. El test de C4 se actualizó en consecuencia (no se reescribió la
   historia: este informe registra el cambio).

## Archivos

- `app/src/db.ts`: tabla `policies` + `ensurePolicyCatalog` (siembra y
  migración de `retry_of`); catálogo de agentes sincronizado en arranque
  y `upsert` asignado a Captación.
- `app/src/engine.ts`: `IntakeOptions.retryOf`; el INSERT de ejecuciones
  guarda `retry_of`.
- `app/src/routes.ts`: `GET /api/policies`, `GET /api/tools`; reintento
  con control de admin por política, resolución de raíz y tope; vencimiento
  de borradores leído del registry (el mensaje de vencido incluye los días
  vigentes).
- `app/public/app.js`: botón Reintentar solo para admin; nota en el
  diálogo de confirmación. Sin CSS nuevo.
- `app/src/server.test.ts`, `app/src/system.test.ts`,
  `app/src/postgres.test.ts`: 8 tests nuevos C6 (+1 corrección de test C4).
- `docs/C6-REPORTE.md` (este informe), `BACKLOG.md` (P-C6 PASS),
  `docs/WORKFLOWS.md` (nota de reintento), `docs/GLOSARIO-PENSIA.md`
  (Política, Herramienta), `README.md` (última actualización C6).

## Pruebas

- Build/typecheck limpios (`tsc`).
- **57/57 tests en verde** (8 nuevos C6: políticas + auth, herramientas
  con dueño, nota en app.js, member 403, tope 3 con vínculo, tope leído
  del registry, vencimiento leído del registry, y el camino Postgres/pg-mem
  con políticas, herramientas y `retry_of`).
- Smoke con servidor real (puerto 3220) sobre COPIA de la base local
  pre-C6 (también pre-C4/C5; la base real no se tocó): políticas 4,
  herramientas 6 (upsert → intake, confirmando la sincronización),
  tareas «Seguimiento» (backfill C4 intacto), 3 borradores pendientes con
  flags en falso (C5 intacto), reintentos 1–3 → 200, cuarto → 409, 3
  ejecuciones vinculadas, reintento como member → 403. Temporales
  eliminados al final.

## Decisiones

- **Tope por raíz, no por ejecución suelta.** Si reintentar un reintento
  reiniciara el contador, el tope sería papel mojado. La cadena se
  resuelve caminando `retry_of` hasta la raíz (pocos saltos: el tope es 3).
- **Políticas globales, no por org.** Son reglas del producto, no
  configuración de cliente. C8 podrá revisarlo si la plantilla lo pide.
- **Herramientas derivadas, no otra tabla.** Duplicar el mapeo
  agente→pasos en una tabla `tools` crearía dos fuentes de verdad; el
  endpoint deriva de la única que existe (C4).
- **Sin backfill de `retry_of`.** Los reintentos pre-C6 quedan fuera del
  conteo. Es una limitación honesta y acotada: en la demo no hubo
  reintentos reales (solo la verificación de Fase 5, que no reintentó
  nada porque no había ejecuciones fallidas).

## Riesgos y límites

- La vía ALTER de `retry_of` en Postgres real sigue sin ejercerse (solo
  SQLite y pg-mem); en la verificación post-despliegue conviene confirmar
  que `/api/policies` y `/api/tools` responden en la demo pública.
- Cambiar una política en base de datos cambia el comportamiento sin
  despliegue: es el diseño buscado, pero hoy no hay endpoint para
  modificarlas (solo lectura). Nadie puede cambiarlas desde la UI.
- El diálogo de reintento no muestra el número del tope (lo dice la
  política, no la UI): si el tope cambia, la UI no miente, pero tampoco
  informa el número exacto.

## Próximo paso

Esperar la decisión de Tomás: subir C6 a la rama y/o mergear a `main`
(con su verificación visual), o seguir con C7 (worker asíncrono +
endurecimiento).
