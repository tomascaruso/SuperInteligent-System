// F2-AI: comparación pura (sin red, sin base) entre reglas e IA sobre un
// conjunto de evaluación. La usa el script scripts/ai-eval.ts y los tests.
// - Se compara categoría + prioridad: son las decisiones reales. La tarea
//   y el plazo derivan mecánicamente de la prioridad, igual que en las
//   reglas, así que no aportan señal propia.
// - Un fallo de la IA en un caso (excepción) cuenta como no-acierto y se
//   marca como fallo: nunca se la reemplaza en silencio por las reglas en
//   la medición (en producción, en cambio, el fallback a reglas sí aplica).
// - Veredicto: ADOPT solo si la IA acierta los 11/11 y las reglas menos
//   (hoy 8/11). Cualquier otro resultado es DISCARD. Sin IA configurada,
//   NOT_RUN (la línea base de reglas se informa igual).
import {
  classifyOpportunity,
  normalizeOpportunity,
} from './domain.js';
import type { AiClassifier } from './ai.js';

export interface AiEvalCase {
  id: string;
  contactName: string;
  contactEmail: string;
  company: string;
  message: string;
  expected: { category: string; priority: string };
}

export interface AiEvalRow {
  id: string;
  expected: { category: string; priority: string };
  rules: { category: string; priority: string; score: number };
  ai: { category: string; priority: string } | null;
  aiFailed: boolean;
  aiError: string | null;
  rulesMatch: boolean;
  aiMatch: boolean;
}

export interface AiEvalResult {
  rows: AiEvalRow[];
  total: number;
  rulesMatch: number;
  aiMatch: number;
  verdict: 'ADOPT' | 'DISCARD' | 'NOT_RUN';
}

export async function evaluateAiVsRules(
  cases: AiEvalCase[],
  ai: AiClassifier | null,
): Promise<AiEvalResult> {
  const rows: AiEvalRow[] = [];
  for (const c of cases) {
    const n = normalizeOpportunity({
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      company: c.company,
      message: c.message,
      source: 'manual',
    });
    const r = classifyOpportunity(n);
    const rules = { category: r.category, priority: r.priority, score: r.score };
    const rulesMatch =
      rules.category === c.expected.category &&
      rules.priority === c.expected.priority;
    let aiResult: { category: string; priority: string } | null = null;
    let aiFailed = false;
    let aiError: string | null = null;
    if (ai) {
      try {
        aiResult = await ai.classify({
          message: c.message,
          company: c.company,
        });
      } catch (e) {
        // El error se conserva: un fallo sin causa no permite distinguir
        // "la IA clasificó mal" de "la llamada nunca llegó". El mensaje
        // del adaptador trae solo códigos (gemini_http_<status> o
        // gemini_invalid_*), nunca la clave.
        aiFailed = true;
        aiError = e instanceof Error ? e.message : 'unknown';
      }
    }
    const aiMatch =
      aiResult !== null &&
      aiResult.category === c.expected.category &&
      aiResult.priority === c.expected.priority;
    rows.push({
      id: c.id,
      expected: c.expected,
      rules,
      ai: aiResult,
      aiFailed,
      aiError,
      rulesMatch,
      aiMatch,
    });
  }
  const rulesMatchCount = rows.filter((r) => r.rulesMatch).length;
  const aiMatchCount = rows.filter((r) => r.aiMatch).length;
  const verdict =
    ai === null
      ? 'NOT_RUN'
      : aiMatchCount === rows.length && rulesMatchCount < rows.length
        ? 'ADOPT'
        : 'DISCARD';
  return {
    rows,
    total: rows.length,
    rulesMatch: rulesMatchCount,
    aiMatch: aiMatchCount,
    verdict,
  };
}
