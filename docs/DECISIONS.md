# DECISIONS — Registro de decisiones arquitectónicas

Formato: decisión, contexto, alternativa descartada, motivo, estado.
Estado `propuesta` = requiere confirmación humana; `adoptada` = confirmada.

## D1 — Monolito modular, no microservicios (propuesta)

Un solo despliegue, módulos con límites y contratos internos. Alternativa
(microservicios) descartada: coste operativo y complejidad injustificados
para un MVP de un equipo pequeño; se extrae un módulo solo con evidencia
de necesidad.

## D2 — TypeScript + Node.js 24 (propuesta)

Ecosistema amplio, tipado para contratos y validación, runtime disponible
y verificado en la VM (v24.22.1). Alternativa (Python/FastAPI) descartada
por ahora: el equipo operativo actual trabaja en JS/TS (Vercel, Apps
Script) y la contratación de talento TS es amplia; se revisa si el
componente de IA exige librerías exclusivas de Python.

## D3 — Fastify como framework de API (propuesta)

Validación por esquemas y buen rendimiento con poca ceremonia.
Alternativa (Express) descartada por validación más débil de serie;
alternativa (NestJS) descartada por peso inicial. Se confirma en Fase 1.

## D4 — PostgreSQL vía Supabase (propuesta, acceso NO verificado)

RLS, Auth y backups gestionados, coherente con el aislamiento
multiempresa. Alternativas: Postgres local en la VM (sin `docker`
disponible; viable solo para desarrollo) o un VPS con Postgres
autogestionado (más operación). Si no se consigue acceso a Supabase,
Fase 1 arranca con Postgres local y la migración queda registrada.

## D5 — Reglas explícitas antes que IA (adoptada para el MVP)

La clasificación y los borradores del MVP son deterministas (reglas y
plantillas). La IA entra en Fase 2 solo si la evaluación demuestra
mejora medible. Motivo: coste 0, comportamiento predecible, auditoría
simple y ninguna clave externa necesaria para demostrar el flujo.

## D6 — Outbox en Postgres, sin cola externa en MVP (propuesta)

Suficiente para el volumen del piloto; una cola dedicada (SQS, BullMQ
con Redis) se evalúa con evidencia de volumen o latencia, no por
anticipación.

## D7 — Vercel como hosting candidato (propuesta, sin despliegue)

La cuenta «negociodigital» ya está conectada para otros proyectos y
cubre web + API. No se desplegó nada de este proyecto en Gate 0; el
despliegue requiere autorización explícita y se decide en Fase 1.

## D8 — Un solo canal de entrada + alta manual en MVP (adoptada)

Limita el alcance a lo demostrable. Canales adicionales (correo, WhatsApp)
son Fase 3 y solo con aprobación y pruebas propias.

## D9 — Proyecto separado de Oficio Digital IA y de la línea de
## automatizaciones (adoptada)

Decisión del usuario: SuperInteligent System es una empresa de software
independiente. No reutiliza marca, cuentas ni clientes de los otros
proyectos salvo decisión explícita futura.

## D10 — Segmento prioritario: agencias de marketing y consultoras B2B
## pequeñas/medianas (adoptada)

Decisión del usuario como responsable de producto. Motivo: proceso
comercial delimitable (consulta, calificación, reunión, propuesta,
seguimiento, cierre). Alternativa descartada por ahora: atender en
simultáneo inmobiliarias, clínicas, estudios jurídicos e industriales;
cada sector tiene procesos, integraciones y riesgos distintos. El núcleo
se reutiliza en otros sectores solo después de validar un segmento.
Persona completa en `docs/BUYER_PERSONA.md` (hipótesis, no validada).

## D11 — Posicionamiento: coordinar, no reemplazar (adoptada)

SuperInteligent no compite por ser «otro CRM» ni «ChatGPT + algunas
automatizaciones»: coordina tareas y flujos entre las herramientas que el
cliente ya usa, con proceso persistente, auditable y recuperable, y
aprobación humana antes de acciones externas. Esto responde a las 4
objeciones del buyer persona y condiciona el MVP: un solo flujo, una
integración prioritaria y piloto con objetivos medibles.

## D12 — Propósito: portafolio real, no SaaS validado con entrevistas
## (adoptada, 25-oct-2026)

Decisión del usuario: NO habrá entrevistas. SuperInteligent se construye
como un sistema real y profesional para el portafolio de Tomás, para
vender sus servicios. Consecuencias: E1 y los pilotos con agencias reales
quedan cancelados; la persona Martín pasa a ser el escenario ficticio de
la demo (datos de ejemplo); el sistema debe funcionar de verdad (no una
maqueta) y demostrar el flujo completo; no hay venta del SaaS, precio de
producto ni métricas de mercado en esta fase. G0-D2 queda sin efecto.

## D13 — Modelo comercial: implementaciones a medida sobre plantilla
## reutilizable (adoptada, 25-oct-2026)

Decisión del usuario: vende su servicio de SuperInteligent System a
empresas que quieren su propio sistema de automatización inteligente
(orquestador + agentes para su negocio en particular). Por eso el producto
debe ser una plantilla reutilizable para futuros trabajos, no un proyecto
único ni un SaaS con licencia. Consecuencias: el Core es la plantilla y
no se bifurca por cliente; cada cliente se adapta por configuración
(workflows, agentes, herramientas, políticas, integraciones); la primera
app (Business Operations Orchestrator) es la implementación de referencia
y la vidriera; el modelo de despliegue por cliente (multi-tenant vs
instancia dedicada) queda como decisión técnica pendiente de Fase 1 (el
MVP usa multi-tenant por diseño).

## D14 — Persistencia local con SQLite; PostgreSQL queda para producción
## (adoptada, 25-oct-2026)

Decisión técnica reversible: sin acceso verificado a Supabase ni Docker
en la VM, el MVP persiste en SQLite local (node:sqlite, sin servicios
externos, archivo en `./data/`, ignorado por git). El acceso a datos pasa
por funciones concentradas (`db.ts`) y el esquema está diseñado para
migrarse a PostgreSQL; el adaptador Postgres/Supabase (con RLS) queda
pendiente de G0-D3. Los secretos de desarrollo (JWT_SECRET por defecto,
cuenta demo) son solo locales y deben reemplazarse antes de exponer el
sistema.

Actualización D14 (rama `d14-postgres`, 25-oct-2026, IMPLEMENTADO): la
app ya corre con Postgres cuando `DATABASE_URL` está definida y sigue
con SQLite local si no lo está. Interfaz asíncrona pequeña en `db.ts`
(`queryOne`/`queryAll`/`exec`, `Database`) con dos implementaciones:
SQLite (node:sqlite envuelto en async) y Postgres (paquete `pg`, con
traducción de placeholders `?` a `$1..$n`). El DDL es compartido y
válido en ambos motores; lo único exclusivo de SQLite que se eliminó
fue `PRAGMA foreign_keys` (Postgres lo impone por defecto) y
`date(created_at) = date('now')`, reemplazado por comparación del
prefijo ISO `substr(created_at, 1, 10)` con la fecha UTC del día
(`COUNT(*)` vuelve como texto en Postgres: coerción explícita a número
en engine y stats). Sin cambios de reglas de negocio, clasificación,
dedup, idempotencia ni auditoría. Tests: 17 en verde (los 15 del MVP +
2 del camino Postgres contra pg-mem; pg-mem no implementa `substr` y se
registra en el test como la define Postgres real). NO verificado contra
un Postgres real (sin cuenta Neon todavía): el despliegue Render + Neon
queda como paso siguiente, con `render.yaml` ya creado. Node fijado en
24 (`.node-version` 24.22.1, `engines >= 24`): Render usa Node 24.22.1
por defecto según su documentación oficial, así que no hay bloqueo de
versión.

## Decisiones pendientes de humanos (bloquean el cierre de Gate 0)

- **G0-D1:** confirmar o cambiar el stack (D1–D4, D6–D7).
- **G0-D2:** CANCELADA el 25-oct-2026 (no habrá entrevistas ni pilotos
  con agencias reales; ver D12).
- **G0-D3:** decidir dónde vive el repositorio remoto y crear
  proyecto/cuentas (Supabase, proveedor de IA en Fase 2) con sus claves.
