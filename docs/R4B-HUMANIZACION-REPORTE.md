# R4b — Humanización del inspector de Actividad — Informe de fase

**Estado general:** COMPLETO EN LOCAL. Sin merge, sin despliegue, sin
cambios en la demo pública ni en la base real local.

## Objetivo

Feedback del usuario (27-oct ~16:40, tras ver R4 en vivo): la
información del inspector de Actividad debe entenderla un cliente
sin conocimientos técnicos. Hoy mostraba jerga («opportunity.intake»,
UUIDs, JSON crudo) y la metadata apilada en una columna. R4b es SOLO
presentación: ningún cambio de comportamiento, ningún endpoint nuevo,
ningún cambio de servidor.

## Acciones

### 1. Metadata en dos columnas

El inspector pasa de lista vertical a grid de 2 columnas, igual que
Datos contextuales en Aprobaciones (mismo patrón, mismos tokens).
Filas: Flujo / Agente principal, Inicio / Fin, Duración /
Oportunidad vinculada. Dos datos salen de esa lista sin perderse:
la versión del flujo queda en el Detalle técnico y el vínculo de
reintento queda en la sección Reintentos (que es donde corresponde).

### 2. Nombre humano del flujo

En la tabla (columna Proceso), en el subtítulo del inspector, en la
metadata y en el diálogo de reintento se muestra el nombre real del
flujo desde `GET /api/workflows` («Captación de oportunidad» para
`opportunity.intake`), no el identificador crudo. Fallback
documentado: si el registry no trae nombre para un flujo, se muestra
el identificador tal cual (hoy no ocurre: el único flujo trae nombre).

### 3. Tabla sin UUIDs

Se eliminó la columna «Ejecución» (UUID recortado + etiqueta
«Ejecución original»). La identidad de cada fila es ahora Proceso
(nombre humano) + Oportunidad + Inicio. La etiqueta «Reintento»
aparece SOLO en ejecuciones que realmente son reintento
(`retry_of` no nulo); las originales no llevan etiqueta. La búsqueda
pasó de «por ID u oportunidad» a «por oportunidad» (buscar por un ID
que ya no se muestra sería confuso). El ID completo sigue disponible
en el inspector como «ID técnico (uso interno)» (línea secundaria a
todo el ancho, en texto pequeño) y en el Detalle técnico. En la lista
de la cadena de reintentos, «Ejecución original» pasó a «Primera
ejecución» para no reintroducir la etiqueta eliminada.

### 4. Datos de entrada como campos con nombre

En vez del bloque JSON: Contacto, Correo, Empresa, Origen y Mensaje
(este último a todo el ancho), a partir del `input_json` real, con
el MISMO enmascarado de R4 (nombres con iniciales + `***`, correos
con primera letra + `***@dominio`, mensaje recortado con la marca
«(enmascarado)»). Origen mapea solo los valores reales que el código
produce (verificado en `domain.ts` y `routes.ts`): `manual` → «Alta
manual», `webhook` → «Canal web». Un valor desconocido se muestra tal
cual y no se inventa etiqueta. Campos ausentes muestran «—».

### 5. Cronología de pasos como frases

Cada paso muestra su título en español (como en R4), una frase
humana con sus datos reales, agente y hora. El JSON por paso
desaparece de la vista principal. Mapeo:

| Paso | Frase |
|---|---|
| normalize | «Se ordenaron los datos del contacto» |
| dedup, matched false | «No se encontró un contacto duplicado» |
| dedup, matched true | «Se detectó un contacto ya existente» |
| classify | «Se clasificó como {categoría}, prioridad {Alta/Media/Baja} (puntaje {score}), próximo paso: {nextAction}» |
| upsert | «Se registró la oportunidad» |
| next_action | «Se creó la tarea de seguimiento» |
| draft | «Se preparó el borrador para revisión» |
| intake (fallo previo) | «El proceso no pudo iniciarse» + el mensaje de error real debajo |
| paso desconocido | «Se completó un paso del proceso» (o «El paso no pudo completarse» si falló) |

La categoría se muestra con la palabra real almacenada
(automatización, marketing, desarrollo, consultoría, diseño,
general); la prioridad se traduce high→Alta, medium→Media,
low→Baja; `nextAction` ya es texto humano y se usa tal cual. Los
IDs (`opportunityId`, `taskId`, `draftId`) no se muestran: el cliente
no los necesita. Fallbacks honestos si un output viene incompleto:
«Se revisó si el contacto ya existía» (dedup sin `matched`),
«Se clasificó la oportunidad» (classify sin categoría/nextAction).

El JSON técnico NO desaparece: queda en UN solo bloque plegado al
final del inspector, «Detalle técnico (para soporte)» (elemento
`<details>` nativo, accesible por teclado), con la entrada
enmascarada, la salida enmascarada de cada paso, el flujo con su
versión y el ID técnico. Los errores de paso siguen visibles en su
paso y en Diagnóstico de error.

### 6. Decisiones vinculadas: actor con nombre cuando es real

La redacción humana se mantiene. El actor se muestra con nombre
SOLO si coincide con el usuario actual (fuente real: `GET /api/me`,
ya cargado por la vista; en la demo, «Martín Demo» en vez de
«demo@agenciamartin.demo»). No existe endpoint de listado de
usuarios (solo `POST /api/users` para crear), así que los demás
actores siguen mostrando su correo tal cual, sin inventar nombres.

### 7. Referencias de auditoría: hallazgo y corrección

**Hallazgo (verificado en código y en smoke).** El filtro viejo
igualaba `entity_id` con el ID de ejecución en el listado completo
de auditoría. Pero el único evento que se guarda con entidad
`execution` es `execution.retried` (`routes.ts`); todos los demás
eventos del proceso (oportunidad creada/actualizada, tarea creada,
borrador creado/aprobado/rechazado/editado) tienen como entidad la
oportunidad, la tarea o el borrador, y citan a la oportunidad en
`detail_json.opportunityId`. Por eso una ejecución con decisiones
vinculadas mostraba «Sin eventos de auditoría vinculados»: el filtro
buscaba eventos que, para una ejecución normal, no existen.

**Corrección (solo relaciones reales, sin inventar vínculos).**
Referencias = unión, sin duplicados y más recientes primero, de:
(a) eventos con `entity_id` igual al ID de ejecución (p. ej. un
reintento), y (b) la línea de tiempo de la oportunidad vinculada
(`GET /api/audit?opportunityId=`, que el servidor ya devuelve con
eventos directos sobre la oportunidad más tareas y borradores que la
citan). El texto vacío pasa a «No hay otros registros para esta
ejecución.» y se agregó indicador de carga mientras la línea de
tiempo se está trayendo (antes parpadeaba el vacío). Corrección de
implementación: el cómputo es plano, no un hook, porque va después
de los early returns de loading/error (un hook ahí rompería el orden
de hooks de React).

## Antes / después (resumen)

| Elemento | Antes | Después |
|---|---|---|
| Tabla, 1ª columna | UUID recortado + «Ejecución original» | Proceso (nombre humano) + «Reintento» solo si lo es |
| Tabla, flujo | `opportunity.intake` | «Captación de oportunidad» |
| Metadata | Lista vertical, con «ID completo» y «Reintento de» | Grid 2 columnas; ID como «ID técnico (uso interno)» |
| Datos de entrada | Bloque JSON | Campos con nombre, mismo enmascarado |
| Pasos | Título + JSON por paso | Título + frase humana; JSON plegado al final |
| Decisiones, actor | Correo siempre | Nombre si es el usuario actual; si no, correo |
| Referencias | «Sin eventos…» aunque hubiera decisiones | Eventos reales vinculados (ejecución + oportunidad) |
| Texto vacío de referencias | «Sin eventos de auditoría vinculados a esta ejecución.» | «No hay otros registros para esta ejecución.» |

## Archivos

- `app/client/src/features/actividad/ActivityView.tsx` (único archivo
  tocado; solo cliente, sin cambios de servidor).

## Pruebas

- Suite: **150/150 en 10 archivos** (sin cambio de servidor no hay
  tests nuevos de servidor; el cliente no tiene runner de tests en
  este repo, se declara explícitamente).
- Build limpio y `typecheck:client` limpio (ver la corrección abajo);
  `node --check public/app.js` OK; vanilla intacta (MD5
  `44ef9ae6daf62c3b9c335f6f2501256a`); DB real local intacta (MD5
  `af175edc7673befe9b9f3ace3c556c12`); ningún proceso en pie.
- Marcadores en el JS construido: «Captación de oportunidad»,
  «ID técnico» (×2), «Detalle técnico», «Buscar por oportunidad»;
  «Ejecución original» AUSENTE a propósito.
- Smoke propio en copia de DB (puerto 3471, matado por PID exacto):
  health OK, login OK, 3 ejecuciones del seed (todas `done`),
  `GET /api/workflows` trae `opportunity.intake` → «Captación de
  oportunidad», `GET /api/me` trae nombre «Martín Demo» + correo
  (base de la resolución del actor), la línea de tiempo de la
  oportunidad de Lucía trae 3 eventos reales (oportunidad, borrador
  y tarea), y el listado completo de auditoría trae CERO eventos
  con entidad `execution` (confirma la hipótesis del punto 7: el
  filtro viejo no podía encontrar nada para ejecuciones normales).

## Evidencia

- Informe R4 (base): `docs/R4-ACTIVIDAD-REPORTE.md`.
- Esta tanda: `docs/R4B-HUMANIZACION-REPORTE.md`.

## Decisiones

- Corrección de un error de tipos preexistente de R4, detectado al
  correr `typecheck:client` en esta tanda: `ActivityData`
  declaraba `opportunities: OpportunityDetail[]` pero
  `getOpportunities()` devuelve `OpportunitySummary[]` (la vista
  solo lee id, contact_name y company de ahí). Se corrigió el tipo
  en la vista; el build de Vite no lo había detectado porque no
  tipa el cliente. No cambia ningún comportamiento.
- El identificador crudo del flujo y el ID técnico completo quedan
  SOLO en el bloque plegado «Detalle técnico (para soporte)»:
  accesibles para soporte sin ensuciar la vista del cliente.
- La búsqueda por ID se eliminó junto con la columna: buscar por un
  identificador que ya no se muestra sería confuso.
- El actor se resuelve a nombre solo para el usuario actual porque
  es la única fuente real de nombres; no se inventó un listado de
  usuarios.

## Riesgos

- Ninguno de comportamiento: solo presentación. Si un flujo futuro
  no trae nombre en el registry, su identificador crudo vuelve a
  verse (fallback documentado, no un fallo silencioso).
- La frase de classify depende de los campos reales del output; si
  un output futuro viene incompleto, cae en la frase genérica
  documentada.

## Próximo paso

- Ofrecer merge con el procedimiento habitual (snapshot de texto +
  verificación de PNG conservados) y verificación en vivo solo
  lectura (inspector humanizado, metadata en dos columnas, detalle
  técnico plegado, referencias con eventos reales).
