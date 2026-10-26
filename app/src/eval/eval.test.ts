// F2-EVAL v1: conjunto de evaluación fijo para medir cualquier cambio de
// clasificación (reglas o futura IA) contra un criterio congelado.
// - regression: el clasificador actual DEBE coincidir con expected.
// - challenge: expected es el criterio humano; rulesOutput es lo que las
//   reglas devuelven hoy (verificado). El test exige que rulesOutput siga
//   siendo exacto, para que el archivo no mienta si las reglas cambian.
//   La divergencia humano-vs-reglas NO hace fallar el test: es la medida
//   que F2-AI usará (superar a reglas con un margen predefinido o descartarse).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyOpportunity,
  normalizeOpportunity,
} from '../domain.js';

interface EvalCase {
  id: string;
  subset: 'regression' | 'challenge';
  vertical: string;
  contactName: string;
  contactEmail: string;
  company: string;
  message: string;
  expected: {
    category: string;
    priority: string;
    nextAction: string;
    dueHours: number;
    score?: number;
  };
  rulesOutput?: {
    category: string;
    priority: string;
    nextAction: string;
    dueHours: number;
    score: number;
  };
  humanNote?: string;
}

const raw = readFileSync(new URL('./cases-v1.json', import.meta.url), 'utf-8');
const set = JSON.parse(raw) as { version: string; cases: EvalCase[] };
const regression = set.cases.filter((c) => c.subset === 'regression');
const challenge = set.cases.filter((c) => c.subset === 'challenge');

function run(c: EvalCase) {
  const n = normalizeOpportunity({
    contactName: c.contactName,
    contactEmail: c.contactEmail,
    company: c.company,
    message: c.message,
    source: 'manual',
  });
  return classifyOpportunity(n);
}

describe('F2-EVAL v1', () => {
  it('el conjunto está versionado y tiene los dos subconjuntos', () => {
    expect(set.version).toBe('v1');
    expect(regression.length).toBe(8);
    expect(challenge.length).toBe(3);
  });

  it('regression: el clasificador actual coincide con lo esperado', () => {
    for (const c of regression) {
      const r = run(c);
      expect(
        [c.id, r.category, r.priority, r.nextAction, r.dueHours, r.score],
        `caso ${c.id}`,
      ).toEqual([
        c.id,
        c.expected.category,
        c.expected.priority,
        c.expected.nextAction,
        c.expected.dueHours,
        c.expected.score,
      ]);
    }
  });

  it('challenge: el rulesOutput registrado sigue siendo exacto', () => {
    for (const c of challenge) {
      const r = run(c);
      expect(
        [c.id, r.category, r.priority, r.nextAction, r.dueHours, r.score],
        `caso ${c.id}`,
      ).toEqual([
        c.id,
        c.rulesOutput!.category,
        c.rulesOutput!.priority,
        c.rulesOutput!.nextAction,
        c.rulesOutput!.dueHours,
        c.rulesOutput!.score,
      ]);
    }
  });

  it('challenge: informa las divergencias humano-vs-reglas (no falla)', () => {
    const divergent = challenge.filter(
      (c) => c.expected.category !== c.rulesOutput!.category,
    );
    console.log(
      `F2-EVAL v1: ${divergent.length}/${challenge.length} challenge difieren en categoría: ${divergent.map((c) => c.id).join(', ')}`,
    );
    expect(divergent.length).toBe(3);
  });
});
