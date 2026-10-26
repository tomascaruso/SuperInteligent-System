# F1-CI — CI básica — Informe

## Estado general

PASS. Primera corrida en verde en GitHub tras el merge del PR #14.

## Verificación en GitHub (26-oct-2026)

- Corrida #4 del workflow CI: https://github.com/tomascaruso/SuperInteligent-System/actions/runs/40381795305
- Disparo: push a `main` por el merge del PR #14 (commit 4abe88e).
- Estado final: Success, duración total 24 s.
- Trabajo «Tipos, build, tests y smoke»: succeeded (20 s), todos los
  pasos en verde, incluidos Tests y Smoke /health con servidor real.
- Trabajo «Build como en producción (sin devDependencies)»: succeeded
  (15 s).
- Anotaciones no bloqueantes (2 warnings y 2 notices): deprecación de
  Node.js 20 en las acciones usadas y aviso de migración de la etiqueta
  `ubuntu-latest` a Ubuntu 26. No impiden el verde; quedan como limpieza
  futura (actualizar las acciones a sus versiones mayores nuevas cuando
  corresponda), sin urgencia.

## Objetivo

Que cada cambio en el repositorio pase automáticamente, antes de mergear,
por las mismas verificaciones que hoy se corren a mano: tipos, build,
tests y arranque del servidor. Criterio del BACKLOG: «PR en verde antes
de merge».

## Acciones

1. Creado `.github/workflows/ci.yml` con dos trabajos (GitHub Actions,
   sin costo en repositorios públicos):
   - `ci` (Tipos, build, tests y smoke): corre en push a `main` y a
     `ui-fase1-foundations` y en cada pull request. Pasos: `npm ci`,
     `npm run typecheck`, `npm run build`, `node --check public/app.js`,
     `npm test` y smoke de `/health` con servidor real.
   - `build-prod` (Build como en producción): `npm ci --omit=dev` +
     `npm run build`. Reproduce la condición que rompió el despliegue de
     C8 en Render (instalar sin dependencias de desarrollo y compilar
     igual), para que ese fallo no vuelva a descubrirse en el despliegue.
2. Actualizado BACKLOG.md: F1-CI pasa de PLANNED a IN_PROGRESS.

## Archivos

- `.github/workflows/ci.yml` (nuevo, 2 trabajos, 12 pasos en total).
- `docs/F1-CI-REPORTE.md` (este informe).
- `BACKLOG.md` (estado F1-CI).

## Pruebas

- Sintaxis YAML del workflow: válida (2 trabajos, `ci` con 8 pasos,
  `build-prod` con 4 pasos).
- Pasos del trabajo `ci` ejecutados en local, en orden: `npm ci`,
  typecheck limpio, build limpio, `node --check public/app.js` OK,
  **72/72 tests en verde**, smoke `/health` con servidor real
  (`{"status":"ok","service":"superinteligent-system","version":"0.1.0"}`).
- Simulación del trabajo `build-prod` en carpeta limpia:
  `npm ci --omit=dev` + build OK. Verificado que no se instalan
  `vitest`, `pg-mem` ni `tsx` (solo queda un directorio `@vitest`
  vacío, artefacto de npm, sin paquetes dentro).

## Evidencia

- Workflow: `.github/workflows/ci.yml`.
- Suite completa: 72/72 tests (3 archivos), misma cifra que Fase 6.
- Smoke: `/health` responde el JSON exacto esperado.

## Decisiones

- **Sin paso de lint.** El BACKLOG decía «lint, tipos, tests», pero el
  proyecto no tiene ningún linter configurado (no hay ESLint ni regla
  de estilo). Inventar uno sería otro cambio; la CI cubre lo que el
  proyecto realmente verifica hoy: tipos, build, tests, sintaxis de
  `app.js` y arranque. Si más adelante se agrega un linter, se agrega
  su paso a este mismo workflow.
- **`app.js` se verifica aparte** porque `tsc` no lo compila; es el
  mismo chequeo que se hace a mano desde Fase 1.
- **El smoke usa base temporal** (`/tmp/ci-superinteligent.db`) para no
  tocar ningún dato del repo.
- **La CI no despliega.** Solo verifica. Render sigue desplegando
  desde `main` como hasta ahora.

## Riesgos

- La primera corrida real en GitHub solo ocurre tras subir y mergear;
  hasta entonces la verificación es local, no una corrida de Actions.
- Subir un workflow por API a veces exige un permiso extra
  («workflow»); si la subida lo rechaza, se informará y se buscará la
  vía alternativa sin cambiar el contenido.
- GitHub Actions debe estar habilitado en el repositorio (lo está por
  defecto en repositorios públicos; se confirma con la primera corrida).

## Próximo paso

Ninguno para F1-CI. La Fase 1 queda completa con este cierre. Queda
pendiente subir y mergear este propio cambio de estado (BACKLOG a PASS
y esta sección del informe), con autorización de Tomás.

## Autorización requerida

Subir el cambio de estado a la rama, crear el PR y mergear a `main`.
