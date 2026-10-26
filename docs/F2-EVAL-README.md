# F2-EVAL — Conjunto de evaluación fijo (v1)

## Estado general

IN_PROGRESS. F2-EVAL (BACKLOG, Alta, PLANNED → IN_PROGRESS):
casos con salida esperada, versionados. Es el paso previo
obligatorio a F2-AI: sin un conjunto fijo, «la IA mejora la
clasificación» no se puede medir, solo afirmar.

## Qué contiene v1

`app/src/eval/cases-v1.json` (11 casos, vertical agencia) y
`app/src/eval/eval.test.ts` (el corredor, 4 tests):

- **Regression (8 casos):** congelan el comportamiento actual de
  las reglas. Incluyen los 3 mensajes del seed (Lucía, Pedro, Ana),
  un caso por cada categoría restante (desarrollo, consultoría,
  diseño) y dos casos de umbral (urgencia sin presupuesto →
  media, no alta; presupuesto sin urgencia → media). El
  clasificador actual DEBE coincidir con lo esperado en categoría,
  prioridad, tarea, plazo y puntaje. Si un cambio futuro rompe uno,
  es una regresión deliberada o un error, nunca un accidente
  silencioso.
- **Challenge (3 casos):** dónde el criterio humano difiere de las
  reglas. Los 3 difieren solo en categoría (prioridad y tarea
  coinciden): multi-tema («marketing y también automatizar» →
  humano dice marketing, reglas dicen automatización porque esa
  regla va primera), intención implícita («se nos escapan los
  clientes» → humano dice automatización, reglas dicen general) y
  venta por Instagram (humano dice marketing, reglas dicen
  general). El test exige que el `rulesOutput` registrado siga
  siendo exacto (si las reglas cambian, el archivo se actualiza a
  propósito) e informa las divergencias sin fallar: esa
  divergencia es la medida que F2-AI usará.

## Versiones

v1 está congelada: no se editan sus casos. Si el criterio cambia
(un caso estaba mal, un vertical nuevo, una regla nueva), se crea
v2 con sus propios casos y su propio test, y v1 queda como
testigo del comportamiento anterior. La salida esperada la define
el criterio humano documentado en cada caso, no la salida actual
de las reglas (eso es lo que hace que la medida no sea circular).

## Relación con el vertical Inmobiliaria

Los 4 ejemplos inmobiliarios NO se duplican acá: su especificación
versionada ya vive en `docs/F4-TEMPLATE-VERTICAL-INMOBILIARIA.md`
y `docs/vertical-inmobiliaria-ejemplos.json`. Este conjunto mide
el sistema vivo (vertical agencia). Si un cliente inmobiliario
llega a producción, su propio conjunto se versiona igual.

## Cómo se corre

`npm test` (el archivo `eval.test.ts` corre con el resto de la
suite). No toca base de datos ni red: clasifica en memoria.

## Qué falta para F2-AI (no es este paso)

F2-AI depende de F2-EVAL y de «claves aprobadas»: proveedor de IA,
costo, margen predefinido de mejora y decisión de Tomás. Su
criterio es «supera a reglas con margen predefinido o se
descarta». Nada de eso se decide acá: v1 solo deja la regla de
medir puesta, para que esa decisión se tome con evidencia.
