// F2-AI: clasificación con IA como EXPERIMENTO, fuera del servidor.
// Decisión de Tomás (26-oct-2026): probar con Gemini (capa gratuita) y,
// si un cliente tiene acceso a otra IA (paga), adaptar esa otra.
// Por eso el diseño es agnóstico de proveedor:
// - La interfaz AiClassifier no sabe qué proveedor hay detrás.
// - Agregar un proveedor pago después = un adaptador nuevo + una entrada
//   en createAiClassifier. No se toca el motor, las rutas ni el servidor.
// - El servidor NO usa IA: el experimento corre con scripts/ai-eval.ts.
// Fail-closed en todos los bordes:
// - Sin proveedor o sin clave, createAiClassifier devuelve null y el
//   llamador usa las reglas.
// - Un fallo de la IA (red, HTTP, JSON inválido, categoría fuera de la
//   lista) es una excepción: el llamador vuelve a las reglas, nunca a
//   un resultado inventado.

export const AI_CATEGORIES = [
  'automatización',
  'marketing',
  'desarrollo',
  'consultoría',
  'diseño',
  'general',
] as const;

export type AiCategory = (typeof AI_CATEGORIES)[number];
export type AiPriority = 'high' | 'medium' | 'low';

export interface AiClassification {
  category: AiCategory;
  priority: AiPriority;
}

export interface AiClassifier {
  readonly provider: string;
  classify(input: {
    message: string;
    company: string;
  }): Promise<AiClassification>;
}

export interface AiConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export function resolveAiConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiConfig | null {
  const provider = (env.AI_PROVIDER ?? 'none').trim().toLowerCase();
  if (provider === 'none' || provider === '') return null;
  if (provider === 'gemini') {
    const apiKey = (env.GEMINI_API_KEY ?? '').trim();
    if (!apiKey) return null;
    const model = (env.GEMINI_MODEL ?? 'gemini-2.0-flash').trim();
    return { provider, apiKey, model: model || 'gemini-2.0-flash' };
  }
  // Proveedor desconocido: fail-closed, no se inventa un adaptador.
  return null;
}

export function buildGeminiPrompt(input: {
  message: string;
  company: string;
}): string {
  const empresa = input.company ? `\nEmpresa: ${input.company}` : '';
  return [
    'Sos el clasificador de una agencia B2B. Dado el mensaje de un cliente, devolvé SOLO este JSON, sin texto adicional:',
    '{"category": "<una de: automatización, marketing, desarrollo, consultoría, diseño, general>", "priority": "<high, medium o low>"}',
    'Reglas: elegí la categoría por la intención principal del mensaje; si ninguna coincide, "general".',
    'Prioridad: "high" si muestra urgencia y presupuesto, "medium" si muestra interés concreto, "low" si es una consulta general.',
    `Mensaje: ${input.message}${empresa}`,
  ].join('\n');
}

function parseGeminiClassification(text: string): AiClassification {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('gemini_invalid_response');
  }
  const { category, priority } = parsed as Record<string, unknown>;
  if (
    typeof category !== 'string' ||
    !(AI_CATEGORIES as readonly string[]).includes(category)
  ) {
    throw new Error('gemini_invalid_category');
  }
  if (priority !== 'high' && priority !== 'medium' && priority !== 'low') {
    throw new Error('gemini_invalid_priority');
  }
  return { category: category as AiCategory, priority };
}

export class GeminiClassifier implements AiClassifier {
  readonly provider = 'gemini';

  constructor(
    private config: AiConfig,
    private fetchFn: typeof fetch = fetch,
  ) {}

  async classify(input: {
    message: string;
    company: string;
  }): Promise<AiClassification> {
    // La clave viaja en el header x-goog-api-key, no en la URL (las URLs
    // quedan en logs; los headers no).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(input) }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`gemini_http_${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? '';
    return parseGeminiClassification(text);
  }
}

export function createAiClassifier(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): AiClassifier | null {
  const config = resolveAiConfig(env);
  if (!config) return null;
  if (config.provider === 'gemini') return new GeminiClassifier(config, fetchFn);
  return null;
}
