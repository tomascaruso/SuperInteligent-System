import { createHash } from 'node:crypto';
import { z } from 'zod';

// ---------- Validación de entrada (borde de la API) ----------

// C8: ya no hay registro público (ver routes.ts). El alta es por
// invitación: PENSIA crea la invitación y el cliente la canjea.
export const invitationSchema = z.object({
  orgName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export const opportunityInputSchema = z.object({
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(200),
  company: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().min(1).max(5000),
  source: z.string().trim().max(100).optional().default('manual'),
});

export const taskPatchSchema = z.object({
  status: z.enum(['open', 'done']),
});

export const draftRejectSchema = z.object({
  note: z.string().trim().max(1000).optional().default(''),
});

export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

// ---------- Normalización (determinista) ----------

export interface NormalizedOpportunity {
  contactName: string;
  contactEmail: string;
  company: string;
  message: string;
  source: string;
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function normalizeOpportunity(input: OpportunityInput): NormalizedOpportunity {
  return {
    contactName: collapseSpaces(input.contactName),
    contactEmail: input.contactEmail.toLowerCase(),
    company: collapseSpaces(input.company ?? ''),
    message: input.message.trim(),
    source: collapseSpaces(input.source ?? 'manual') || 'manual',
  };
}

// ---------- Deduplicación ----------

export function dedupKey(n: NormalizedOpportunity): string {
  const raw = `${n.contactEmail}|${n.company.toLowerCase()}|${n.contactName.toLowerCase()}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ---------- Clasificación por reglas explícitas (MVP: sin IA) ----------

export type Category =
  | 'marketing'
  | 'desarrollo'
  | 'automatización'
  | 'consultoría'
  | 'diseño'
  | 'general';

export type Priority = 'high' | 'medium' | 'low';

export interface Classification {
  category: Category;
  priority: Priority;
  score: number;
  nextAction: string;
  dueHours: number;
}

const FREE_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'protonmail.com',
  'icloud.com',
]);

const URGENT = /urgente|cuanto antes|esta semana|ya mismo|lo antes posible/i;
const BUDGET = /presupuesto|inversi[oó]n|budget/i;

const CATEGORY_RULES: Array<{ category: Category; pattern: RegExp }> = [
  { category: 'automatización', pattern: /automatizaci[oó]n|automatizar|flujo|workflow|agente/i },
  { category: 'marketing', pattern: /marketing|publicidad|redes|seo|contenido/i },
  { category: 'desarrollo', pattern: /desarrollo|software|app|web|sistema|plataforma/i },
  { category: 'consultoría', pattern: /consultor[ií]a|asesor[ií]a|estrategia/i },
  { category: 'diseño', pattern: /dise[ñn]o|branding|logo/i },
];

export function classifyOpportunity(n: NormalizedOpportunity): Classification {
  const text = `${n.message} ${n.company}`;
  const category =
    CATEGORY_RULES.find((r) => r.pattern.test(text))?.category ?? 'general';

  let score = 0;
  if (URGENT.test(n.message)) score += 2;
  if (BUDGET.test(n.message)) score += 1;
  if (n.company) score += 1;
  const domain = n.contactEmail.split('@')[1] ?? '';
  if (domain && !FREE_DOMAINS.has(domain)) score += 1;
  if (category !== 'general') score += 1;

  const priority: Priority = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  const nextAction =
    priority === 'high'
      ? 'Llamar en menos de 24 h'
      : priority === 'medium'
        ? 'Enviar propuesta en 48 h'
        : 'Enviar mensaje de calificación';
  const dueHours = priority === 'high' ? 24 : priority === 'medium' ? 48 : 72;

  return { category, priority, score, nextAction, dueHours };
}

// ---------- Borrador por plantilla (MVP: sin IA) ----------

export function draftBody(
  n: NormalizedOpportunity,
  c: Classification,
): string {
  const empresa = n.company ? ` de ${n.company}` : '';
  return [
    `Hola ${n.contactName},`,
    '',
    `Gracias por contactarnos${empresa}. Entendemos que buscan apoyo en ${c.category} y queremos ayudarlos a avanzar sin demoras.`,
    '',
    `Propuesta de siguiente paso: ${c.nextAction.toLowerCase()}.`,
    '',
    'Quedamos atentos a tu respuesta para agendar una breve llamada y definir el alcance.',
    '',
    'Saludos,',
    'Equipo comercial',
  ].join('\n');
}
