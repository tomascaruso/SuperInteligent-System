# C2 — Trazabilidad expuesta (alineación PENSIA) — REPORTE

Fecha: 26-oct-2026. Paso C2 del plan de `docs/DIAGNOSTICO-ALINEACION-PENSIA.md`
(Fase C/D, D15). Aprobado por Tomás el 26-oct-2026 («Seguí con C2»).
Sin push ni merge (requieren aprobación por separado).

## Estado general

PASS. Los pasos de ejecución, que ya se persistían en `execution_steps`
pero no se exponían, ahora se consultan por API y se ven en la UI de
Actividad. Sin cambios de reglas de negocio, sin cambios de CSS ni de
esquema de base de datos (la tabla ya existía).

## Objetivo

Criterio de aceptación C2: ver los pasos reales de una ejecución en la
demo. Cumplido: endpoint + UI + tests + smoke con servidor real.

## Acciones

1. **Backend:** nuevo endpoint `GET /api/executions/:id/steps` (auth, solo
   la org dueña; 404 para ejecución inexistente o de otra org, 401 sin
   token). Devuelve los pasos ordenados por `created_at` ascendente
   (precisión de milisegundos: el orden temporal es el orden real).
2. **Frontend:** cada ejecución en Actividad tiene botón «Ver pasos» que
   carga los pasos bajo demanda (una sola vez por ejecución; luego
   muestra/oculta), con estado de carga, estado vacío («Sin pasos
   registrados.») y error visible en la propia lista. Cada paso muestra
   nombre, etiqueta de estado (Completada/Fallida, reutilizando las de la
   Fase 5), fecha con espacio y un resumen corto cuando existe
   (categoría/prioridad de classify, duplicado sí/no de dedup, error si
   falló). Nada se inventa.
3. **Corrección de comentario:** el comentario de la Fase 5 en `app.js`
   («Sin pasos en el backend») quedó actualizado: los pasos ahora se
   exponen.
4. **Docs:** este informe + `BACKLOG.md` (P-C2 a PASS).

## Archivos

- `app/src/routes.ts`: interfaz `ExecutionStepRow` + endpoint
  `/api/executions/:id/steps`.
- `app/public/app.js`: botón «Ver pasos», carga bajo demanda y render de
  pasos (`stepSummary`, `stepItems`).
- `app/src/system.test.ts`: 2 tests C2 (pasos en orden; 404/401).
- `app/src/server.test.ts`: 1 test C2 (markers de la UI de pasos).
- `docs/C2-REPORTE.md`: este informe.
- `BACKLOG.md`: P-C2 a PASS.

Sin cambios en: `engine.ts` (los pasos ya se escribían), `db.ts` (sin
migración), CSS, ni contratos existentes.

## Pruebas

- Build TypeScript limpio (`npm run build`, sin errores).
- Typecheck limpio (`tsc --noEmit`).
- Tests: **34/34 en verde** (31 previos + 3 nuevos C2), 3 archivos.
- Smoke con servidor real (puerto 3216, COPIA de la base demo en /tmp,
  base real intacta, temporales eliminados): `/health` OK, login demo OK,
  primera ejecución con sus 6 pasos en orden y todos `done`
  (normalize, dedup, classify, upsert, next_action, draft), endpoint sin
  token → 401, `/app.js` sirve «Ver pasos».

## Evidencia

- Endpoint: `GET /api/executions/:id/steps` → `{ executionId, steps[] }`
  con `step`, `status`, `output_json`, `error`, `created_at` por paso.
- UI: botón «Ver pasos» por ejecución en la vista Actividad; la
  verificación visual en navegador real queda pendiente del próximo
  despliegue aprobado (igual que en las fases de UI anteriores).
- No se creó ni modificó ningún dato de la demo: el smoke usó una copia.

## Decisiones

- Endpoint dedicado en vez de incluir los pasos en
  `GET /api/executions`: no cambia el contrato existente ni el peso de la
  lista; los pasos se piden solo cuando el operador los quiere ver.
- Orden por `created_at` (milisegundos) sin columna de secuencia nueva:
  evita una migración; el orden de inserción y el temporal coinciden en
  la práctica del intake síncrono.
- Resumen corto por paso en vez de volcar el JSON crudo: legible para el
  operador sin perder el dato (el endpoint devuelve el `output_json`
  completo).

## Riesgos

- Pasos con el mismo milisegundo en ejecuciones futuras concurrentes
  podrían ordenarse de forma ambigua: hoy el intake es síncrono y
  secuencial, así que no afecta; si C7 trae worker concurrente, conviene
  agregar una columna de secuencia.
- La UI de pasos no está verificada todavía en navegador real: queda para
  el despliegue aprobado, como en las fases anteriores.

## Próximo paso

C3 (proceso como entidad + Workflow Registry mínimo) cuando Tomás lo
apruebe, o subida de C2 a la rama `ui-fase1-foundations` sin mergear.

## Autorización requerida

- Push a la rama y merge a `main`: NO autorizados todavía (pedir por
  separado).
- Despliegue: lo dispara Render solo al cambiar `main`; no hay despliegue
  con este commit local.
