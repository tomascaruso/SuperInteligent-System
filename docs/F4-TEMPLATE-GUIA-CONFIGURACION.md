# F4-TEMPLATE — Guía de configuración por cliente

## Estado general

IN_PROGRESS. Primera entrega de F4-TEMPLATE (BACKLOG, Alta, PLANNED →
IN_PROGRESS): cómo adaptar la plantilla SuperInteligent System a un
cliente nuevo sin bifurcar el núcleo. Segunda entrega: el vertical de
ejemplo Inmobiliaria
(`docs/F4-TEMPLATE-VERTICAL-INMOBILIARIA.md`).

## Qué es la plantilla

Un monolito modular (TypeScript + Fastify + PostgreSQL/SQLite) que ya
resuelve el flujo completo: entra un contacto → se normaliza, se
revisa si ya existe, se clasifica por reglas, se registra la
oportunidad, se crea la tarea con vencimiento y se redacta el borrador
→ una persona aprueba o rechaza antes de que pase nada. El sistema no
envía mensajes solo. Encima del flujo: organizaciones multi-tenant,
usuarios con roles (admin/member), alta manual, webhook HMAC con
idempotencia, auditoría, ejecuciones con reintento, jobs asíncronos,
registry de políticas y herramientas, 5 agentes deterministas, UI web
con 6 vistas y recorrido guiado, formulario de contacto por relay y
CI básica.

## Qué se configura sin tocar código

| Qué | Dónde se carga | Para qué |
|---|---|---|
| `HOST`, `PORT` | Entorno del despliegue | Dónde escucha el servidor |
| `DATABASE_URL` | Entorno (secreto, nunca en chat) | PostgreSQL en producción (Neon) |
| `DATABASE_PATH` | Entorno (solo local) | SQLite en desarrollo |
| `JWT_SECRET` | Entorno (secreto; en producción lo genera el hosting) | Sesiones |
| `OPERATOR_TOKEN` | Entorno (secreto, solo lo conoce PENSIA) | Crear invitaciones por API |
| `MAX_OPPORTUNITIES_PER_DAY` | Entorno | Límite diario de oportunidades por org |
| `CONTACT_RELAY_URL`, `CONTACT_RELAY_TOKEN` | Entorno (el token también en Propiedades del script) | Formulario «Quiero una demo» por relay HTTPS (ver `docs/CONTACTO-RELAY-REPORTE.md`) |
| Organización del cliente | `POST /api/invitations` (con `OPERATOR_TOKEN`) + canje `POST /api/auth/accept-invitation` | Un cliente = una org por `org_id`; el registro público está eliminado |
| Datos de ejemplo | `app/src/seed.ts` (o un seed propio por vertical) | Poblar la demo del cliente con datos ficticios |

Regla de secretos: ningún secreto se pega en el chat, ningún secreto
vive en el repo. `render.yaml` declara las variables con `sync: false`
(sin valores); los valores los carga el operador en el hosting.

## Puntos de adaptación por cliente (la lista completa)

Todo lo demás es contenido de negocio del vertical, y vive en pocos
lugares señalados. Adaptar un cliente = recorrer esta lista y nada más:

1. **`app/src/domain.ts` — reglas de negocio (el punto principal).**
   - `Category`: las categorías del vertical (siempre con `general`
     como fallback cuando ningún tema coincide).
   - `CATEGORY_RULES`: los patrones por categoría, EN ORDEN (gana el
     primero que coincide; por eso el tema más específico va antes
     que el más general).
   - `URGENT` y `BUDGET`: las señales de urgencia y presupuesto del
     vertical (las palabras cambian por rubro).
   - `classifyOpportunity`: los títulos de tarea por prioridad y sus
     plazos (hoy: 24/48/72 h). La mecánica de puntaje no cambia:
     urgencia +2, presupuesto +1, empresa +1, dominio no gratuito +1,
     categoría distinta de `general` +1; alta ≥ 4, media ≥ 2, resto
     baja.
   - `draftBody`: el texto del borrador (misma estructura: saludo,
     tema, siguiente paso propuesto, cierre para agendar llamada).
2. **`app/src/db.ts` — catálogo de agentes (solo si el vertical lo
   pide).** `KNOWN_AGENTS` trae nombre, descripción y pasos de los 5
   agentes. En la mayoría de los verticales no se toca: los roles
   (recibir, clasificar, redactar, seguimiento, revisar) son los
   mismos; cambia lo que dicen, no lo que hacen.
3. **`app/src/seed.ts` — datos de ejemplo del vertical.** Muestras
   ficticias que recorren el flujo real por `runIntake` (no inserts
   a mano: así el ejemplo prueba el motor). Nunca sembrar clientes
   en la demo pública: cada cliente tiene su propio despliegue y su
   propio seed.
4. **Textos de la UI (solo si el vertical cambia la historia).**
   - `app/public/app.js`: `categoryLabel` (hoy solo traduce
     `general` → «Consulta general»; las categorías nuevas, al ser
     palabras de negocio, se muestran tal cual), `stepLabel`,
     `agentBusinessDescription`, pasos del recorrido guiado
     (`TOUR_STEPS`).
   - `app/public/index.html`: el bloque «Qué hace» de la pantalla de
     acceso (problema, público, 3 pasos).
5. **Infraestructura (no cambia por cliente).** `render.yaml`,
   `.github/workflows/ci.yml` y la CI se reutilizan tal cual.

## Qué NUNCA se toca (el núcleo)

- `app/src/engine.ts`: la mecánica del intake, los pasos, la
  idempotencia, el reintento y la auditoría del flujo.
- `app/src/routes.ts`: contratos de API, autenticación, permisos
  (solo admin aprueba/rechaza/reintenta), validación y códigos de
  error.
- `app/src/auth.ts`, `app/src/worker.ts`, registry de políticas y
  herramientas, esquema de base (`app/src/db.ts`, salvo el contenido
  del catálogo y el seed).
- `app/src/contact.ts`: la mecánica del relay (el destino y el token
  son configuración, no código).
- La regla de build: lo que `tsc` necesita no vive en
  `devDependencies` (Render instala sin dependencias de desarrollo).

Si un cambio sirve a dos clientes, va al núcleo con su test. Si sirve
a uno solo, va a su capa de contenido. Bifurcar el núcleo por cliente
está prohibido por D13: el Core no se bifurca, cada cliente se adapta
por configuración (hoy, por los puntos de la lista anterior; una
configuración de reglas por organización en base es un paso futuro,
fuera de F4-TEMPLATE).

## Checklist de puesta en marcha por cliente

1. Clonar la plantilla y crear el despliegue (Render + Neon, plan
   gratuito o el que corresponda).
2. Cargar las variables de entorno (tabla anterior). Sin
   `OPERATOR_TOKEN` no se pueden crear invitaciones; sin relay, el
   formulario de contacto queda oculto (fail-closed, a propósito).
3. Crear la invitación del cliente y canjearla (o crear su org y su
   usuario admin por el camino operado).
4. Adaptar los puntos de la lista (reglas, borrador, seed, textos).
5. Correr typecheck, build, tests y smoke (`/health` con servidor
   real) antes de cualquier merge.
6. Verificar en vivo, solo lectura salvo la prueba: salud, acceso,
   alta manual, clasificación de un mensaje de ejemplo, tarea,
   borrador, aprobación (sin envío, por diseño) y mensaje de contacto.
7. Entregar al cliente su URL, su acceso admin y su webhook (con su
   secreto, por un canal seguro, nunca en chat).

## Qué NO cubre esta guía

El proceso comercial de implementación por cliente (relevamiento,
propuesta, plazos, entrega) es F4-SERVICE, que depende de esta
plantilla. Esta guía cubre la configuración técnica, no la venta ni
la gestión del proyecto.

## Limitación honesta (a no vender como lo que no es)

Hoy la adaptación de reglas es por edición de constantes
documentadas, no por configuración en base de datos ni por panel.
Eso es suficiente para implementaciones a medida (PENSIA adapta y
despliega), pero no es «el cliente cambia sus reglas solo». Si un
cliente pide eso, es otro trabajo (reglas por organización, con su
UI y sus permisos), no esta plantilla.
