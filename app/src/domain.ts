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
  // F0: teléfono opcional. La validación corre sobre la forma
  // normalizada (sin espacios, guiones ni paréntesis): vacío o `+`
  // opcional seguido de 7 a 15 dígitos. No se valida pertenencia ni
  // operadora: eso lo hace el proveedor al enviar.
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default('')
    .refine((v) => v === '' || /^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, '')), {
      message: 'El teléfono debe tener entre 7 y 15 dígitos',
    }),
});

export const taskPatchSchema = z.object({
  status: z.enum(['open', 'done']),
});

export const draftRejectSchema = z.object({
  note: z.string().trim().max(1000).optional().default(''),
});

// F1: aprobar acepta un canal explícito (decisión de Tomás 28-oct-2026:
// el admin elige el canal al aprobar). Omitido o null = no se envía
// nada (comportamiento actual intacto).
export const draftApproveSchema = z.object({
  channel: z.enum(['gmail', 'whatsapp']).nullable().optional(),
});

// F2: registro de la conexión WhatsApp Business por org (solo admin).
// El número se valida con la misma regla que el teléfono del contacto
// (7 a 15 dígitos, `+` opcional); el ID de número y el token son
// opacos de Meta y solo se exige que no vengan vacíos. El token NUNCA
// se devuelve por ninguna API ni se muestra en la UI: se guarda
// cifrado en org_connections.
export const whatsappConnectionSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, '')), {
      message: 'El número debe tener entre 7 y 15 dígitos',
    }),
  phoneNumberId: z.string().trim().min(1).max(100),
  token: z.string().trim().min(1).max(1000),
});

// R3b: edición del borrador por un humano. Mismo estilo que el
// rechazo: cuerpo validado, nota no aplica acá. El máximo (5000)
// cubre con holgura un mensaje comercial y evita cuerpos absurdos.
export const draftEditSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

// Tipo de ENTRADA (no de salida): los campos con default
// (company, source, contactPhone) son opcionales al construir el
// objeto; normalizeOpportunity los completa. Con z.infer (salida)
// serían obligatorios y cada llamada a runIntake tendría que
// inventarlos.
export type OpportunityInput = z.input<typeof opportunityInputSchema>;

// ---------- Normalización (determinista) ----------

export interface NormalizedOpportunity {
  contactName: string;
  contactEmail: string;
  company: string;
  message: string;
  source: string;
  contactPhone: string;
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
    contactPhone: (input.contactPhone ?? '').replace(/[\s\-()]/g, ''),
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

// R3b: el borrador se lee como mensaje al cliente, así que la
// plantilla ya no puede soltar etiquetas internas ("Propuesta de
// siguiente paso: enviar mensaje de calificación" sonaba a nota
// interna, no a mensaje humano). Cada nextAction real del
// clasificador tiene su frase humana; no se inventan nextActions
// nuevos: la clave que no esté acá cae en el genérico.
const NEXT_STEP_HUMAN: Record<string, string> = {
  'Llamar en menos de 24 h':
    '¿Te parece si agendamos una breve llamada en las próximas 24 horas para definir el alcance?',
  'Enviar propuesta en 48 h':
    'En las próximas 48 horas te vamos a enviar una propuesta para que la revises con calma.',
  'Enviar mensaje de calificación':
    'Te escribo para conocer un poco mejor lo que necesitan y ver cómo podemos ayudarlos.',
};

export function draftBody(
  n: NormalizedOpportunity,
  c: Classification,
): string {
  const empresa = n.company ? ` de ${n.company}` : '';
  // Categoría "general" significa sin clasificar: "apoyo en general"
  // sonaba tan raro como la línea vieja, así que se dice de otra forma.
  const apoyo = c.category === 'general' ? 'con su negocio' : `en ${c.category}`;
  const siguiente = NEXT_STEP_HUMAN[c.nextAction] ?? 'Quedamos atentos a tu respuesta.';
  return [
    `Hola ${n.contactName},`,
    '',
    `Gracias por contactarnos${empresa}. Entendemos que buscan apoyo ${apoyo} y queremos ayudarlos a avanzar sin demoras.`,
    '',
    siguiente,
    '',
    'Quedamos atentos a tu respuesta.',
    '',
    'Saludos,',
    'Equipo comercial',
  ].join('\n');
}
