# F1-CI — CI básica — Informe

## Estado general

IN_PROGRESS. Workflow creado y verificado en local. Pasa a PASS cuando
corra en verde en GitHub, lo que solo puede ocurrir después de subirlo y
mergearlo (la primera corrida real es el propio PR o el push a main).

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

Subir a `ui-fase1-foundations`, crear el PR y mergear a `main` (con
autorización de Tomás), y confirmar la primera corrida en verde en la
pestaña Actions del repositorio. Con eso, F1-CI pasa a PASS y la
Fase 1 queda completa.

## Autorización requerida

Subir el workflow a la rama, crear el PR y mergear a `main`.
