# SuperInteligent System

Servicio de automatización inteligente de **PENSIA** (empresa responsable de
la estrategia, el desarrollo, la implementación y la operación). Jerarquía:
**PENSIA → SuperInteligent System → sistema de agentes de cada empresa
cliente.** Este repositorio contiene el núcleo reutilizable
(**SuperInteligent Core**) y su primera aplicación comercial
(**Business Operations Orchestrator**).

SuperInteligent System NO es un CRM con funciones de IA agregadas: es un
sistema de coordinación y ejecución de procesos empresariales mediante un
orquestador y agentes especializados. Los módulos actuales (oportunidades,
tareas, aprobaciones, ejecuciones, auditoría) son la primera demostración
funcional, no la identidad del producto. Ver `docs/GLOSARIO-PENSIA.md` y
`docs/DIAGNOSTICO-ALINEACION-PENSIA.md`.

## Estado

- **Fase actual:** Fase 1 (MVP Core) completada el 25-oct-2026 + UI/UX
  System OS v1.1 Fases 0–5 completadas y mergeadas a `main` el 26-oct-2026.
- **Demo pública:** Render + Neon (plan gratis) en
  https://superinteligent-system-demo-9e49.onrender.com/ — verificada en
  vivo tras cada merge (login demo, indicadores, 5 vistas, sin problemas
  visuales; solo lectura).
- **Tests:** 31/31 en verde (26-oct-2026, Fase 5 de UI); build y typecheck
  limpios. Persistencia dual SQLite/Postgres verificada contra Neon (D14).
- **Pendientes:** confirmación formal del stack (G0-D1), decisión de modelo
  por cliente (F1-TENANT: multi-tenant vs. instancia dedicada), CI básica
  (F1-CI), y la adaptación PENSIA (C4–C8, ver diagnóstico).
- **Última actualización:** 2026-10-26 (C3: proceso como entidad).

## Qué es

**Propósito actual (25-oct-2026, D12–D13):** plantilla reutilizable de
sistema de automatización inteligente (orquestador + agentes) que Tomás
vende como servicio de implementación a empresas que quieren su propio
sistema para su negocio en particular. La demo con datos ficticios
(ver `docs/BUYER_PERSONA.md`) es la vidriera de esa plantilla. Sin
entrevistas ni clientes reales en esta fase.

- **SuperInteligent Core:** orquestación reutilizable — eventos, workflows,
  agentes, herramientas autorizadas, estado persistido, aprobaciones y auditoría.
- **Business Operations Orchestrator (primera app y primera implementación
  de referencia de la plantilla):** para agencias y consultoras B2B que
  pierden oportunidades por falta de captura, organización y seguimiento.
  Flujo: recibir oportunidad → validar/normalizar → detectar duplicados → crear o
  actualizar → clasificar → determinar siguiente acción → tareas y borradores →
  aprobación humana → seguimientos autorizados → registro auditable.

## Qué NO es (todavía)

- No es un CRM completo ni un sustituto de HubSpot/Pipedrive.
- No envía mensajes, correos ni propuestas reales de forma autónoma en el MVP.
- No es una extensión del infoproducto «Oficio Digital IA» ni de la línea
  independiente de servicios de automatización (Salud, Dinero, Tiempo): es un
  proyecto separado. Cualquier sinergia futura se decidirá explícitamente.

## Estructura

```text
README.md
BACKLOG.md
app/            Código del MVP (Fase 1: API, UI, SQLite local, tests)
docs/
  PRD.md            Usuarios, problema, alcance MVP, criterios de aceptación
  ARCHITECTURE.md   Componentes, límites, decisiones tecnológicas
  SECURITY.md       Amenazas, permisos, datos y controles
  WORKFLOWS.md      Primer flujo de negocio y estados de ejecución
  TESTING.md        Estrategia y requisitos de calidad
  OPERATIONS.md     Ejecución, configuración, monitoreo y recuperación
  ROADMAP.md        Fases, dependencias y criterios de salida
  DECISIONS.md      Decisiones arquitectónicas y alternativas
  VALIDATION_PLAN.md Experimentos comerciales, hipótesis y métricas
  BUYER_PERSONA.md  Cliente ideal inicial (hipótesis, no validado)
  DIAGNOSTICO-ALINEACION-PENSIA.md  Fases A+B: estado real, brechas y plan
  GLOSARIO-PENSIA.md  Términos oficiales (PENSIA, orquestador, agente, proceso)
```

## Cómo trabajar con este proyecto

1. Leer `docs/DECISIONS.md` antes de cambiar una decisión registrada.
2. Toda tarea vive en `BACKLOG.md` con criterio de aceptación y evidencia.
3. Cambios pequeños, en rama de trabajo, con pruebas del flujo crítico.
4. Nunca afirmar que algo está probado, desplegado o vendido sin evidencia.
5. Acciones que requieren autorización explícita (ver `docs/SECURITY.md` y la
   directiva maestra): merge a la rama principal, despliegues a producción,
   gastos, envíos reales a terceros, cambios de permisos o secretos.

## Entorno verificado en Gate 0 (2026-10-25)

- VM Linux con Node v24.22.1, npm 10.9.4, git 2.43.0, Python 3.12.3.
- Sin binarios `psql` ni `docker` en la VM; la base de datos del MVP se
  resolverá con Supabase (acceso NO verificado todavía) o Postgres local.
- No se encontró trabajo previo de SuperInteligent System: búsqueda en
  memoria, listado del workspace y búsqueda profunda en todo el workspace
  completada el 2026-10-25, sin resultados.
- Cuenta de Vercel «negociodigital» conectada para otros proyectos; ningún
  despliegue de este proyecto existe ni se realizó en Gate 0.

## Próximo paso

Adaptación PENSIA según `docs/DIAGNOSTICO-ALINEACION-PENSIA.md` (Fase C/D):
C1 completado (este commit, solo documentación); C2 (trazabilidad expuesta)
pendiente de aprobación para empezar. Ítems abiertos: G0-D1 (confirmación
formal del stack), F1-TENANT (modelo por cliente) y F1-CI. El experimento E1
quedó cancelado (D12) y Supabase fue sustituido por Neon (decisión de Tomás,
25-oct-2026: Render + Neon). Ver `BACKLOG.md` (sección Alineación PENSIA).
