// Corredor del experimento F2-AI. Uso local (no corre en el servidor):
//   AI_PROVIDER=gemini GEMINI_API_KEY=<clave> npm run ai-eval
// Sin IA configurada, informa la línea base de reglas y sale 0: el
// experimento todavía no puede correr, pero la medida base está.
// La clave la crea el operador en AI Studio (capa gratuita) y la carga
// en su entorno; nunca se pega en el chat ni vive en el repo.
// El veredicto se imprime; no hace fallar el proceso (ADOPT/DISCARD es
// un informe, y adoptarlo en producción sería otro paso con su propia
// aprobación).
import { readFileSync } from 'node:fs';
import { createAiClassifier } from '../src/ai.js';
import { evaluateAiVsRules, type AiEvalCase } from '../src/ai-eval.js';

const raw = readFileSync(
  new URL('../src/eval/cases-v1.json', import.meta.url),
  'utf-8',
);
const set = JSON.parse(raw) as {
  version: string;
  cases: Array<
    AiEvalCase & {
      expected: { category: string; priority: string };
    }
  >;
};
const cases: AiEvalCase[] = set.cases.map((c) => ({
  id: c.id,
  contactName: c.contactName,
  contactEmail: c.contactEmail,
  company: c.company,
  message: c.message,
  expected: { category: c.expected.category, priority: c.expected.priority },
}));

const ai = createAiClassifier(process.env);
if (!ai) {
  const result = await evaluateAiVsRules(cases, null);
  console.log(`F2-AI (${set.version}): IA no configurada.`);
  console.log(
    `Línea base de reglas: ${result.rulesMatch}/${result.total} aciertos.`,
  );
  console.log(
    'Para correr el experimento: AI_PROVIDER=gemini GEMINI_API_KEY=<clave> npm run ai-eval',
  );
  process.exit(0);
}

const result = await evaluateAiVsRules(cases, ai);
console.log(`F2-AI (${set.version}) con proveedor: ${ai.provider}`);
console.log('id | esperado | reglas | IA | acierto IA');
for (const row of result.rows) {
  const aiText = row.aiFailed
    ? 'FALLO (sin respuesta)'
    : `${row.ai!.category}/${row.ai!.priority}`;
  console.log(
    `${row.id} | ${row.expected.category}/${row.expected.priority} | ${row.rules.category}/${row.rules.priority} | ${aiText} | ${row.aiMatch ? 'sí' : 'no'}`,
  );
}
console.log(`Reglas: ${result.rulesMatch}/${result.total}`);
console.log(`IA: ${result.aiMatch}/${result.total}`);
console.log(`Veredicto: ${result.verdict}`);
if (result.verdict === 'ADOPT') {
  console.log(
    'ADOPT significa: la IA superó a las reglas en este conjunto. Ponerla en producción sería otro paso, con su propia aprobación.',
  );
} else {
  console.log(
    'DISCARD significa: la IA no superó a las reglas con el margen 11/11. Queda documentado y las reglas siguen.',
  );
}
