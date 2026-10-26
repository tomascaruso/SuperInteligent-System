# PRD — Business Operations Orchestrator (primera aplicación)

## Usuarios (escenario de demo, no clientes reales)

**Cambio de propósito (25-oct-2026, D12–D13):** SuperInteligent ya no se
valida con agencias reales ni se vende como SaaS en esta fase. Se construye
como plantilla reutilizable que Tomás vende como servicio de implementación:
cada empresa cliente obtiene su propio sistema de automatización inteligente
(orquestador + agentes para su negocio en particular), adaptado desde la
plantilla sin bifurcar el núcleo. Los «usuarios» de abajo son el escenario
ficticio de la demo, con datos de ejemplo; la audiencia real son las empresas
que quieren su propio sistema y Tomás como implementador.

Ver el documento completo en `docs/BUYER_PERSONA.md`. Resumen:

- **Usuario del escenario (hipótesis H1): «Martín», fundador/director de
  agencia o consultora B2B (equipo orientativo 3–20 personas).** Persona
  FICTICIA basada en una hipótesis comercial; no representa una entrevista
  real. Segmento prioritario: agencias de marketing y consultoras B2B
  pequeñas o medianas (proceso delimitable: consulta, calificación, reunión,
  propuesta, seguimiento, cierre).
- **Usuarios operativos:** comerciales/SDR que capturan y hacen seguimiento.
- **Posicionamiento frente a objeciones:** no competir como «otro CRM»,
  sino coordinar tareas y flujos ENTRE las herramientas que el cliente ya
  usa; no ser «ChatGPT + automatizaciones», sino un proceso persistente,
  coordinado, auditable y recuperable, con aprobación humana antes de
  cualquier acción externa.
- **No usuarios del MVP:** otros sectores en simultáneo (inmobiliarias,
  clínicas, estudios jurídicos, industriales) — cada uno tiene procesos,
  integraciones y riesgos distintos y se aborda solo después de validar un
  segmento; tampoco equipos que necesitan telefonía, marketing automation
  o facturación integrada.

## Problema (escenario de la demo; hipótesis, no hecho verificado)

Las agencias y consultoras B2B pierden oportunidades por tres fallos
encadenados: (1) captura incompleta (un mensaje no se registra), (2) desorden
(duplicados, datos inconsistentes, sin dueño claro), (3) seguimiento tardío o
inexistente (nadie actúa a tiempo). El coste es oportunidad perdida y tiempo
administrativo. Su magnitud ya no se medirá con entrevistas (canceladas el
25-oct-2026): el sistema debe demostrar el problema y su solución con el
escenario ficticio de la demo.

## Propuesta de valor (hipótesis)

«Ninguna oportunidad sin dueño, sin siguiente acción y sin registro»: cada
oportunidad que entra queda normalizada, sin duplicados, clasificada, con una
tarea siguiente y un borrador revisable por un humano antes de cualquier
contacto externo. Diferencia buscada frente a un CRM genérico: menos
configuración, flujo guiado de principio a fin y auditoría completa de cada
decisión (humana o del sistema). A nivel de negocio, esta aplicación es la
primera implementación de referencia de la plantilla: lo que se vende a cada
empresa es su propio sistema adaptado desde ella, no una licencia del SaaS.

## Alcance del MVP

1. Interfaz autenticada básica; una organización y sus usuarios.
2. Alta manual de oportunidades + UN canal de entrada verificable (formulario
   web con webhook firmado; el canal exacto se fija en Fase 1).
3. Validación y normalización de datos.
4. Detección básica de duplicados (mismo correo/dominio + similitud de nombre).
5. Clasificación y priorización (primero reglas explícitas; IA solo si el
   experimento de evaluación demuestra mejora medible).
6. Tareas y seguimientos con fecha y responsable.
7. Borradores de respuesta/propuesta revisables.
8. Aprobación humana obligatoria antes de cualquier acción externa sensible.
9. Historial de ejecución y auditoría por oportunidad.
10. Manejo de errores, reintentos seguros e idempotencia.
11. Límites de uso y coste por organización.
12. Pruebas automatizadas de los 12 criterios de aceptación de abajo.

## Exclusiones del MVP (no se construyen ahora)

- CRM completo (campañas, telefonía, cotizador, facturación).
- Envíos autónomos reales (correo, WhatsApp, LinkedIn) sin aprobación.
- Multi-canal (solo un canal de entrada + alta manual).
- Multiempresa compleja (una org por cuenta; aislamiento sí, jerarquías no).
- Apps móviles nativas; IA generativa sin evaluación previa.

## Criterios de aceptación del MVP (todos deben probarse)

1. Una oportunidad válida puede ingresar al sistema.
2. Los datos se normalizan y persisten correctamente.
3. Los eventos duplicados no generan efectos duplicados indebidos.
4. La clasificación produce una salida validada.
5. Se crea una tarea o acción siguiente.
6. El borrador se puede revisar y aprobar.
7. Una acción no autorizada se bloquea.
8. Un fallo puede detectarse y recuperarse de forma segura.
9. Cada ejecución puede auditarse.
10. Una organización no puede acceder a los datos de otra.
11. Los límites de uso y coste se aplican.
12. El flujo puede ejecutarse en un entorno de prueba reproducible.

## Supuestos explícitos (a verificar en Fase 1)

- S1: el equipo del cliente acepta aprobar borradores antes de enviar (si no,
  el valor del producto cambia).
- S2: un solo canal de entrada + alta manual basta para el piloto.
- S3: la clasificación por reglas cubre el 80% de los casos del piloto
  (objetivo, no resultado).
- S4: el cliente piloto tiene al menos 10 oportunidades/mes para medir algo.

## Métricas del MVP (objetivos, no resultados)

Captura correcta, duplicados evitados, tiempo hasta la primera acción,
seguimientos a tiempo, % de borradores aceptados con cambios menores, coste por
ejecución, fallos y recuperaciones, intervenciones humanas necesarias.
Ver `docs/VALIDATION_PLAN.md`.
