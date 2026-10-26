# F2-AI — Experimento: ¿la IA supera a las reglas?

## Estado general

IN_PROGRESS. F2-AI (BACKLOG, Alta, PLANNED → IN_PROGRESS) depende
de F2-EVAL v1 (congelada, PASS) y de «claves aprobadas». Este
documento registra la decisión de proveedor y el diseño del
experimento. Todavía NO se corre contra una IA real: falta la clave
(ver «Cómo se corre»).

## Decisión de proveedor (Tomás, 26-oct-2026)

- **Experimento: Gemini, capa gratuita.** Inversión mínima, como
  en el resto del proyecto.
- **Después, si un cliente tiene acceso a otra IA (paga), se
  adapta esa otra.** Por eso el diseño es agnóstico de proveedor:
  agregar un proveedor pago = un adaptador nuevo + una entrada en
  `createAiClassifier` (`app/src/ai.ts`). No se toca el motor, las
  rutas ni el servidor. El cliente paga su propio uso con su propia
  clave, configurada en su despliegue.

## Diseño (qué se mide y qué no cambia)

- **El servidor NO usa IA.** La clasificación en producción sigue
  siendo por reglas. El experimento corre fuera del servidor con
  `npm run ai-eval` (script `app/scripts/ai-eval.ts`, solo local).
- **Se compara categoría + prioridad** sobre los 11 casos de
  F2-EVAL v1. La tarea y el plazo derivan mecánicamente de la
  prioridad, igual que en las reglas, así que no aportan señal
  propia.
- **Margen predefinido: 11/11.** ADOPT solo si la IA acierta todos
  los casos y las reglas menos (hoy 8/11: los 3 challenge). Si la
  IA acierta 10 u 8, es DISCARD y queda documentado. Sin margen
  cumplido no hay adopción, por buena que parezca la demo.
- **Fail-closed en todos los bordes:** sin proveedor o sin clave,
  no hay IA (se informa la línea base de reglas). Si la IA falla
  (red, HTTP, JSON inválido, categoría fuera de la lista), ese
  caso cuenta como no-acierto en la medición; en producción, el
  fallback seguiría siendo las reglas, nunca un resultado
  inventado.
- **La aprobación humana no cambia:** aunque la IA se adoptara
  algún día, un borrador seguiría necesitando aprobación antes de
  que pase nada, y el sistema seguiría sin enviar mensajes solo.
  Adoptar ≠ desplegar: poner IA en producción sería otro paso con
  su propia aprobación.

## Cómo se corre

1. El operador crea su clave en AI Studio (capa gratuita de
   Gemini) y la carga en su entorno. **Nunca se pega en el chat
   ni vive en el repo.**
2. `AI_PROVIDER=gemini GEMINI_API_KEY=<clave> npm run ai-eval`
   (modelo por defecto `gemini-2.0-flash`, overridible con
   `GEMINI_MODEL`; revisar el modelo vigente en AI Studio si la
   llamada falla).
3. El script imprime la tabla caso por caso, los aciertos de
   reglas y de IA, y el veredicto ADOPT / DISCARD / NOT_RUN.

## Costo y privacidad (límites honestos)

- La capa gratuita de Gemini tiene límites de uso (cuotas por
  minuto/día) que alcanzan para un experimento de 11 casos, no
  para producción con volumen: si algún día se adopta, el plan se
  revisa con números reales.
- Los mensajes de los casos de evaluación son ficticios. Con
  clientes reales, los mensajes saldrían hacia el proveedor: eso
  se informa al cliente antes de activar cualquier IA en su
  despliegue, no después.

## Qué falta

- La clave de Gemini (la crea Tomás cuando quiera correr el
  experimento; sin ella, el corredor solo muestra la línea base).
- El veredicto del experimento (ADOPT/DISCARD) con evidencia.
- Si ADOPT: la decisión separada de poner IA en producción.
