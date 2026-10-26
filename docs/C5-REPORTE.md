# C5 — Aprobaciones con expiración e invalidación — REPORTE

Fecha: 26-oct-2026. Paso C5 del plan de `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`
(Fase C/D, D15). Aprobado por Tomás el 26-oct-2026 («okey podes
continuar», sobre el cierre de C4), con la regla de explicar cada C
terminado de forma sencilla y clara. Sin push ni merge (requieren
aprobación por separado).

## Estado general

PASS. Un borrador viejo o desincronizado ya no se puede aprobar: el
servidor lo rechaza con un motivo claro, y la pantalla lo marca antes
de intentar. Rechazarlo sigue permitido y es el camino para descartarlo
y generar uno nuevo.

## Objetivo

Criterio de aceptación P-C5: un borrador viejo o desincronizado no se
puede aprobar. Cumplido: expiración a los 7 días, invalidación si el
mensaje cambió, API, UI, tests y smoke con servidor real.

## Acciones

1. **Foto del mensaje (`source_message` en `drafts`):** cada borrador
   nuevo guarda el mensaje de la oportunidad con el que se generó. Sin
   esa foto no se podría saber si el contenido cambió después.
2. **Catálogo en arranque (`ensureDraftSnapshots`, en `initSchema`):**
   migración portable para bases pre-C5 (probar la columna y ALTER solo
   si falta, como en C4) y backfill en JS: cada borrador sin foto
   recibe el mensaje actual de su oportunidad.
3. **Engine sin cambios de pasos:** al crear el borrador se guarda
   `source_message` con el mensaje vigente de la oportunidad. Los pasos
   (normalize, dedup, classify, upsert, next_action, draft) no se
   tocaron.
4. **API:** al aprobar, el servidor verifica en orden: existe (404), no
   decidido (409), no vencido (409 `draft_expired`: más de 7 días desde
   su creación) y no desactualizado (409 `draft_stale`: el mensaje
   actual difiere de la foto). `GET /api/drafts` devuelve además
   `expired` y `stale` por borrador, calculados en el servidor.
   Rechazar no pasa por estos controles: descartar un borrador vencido
   o desactualizado es la forma de limpiarlo.
5. **UI:** en la lista de pendientes, un borrador vencido muestra
   «Vencido» y uno desactualizado «Desactualizado», con el motivo en
   texto y el botón Aprobar deshabilitado. Rechazar sigue habilitado.
   Sin CSS nuevo.
6. **Docs:** este informe, BACKLOG (P-C5 PASS), nota C5 en
   `WORKFLOWS.md`, glosario (Aprobación) y README.

## Archivos

- `app/src/db.ts`: columna `source_message`, `ensureDraftSnapshots`
  (migración y backfill).
- `app/src/engine.ts`: `DraftRow.source_message`; el borrador nuevo
  guarda la foto.
- `app/src/routes.ts`: controles en `decideDraft` (solo aprobar),
  `expired`/`stale` en `GET /api/drafts`.
- `app/public/app.js`: marcas «Vencido»/«Desactualizado», motivo y
  Aprobar deshabilitado en pendientes.
- Tests: `app/src/server.test.ts`, `app/src/system.test.ts`,
  `app/src/postgres.test.ts` (5 nuevos C5).
- Docs: `docs/C5-REPORTE.md`, `BACKLOG.md`, `docs/WORKFLOWS.md`,
  `docs/GLOSARIO-PENSIA.md`, `README.md`.

## Pruebas

Build limpio (`tsc`) y **49/49 tests en verde** (5 nuevos C5):

- Vencido: borrador con 8 días no se aprueba (409 `draft_expired`),
  la oportunidad queda en `proposal_draft` y el borrador sigue
  pendiente; `GET /api/drafts` lo marca `expired: true`.
- Desactualizado: mensaje cambiado tras la creación no se aprueba
  (409 `draft_stale`); `GET /api/drafts` lo marca `stale: true`.
- Rechazo: un borrador vencido sí se puede rechazar (200, oportunidad
  vuelve a `new`).
- UI: `/app.js` sirve «Vencido» y «Desactualizado».
- Postgres (pg-mem): borrador vencido no se aprueba (409).

Smoke con servidor real (puerto 3219) sobre una COPIA de la base local
pre-C5 (y pre-C4; la base real no se tocó): antes, `drafts` no tenía
`source_message` y las tareas decían «Fundador»; tras arrancar, la
columna existe, ningún borrador quedó sin foto, las tareas muestran
«Seguimiento» y los 3 pendientes salen `expired: false, stale: false`.
Luego: aprobar el borrador envejecido → 409 `draft_expired`; aprobar
el de mensaje cambiado → 409 `draft_stale`; aprobar el fresco → 200;
rechazar el vencido → 200. Servidor matado por PID y temporales
eliminados al final.

## Evidencia

- Tests: 49/49 (antes 44/44). Build: limpio.
- Smoke: los 4 caminos (vencido, desactualizado, fresco, rechazo)
  verificados en vivo contra la copia pre-C5 (ver Pruebas).
- Ningún paso del pipeline cambió; ninguna capacidad ficticia agregada.

## Decisiones

- **Control perezoso, sin trabajo en segundo plano:** el vencimiento se
  verifica al aprobar, no con un proceso que marque borradores. No hay
  estado nuevo («vencido» no es un estado en la base): es una marca
  calculada desde `created_at`, así no hizo falta tocar el CHECK de
  estados.
- **Rechazar sigue permitido:** bloquear también el rechazo dejaría
  borradores imposibles de limpiar. El camino de recupero es rechazar
  y que un intake nuevo genere un borrador fresco con el mensaje
  actual.
- **El borrador desactualizado no se regenera solo:** `ensureTaskAndDraft`
  reutiliza el pendiente existente. Cambiar eso excede C5; queda
  documentado como comportamiento vigente.
- **409 para los dos bloqueos:** coherente con el 409 existente de
  «ya fue decidido»; el `error` distingue el motivo (`draft_expired`,
  `draft_stale`) y el mensaje lo explica en español.

## Riesgos

- **Backfill con supuesto:** para borradores pre-C5 se asume que el
  mensaje actual es el original. En la demo vale (el seed no tuvo
  intakes duplicados), pero un borrador viejo ya desincronizado antes
  de C5 no quedaría marcado como desactualizado. En la demo pública
  los 2 pendientes son del seed, sin duplicados posteriores.
- **La vía ALTER en Postgres real no se ejerció** (igual que en C4):
  pg-mem cubre DDL y flujo; la migración ALTER solo se ejerció en
  SQLite. En la verificación post-despliegue hay que confirmar que
  los pendientes de la demo sigan aprobables (no vencidos ni
  desactualizados) y que la lista muestre sus marcas correctamente.
- **Reloj del servidor:** el vencimiento usa la fecha del servidor;
  si el reloj estuviera muy desviado, el cálculo se desvía igual. No
  es un riesgo práctico en Render.

## Próximo paso

C6 (Policy/Tool Registry mínimo + reintento con tope y solo admin)
cuando Tomás lo decida; o subir C5 a la rama `ui-fase1-foundations`
(sin mergear).

## Autorización requerida

Subir a la rama y mergear a `main` requieren aprobación por separado.
Sin despliegue a producción.
