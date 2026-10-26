# F4-TEMPLATE — Vertical de ejemplo: Inmobiliaria

## Estado general

IN_PROGRESS. Segunda entrega de F4-TEMPLATE: el mismo motor de
SuperInteligent System, trabajado para otro rubro. Negocio ficticio
de ejemplo: «Inmobiliaria Ejemplo», agencia chica que recibe
consultas de compra, venta, alquiler y tasación. Nada de esto toca
el núcleo (ver «Qué NO cambió» al final): solo cambia el contenido
de negocio, siguiendo la guía (`docs/F4-TEMPLATE-GUIA-CONFIGURACION.md`).

## El flujo (el mismo, con otro contenido)

Entra una consulta → se ordena, se revisa si ya existe, se clasifica
por tema y urgencia, se registra la oportunidad, se crea la tarea
con vencimiento y se redacta el borrador → una persona aprueba o
rechaza antes de que pase nada. El sistema no envía mensajes solo.
Los 5 agentes son los mismos: Captación recibe y registra,
Calificación clasifica, Respuesta y propuesta redacta, Seguimiento
crea la tarea (llamar, agendar visita o enviar propiedades) y QA y
políticas revisa antes de aprobar, sin aprobar solo.

## Reglas adaptadas (punto `app/src/domain.ts` de la guía)

### Categorías (en orden: gana la primera que coincide)

| Categoría | Patrón (idea) | Por qué ese orden |
|---|---|---|
| `tasación` | tasación, tasar, valuación, cuánto vale | Va primera: «quiero vender y necesito una tasación» es ante todo una tasación |
| `venta` | vender, venta, vendo | |
| `alquiler` | alquilar, alquiler, renta, arrendar | |
| `compra` | comprar, compra, busco casa/departamento/propiedad | |
| `general` | (ninguna coincide) | Fallback, como en la demo |

### Puntaje y prioridad (misma mecánica, señales del rubro)

Urgencia +2 (`urgente`, `cuanto antes`, `esta semana`, `ya mismo`,
`lo antes posible`); presupuesto +1 (`presupuesto`, `inversión`,
`budget`, `precio`, `monto`, `cuota`); empresa +1; dominio no
gratuito +1; categoría distinta de `general` +1. Alta ≥ 4, media ≥ 2,
resto baja.

### Tareas por prioridad (mismo plazo, otro siguiente paso)

| Prioridad | Tarea | Plazo |
|---|---|---|
| Alta | Llamar en menos de 24 h | 24 h |
| Media | Agendar visita en 48 h | 48 h |
| Baja | Enviar propiedades similares | 72 h |

La tarea de visita es el siguiente paso natural del rubro: para una
tasación, la visita es para tasar; para una compra o un alquiler, la
visita es para mostrar la propiedad.

### Borrador (misma estructura, otro texto)

> Hola {nombre},
>
> Gracias por escribirnos{empresa}. Entendemos que te interesa
> {tema} y queremos ayudarte a avanzar sin demoras.
>
> Propuesta de siguiente paso: {siguiente paso}.
>
> Quedamos atentos a tu respuesta para agendar una breve llamada y
> definir los pasos.
>
> Equipo comercial

Temas: compra → «comprar una propiedad»; venta → «vender tu
propiedad»; alquiler → «alquilar una propiedad»; tasación → «tasar
tu propiedad»; general → «nuestros servicios». En pantalla, las
categorías nuevas se muestran tal cual (son palabras de negocio);
`general` se sigue leyendo «Consulta general».

## Ejemplos trabajados (de punta a punta)

Los 4 mensajes están en `docs/vertical-inmobiliaria-ejemplos.json`,
listos para cargar por alta manual o webhook. Cada puntaje sigue la
mecánica de arriba, sin excepciones.

### 1. Compra urgente con presupuesto → alta

- **Mensaje:** «Hola, quiero comprar un departamento en Palermo
  urgente, esta semana. Tengo presupuesto aprobado y busco 2
  ambientes.» (Martín Torres, martin@empresa.com)
- **Categoría:** compra (coincide `comprar`).
- **Puntaje:** urgencia +2, presupuesto +1, dominio no gratuito +1,
  categoría +1 = **5 → alta**.
- **Tarea:** «Llamar en menos de 24 h» (24 h).
- **Borrador:** tema «comprar una propiedad», siguiente paso «llamar
  en menos de 24 h».

### 2. Alquiler con precios → media

- **Mensaje:** «Busco alquilar una casa con patio para mi familia.
  ¿Me pueden pasar opciones y precios?» (Paula Díaz, paula@gmail.com)
- **Categoría:** alquiler (coincide `alquilar`).
- **Puntaje:** presupuesto +1 (`precios`), categoría +1 = **2 →
  media**.
- **Tarea:** «Agendar visita en 48 h» (48 h).
- **Borrador:** tema «alquilar una propiedad», siguiente paso
  «agendar visita en 48 h».

### 3. Tasación (aunque mencione venta) → media

- **Mensaje:** «Quiero vender mi casa y necesito una tasación.
  ¿Cuánto vale una propiedad en mi barrio?» (Juan Pérez,
  juan@negocio.com)
- **Categoría:** tasación (la regla de tasación va primera, aunque
  `vender` también coincidiría con venta).
- **Puntaje:** dominio no gratuito +1, categoría +1 = **2 → media**.
- **Tarea:** «Agendar visita en 48 h» (la visita es para tasar).
- **Borrador:** tema «tasar tu propiedad», siguiente paso «agendar
  visita en 48 h».

### 4. Consulta general → baja

- **Mensaje:** «Me interesa saber más sobre sus servicios.» (Ana
  López, ana@gmail.com)
- **Categoría:** general (ninguna regla coincide).
- **Puntaje:** **0 → baja**.
- **Tarea:** «Enviar propiedades similares» (72 h).
- **Borrador:** tema «nuestros servicios», siguiente paso «enviar
  propiedades similares».

## Cómo probarlo (límite honesto)

Los mensajes del JSON se pueden cargar en cualquier despliegue de la
plantilla por alta manual o webhook y recorren el flujo real
(intake, tarea, borrador, aprobación). Pero ojo: la demo pública
corre las reglas de la agencia, no estas. Con las reglas actuales,
estos 4 mensajes caerían casi todos en «general» con tareas
genéricas: eso es exactamente lo que la adaptación de la guía viene
a cambiar. La fidelidad completa del vertical (categorías, tareas y
borradores de arriba) llega cuando se aplican sus reglas en
`domain.ts` según la guía. El documento es la especificación; el
motor no se toca para demostrarlo.

## Qué NO cambió (el núcleo, intacto)

`engine.ts` (mecánica del intake y los pasos), `routes.ts`
(contratos, auth, permisos, errores), `auth.ts`, `worker.ts`,
registry de políticas y herramientas, esquema de base, mecánica del
relay de contacto y CI. Solo cambiaría el contenido de negocio
listado en la guía (`domain.ts`, textos de UI si hace falta y el
seed del cliente).
