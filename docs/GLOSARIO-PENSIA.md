# GLOSARIO — PENSIA / SuperInteligent System

Términos oficiales según la Directiva de Alineación Estratégica
(26-oct-2026). Si el código todavía no implementa un término, se indica.

## PENSIA

Empresa responsable de la estrategia, el desarrollo, la implementación y la
operación del servicio. No es un producto ni un módulo: es la organización
que vende y opera SuperInteligent System para empresas clientes.

## SuperInteligent System

Servicio de automatización inteligente que PENSIA diseña e implementa para
empresas, con foco en resolver problemas comerciales y operativos concretos.
No es un CRM con funciones de IA agregadas: es un sistema de coordinación y
ejecución de procesos empresariales mediante agentes especializados.

## SuperInteligent Core

Núcleo reutilizable del sistema (eventos, workflows, estado persistido,
aprobaciones, auditoría). No se bifurca por cliente: cada cliente se adapta
por configuración (D13).

## Business Operations Orchestrator

Primera aplicación e implementación de referencia de la plantilla, para
agencias y consultoras B2B. Su flujo actual (oportunidad → tareas →
borradores → aprobación → registro auditable) es la primera demostración
funcional del sistema, no la identidad del producto.

## Orquestador

Componente responsable de coordinar procesos, delegar tareas, administrar
estados, supervisar resultados y aplicar políticas de ejecución, mediante
interfaces y contratos explícitos. Estado actual: NO existe como entidad;
hoy esa coordinación es la secuencia fija de `runIntake` en `engine.ts`.

## Agente especializado

Ejecuta tareas específicas dentro de los permisos y responsabilidades que se
le asignen. Su composición depende del problema, el proceso y las
necesidades de cada organización: no es una lista fija e idéntica para todos
los clientes. Estado actual (C4, 26-oct-2026): los 5 agentes ya son
entidades (tabla `agents`, registry en `GET /api/agents`) y cada tarea
lleva su `agent_id`; el mapeo paso→agente vive en `steps_json`. Siguen
siendo deterministas, sin IA ni autonomía agregada.

## Proceso / Workflow

Flujo de trabajo versionado que el orquestador ejecuta (ej.:
`opportunity.intake` v1). Estado actual (C3, 26-oct-2026): existe un
Registry (`workflows`) con el único workflow real y sus pasos, y cada
ejecución pertenece a una corrida de proceso (`process_runs`, 1:1 con la
ejecución en este flujo, consultable por `GET /api/processes`). Las
ejecuciones anteriores a C3 recibieron su corrida por backfill en
arranque. Todavía no hay orquestador que elija o reasigne procesos: la
corrida envuelve al intake existente sin cambiar sus pasos.

## Empresa cliente

Organización cuyos procesos reales son asistidos o automatizados mediante el
sistema configurado para sus necesidades. En el MVP, cada cliente se modela
como una organización (`org_id`) con aislamiento de datos; el modelo de
despliegue por cliente (multi-tenant vs. instancia dedicada, F1-TENANT)
sigue sin decidir.

## Aprobación

Autorización humana vinculada a una acción y a un contenido concretos. Sin
aprobación no hay acción externa. Reglas vigentes en código: solo admin
aprueba/rechaza; un borrador decidido no se puede volver a decidir (409);
aprobar NO envía ningún mensaje (solo cambia el estado de la oportunidad).
Desde C5 (26-oct-2026): un borrador vence a los 7 días y se invalida si
el mensaje cambió desde que se generó (409 `draft_expired`/`draft_stale`
al aprobar); rechazarlo sigue permitido. Sigue vigente: un intake
duplicado actualiza el mensaje sin regenerar el borrador pendiente (por
eso existe la invalidación).

## Ejecución

Corrida registrada de un workflow, con pasos persistidos, resultado o error,
y trazabilidad en auditoría. Estados reales: `done` / `failed` (más
`running` transitorio durante la request). Los pasos se guardan en
`execution_steps` pero todavía no se exponen por API ni UI.
