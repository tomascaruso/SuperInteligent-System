// F2-AI: tests sin red. El adaptador Gemini se prueba con fetch stubbeado;
// la comparación se prueba con clasificadores stub. Ningún test llama a
// una IA real ni necesita claves.
import { describe, expect, it } from 'vitest';
import {
  buildGeminiPrompt,
  createAiClassifier,
  GeminiClassifier,
  resolveAiConfig,
  type AiClassifier,
} from './ai.js';
import { evaluateAiVsRules, type AiEvalCase } from './ai-eval.js';

function stubFetch(json: unknown, ok = true, status = 200) {
  return (async () => ({
    ok,
    status,
    json: async () => json,
  })) as unknown as typeof fetch;
}

function geminiOk(category: string, priority: string) {
  return stubFetch({
    candidates: [
      { content: { parts: [{ text: JSON.stringify({ category, priority }) }] } },
    ],
  });
}

const CASES: AiEvalCase[] = [
  {
    id: 'ana',
    contactName: 'Ana Ruiz',
    contactEmail: 'ana@gmail.com',
    company: '',
    message: 'Me interesa saber más sobre sus servicios.',
    expected: { category: 'general', priority: 'low' },
  },
  {
    id: 'multitopico',
    contactName: 'Multi',
    contactEmail: 'multi@gmail.com',
    company: '',
    message: 'Buscamos marketing y también automatizar el seguimiento.',
    expected: { category: 'marketing', priority: 'low' },
  },
];

describe('F2-AI config (fail-closed)', () => {
  it('sin proveedor devuelve null', () => {
    expect(resolveAiConfig({})).toBeNull();
    expect(resolveAiConfig({ AI_PROVIDER: 'none' })).toBeNull();
    expect(createAiClassifier({})).toBeNull();
  });

  it('gemini sin clave devuelve null', () => {
    expect(resolveAiConfig({ AI_PROVIDER: 'gemini' })).toBeNull();
  });

  it('gemini con clave usa el modelo por defecto y admite override', () => {
    const def = resolveAiConfig({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'k',
    });
    expect(def).toEqual({
      provider: 'gemini',
      apiKey: 'k',
      model: 'gemini-3.1-flash-lite',
    });
    const over = resolveAiConfig({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'k',
      GEMINI_MODEL: 'otro-modelo',
    });
    expect(over?.model).toBe('otro-modelo');
  });

  it('proveedor desconocido devuelve null (no se inventa adaptador)', () => {
    expect(
      resolveAiConfig({ AI_PROVIDER: 'pago', GEMINI_API_KEY: 'k' }),
    ).toBeNull();
  });
});

describe('F2-AI adaptador Gemini (fetch stubbeado)', () => {
  it('devuelve la clasificación parseada y manda la clave por header, no por URL', async () => {
    let url = '';
    let headers: Record<string, string> = {};
    const capturing = (async (u: string, opts: { headers: Record<string, string> }) => {
      url = u;
      headers = opts.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"category": "marketing", "priority": "medium"}' }],
              },
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const c = new GeminiClassifier(
      { provider: 'gemini', apiKey: 'secreto', model: 'm' },
      capturing,
    );
    await expect(
      c.classify({ message: 'hola', company: '' }),
    ).resolves.toEqual({ category: 'marketing', priority: 'medium' });
    expect(url).not.toContain('secreto');
    expect(headers['x-goog-api-key']).toBe('secreto');
  });

  it('categoría inválida, HTTP no-ok y JSON roto lanzan (el llamador vuelve a reglas)', async () => {
    const badCategory = new GeminiClassifier(
      { provider: 'gemini', apiKey: 'k', model: 'm' },
      geminiOk('inexistente', 'low'),
    );
    await expect(
      badCategory.classify({ message: 'hola', company: '' }),
    ).rejects.toThrow();
    const httpFail = new GeminiClassifier(
      { provider: 'gemini', apiKey: 'k', model: 'm' },
      stubFetch({}, false, 429),
    );
    await expect(
      httpFail.classify({ message: 'hola', company: '' }),
    ).rejects.toThrow('gemini_http_429');
    const brokenJson = new GeminiClassifier(
      { provider: 'gemini', apiKey: 'k', model: 'm' },
      stubFetch({ candidates: [{ content: { parts: [{ text: 'no-json' }] } }] }),
    );
    await expect(
      brokenJson.classify({ message: 'hola', company: '' }),
    ).rejects.toThrow();
  });

  it('el prompt incluye el mensaje y las categorías permitidas', () => {
    const p = buildGeminiPrompt({ message: 'quiero vender más', company: '' });
    expect(p).toContain('quiero vender más');
    expect(p).toContain('automatización');
    expect(p).toContain('general');
  });
});

describe('F2-AI comparación (stub, sin red)', () => {
  const stubAi = (answers: Record<string, { category: string; priority: 'high' | 'medium' | 'low' }>): AiClassifier => ({
    provider: 'stub',
    classify: async (input) => {
      const hit = Object.entries(answers).find(([k]) =>
        input.message.includes(k),
      );
      if (!hit) throw new Error('stub sin respuesta');
      return hit[1];
    },
  });

  it('ADOPT solo si la IA acierta todos y las reglas menos', async () => {
    const ai = stubAi({
      servicios: { category: 'general', priority: 'low' },
      marketing: { category: 'marketing', priority: 'low' },
    });
    const r = await evaluateAiVsRules(CASES, ai);
    expect(r.aiMatch).toBe(2);
    expect(r.rulesMatch).toBe(1);
    expect(r.verdict).toBe('ADOPT');
  });

  it('DISCARD si la IA falla un caso o una llamada', async () => {
    const partial = stubAi({
      servicios: { category: 'general', priority: 'low' },
    });
    const r1 = await evaluateAiVsRules(CASES, partial);
    expect(r1.verdict).toBe('DISCARD');
    expect(r1.rows[1].aiFailed).toBe(true);
    expect(r1.rows[1].aiError).toBe('stub sin respuesta');
    const wrong = stubAi({
      servicios: { category: 'general', priority: 'low' },
      marketing: { category: 'automatización', priority: 'low' },
    });
    const r2 = await evaluateAiVsRules(CASES, wrong);
    expect(r2.verdict).toBe('DISCARD');
  });

  it('sin IA, NOT_RUN con la línea base de reglas', async () => {
    const r = await evaluateAiVsRules(CASES, null);
    expect(r.verdict).toBe('NOT_RUN');
    expect(r.rulesMatch).toBe(1);
    expect(r.aiMatch).toBe(0);
  });
});
