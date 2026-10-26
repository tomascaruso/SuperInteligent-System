import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit, exec, newId, nowIso, queryAll, queryOne, todayUtc, type Db, type Param } from './db.js';
import {
  acceptInvitationSchema,
  draftRejectSchema,
  invitationSchema,
  loginSchema,
  opportunityInputSchema,
  taskPatchSchema,
  type OpportunityInput,
} from './domain.js';
import {
  authenticate,
  generateWebhookSecret,
  getUser,
  hashPassword,
  requireAdmin,
  signToken,
  verifyPassword,
} from './auth.js';
import {
  contactSchema,
  isContactConfigured,
  sendContactViaRelay,
  type ContactConfig,
} from './contact.js';
import { LimitExceededError, enqueueIntakeJob, runIntake, type JobRow, type OpportunityRow } from './engine.js';

// C7: cookie de sesión httpOnly. Secure solo en producción: en local se
// sirve por HTTP y con Secure el navegador no la guardaría. SameSite=Lax
// alcanza porque la app es del mismo origen.
function authCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${secure}`;
}
const CLEAR_AUTH_COOKIE = 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';

export const SERVICE_VERSION = '0.1.0';

export interface RouteOptions {
  jwtSecret: string;
  maxOpportunitiesPerDay: number;
  // C8: secreto del operador de PENSIA (crea invitaciones). Sin él, la
  // creación de invitaciones está cerrada.
  operatorToken?: string;
  // F3-DEMO: envío del formulario de contacto. Sin él, el contacto está
  // cerrado y el formulario no se muestra.
  contact?: ContactConfig;
}

interface OrgRow {
  id: string;
  name: string;
  webhook_secret: string;
  created_at: string;
}

interface UserRow {
  id: string;
  org_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
}

interface InvitationRow {
  id: string;
  email: string;
  org_name: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  org_id: string;
  opportunity_id: string;
  title: string;
  assigned_to: string;
  agent_id: string | null;
  agent_name: string | null;
  // F3-DEMO: la tarea muestra a quién corresponde (join con su oportunidad).
  contact_name: string | null;
  company: string | null;
  status: string;
  due_at: string;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  id: string;
  name: string;
  description: string;
  steps_json: string;
  sort_order: number;
  created_at: string;
}

interface DraftRow {
  id: string;
  org_id: string;
  opportunity_id: string;
  body: string;
  source_message: string | null;
  status: string;
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

interface ExecutionRow {
  id: string;
  org_id: string;
  workflow: string;
  workflow_version: string;
  input_json: string;
  idempotency_key: string | null;
  retry_of: string | null;
  status: string;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionStepRow {
  id: string;
  execution_id: string;
  step: string;
  status: string;
  output_json: string | null;
  error: string | null;
  created_at: string;
}

interface WorkflowRow {
  workflow: string;
  version: string;
  name: string;
  steps_json: string;
  created_at: string;
}

interface ProcessRunRow {
  id: string;
  org_id: string;
  workflow: string;
  workflow_version: string;
  status: string;
  execution_id: string;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  org_id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  detail_json: string;
  created_at: string;
}

function parse<T>(
  schema: z.ZodType<T>,
  body: unknown,
  reply: FastifyReply,
): T | null {
  const r = schema.safeParse(body);
  if (!r.success) {
    void reply.code(400).send({
      error: 'validation',
      issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return null;
  }
  return r.data;
}

function verifySignature(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header) return false;
  const m = /^sha256=([0-9a-f]+)$/.exec(header);
  if (!m) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(m[1], 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerRoutes(
  app: FastifyInstance,
  db: Db,
  opts: RouteOptions,
): void {
  // Captura el cuerpo crudo para verificar la firma HMAC del webhook.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    function (req, body, done) {
      const text = typeof body === 'string' ? body : body.toString('utf8');
      (req as unknown as { rawBody?: string }).rawBody = text;
      if (!text) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(text));
      } catch {
        done(new Error('JSON inválido'), undefined);
      }
    },
  );

  const auth = authenticate(db, opts.jwtSecret);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'superinteligent-system',
    version: SERVICE_VERSION,
  }));

  // ---------- Contacto de la demo (F3-DEMO, público) ----------
  // El mensaje se envía por el relay HTTPS (Apps Script); la URL y el
  // token viven solo en la configuración del servidor y nunca se
  // devuelven ni se muestran. Sin relay configurado, el estado es
  // { enabled: false } y el envío responde 503.
  app.get('/api/contact/status', async () => ({ enabled: isContactConfigured(opts.contact) }));

  // Límite anti-spam: 5 mensajes por hora por IP. El estado vive en
  // memoria (igual que el límite de login de C7).
  const contactAttempts = new Map<string, { count: number; resetAt: number }>();
  const CONTACT_MAX_ATTEMPTS = 5;
  const CONTACT_WINDOW_MS = 60 * 60 * 1000;

  app.post('/api/contact', async (request, reply) => {
    const body = parse(contactSchema, request.body, reply);
    if (!body) return;
    // Honeypot: un bot que completa el campo invisible recibe un éxito
    // fingido y el mensaje se descarta sin enviarse ni guardarse.
    if (body.website !== '') {
      await reply.send({ ok: true });
      return;
    }
    const ip = request.ip;
    const now = Date.now();
    const entry = contactAttempts.get(ip);
    if (entry && now < entry.resetAt && entry.count >= CONTACT_MAX_ATTEMPTS) {
      await reply.code(429).send({ error: 'rate_limited', message: 'Demasiados mensajes; probá de nuevo más tarde' });
      return;
    }
    contactAttempts.set(
      ip,
      entry && now < entry.resetAt
        ? { count: entry.count + 1, resetAt: entry.resetAt }
        : { count: 1, resetAt: now + CONTACT_WINDOW_MS },
    );
    const contact = opts.contact;
    if (!isContactConfigured(contact)) {
      await reply.code(503).send({ error: 'contact_not_configured', message: 'El contacto todavía no está disponible en esta demo.' });
      return;
    }
    try {
      await sendContactViaRelay(contact, body);
    } catch (err) {
      request.log.error({ err }, 'Fallo al enviar el mensaje de contacto');
      await reply.code(502).send({ error: 'send_failed', message: 'No se pudo enviar el mensaje; probá de nuevo más tarde.' });
      return;
    }
    await reply.send({ ok: true });
  });

  // ---------- Interfaz web mínima (sin framework) ----------
  const publicDir = new URL('../public/', import.meta.url);
  app.get('/', async (_req, reply) => {
    void reply.type('text/html').send(readFileSync(new URL('index.html', publicDir)));
  });
  app.get('/app.js', async (_req, reply) => {
    void reply.type('application/javascript').send(readFileSync(new URL('app.js', publicDir)));
  });
  // Hojas del sistema de diseño. Solo se sirven los archivos de la lista blanca;
  // cualquier otro nombre (incluidos intentos de salir del directorio) da 404.
  // No es un cambio de API: solo serving de archivos estáticos del frontend.
  const STYLE_FILES = new Set(['tokens.css', 'base.css', 'components.css', 'layout.css']);
  app.get('/styles/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!STYLE_FILES.has(file)) {
      void reply.code(404).send({ error: 'No encontrado' });
      return;
    }
    void reply.type('text/css').send(readFileSync(new URL(`styles/${file}`, publicDir)));
  });

  // ---------- Auth ----------

  // C8: alta operada por PENSIA (D16). Ya NO hay registro público: el
  // endpoint /api/auth/register se eliminó. PENSIA crea una invitación
  // (protegida por el secreto del operador, no por sesión: el operador no
  // es usuario de ninguna org) y el cliente la canjea. El token viaja una
  // sola vez en la respuesta de creación; en la base solo queda su hash.
  // Sin OPERATOR_TOKEN configurado, la creación está cerrada.
  app.post('/api/invitations', async (request, reply) => {
    const operatorToken = request.headers['x-operator-token'];
    if (!opts.operatorToken) {
      await reply.code(403).send({ error: 'operator_not_configured', message: 'El alta por invitación no está configurada en este servidor' });
      return;
    }
    if (operatorToken !== opts.operatorToken) {
      await reply.code(403).send({ error: 'operator_forbidden', message: 'Se requiere el secreto del operador' });
      return;
    }
    const body = parse(invitationSchema, request.body, reply);
    if (!body) return;
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const id = newId();
    const now = nowIso();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    await exec(
      db,
      'INSERT INTO invitations (id, email, org_name, token_hash, expires_at, accepted_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      id,
      body.email.toLowerCase(),
      body.orgName,
      tokenHash,
      expiresAt,
      now,
    );
    await reply.code(201).send({
      invitation: { id, email: body.email.toLowerCase(), org_name: body.orgName, expires_at: expiresAt },
      token,
    });
  });

  app.post('/api/auth/accept-invitation', async (request, reply) => {
    const body = parse(acceptInvitationSchema, request.body, reply);
    if (!body) return;
    const tokenHash = createHash('sha256').update(body.token).digest('hex');
    const invitation = await queryOne<InvitationRow>(db, 'SELECT * FROM invitations WHERE token_hash = ?', tokenHash);
    if (!invitation) {
      await reply.code(404).send({ error: 'invitation_not_found', message: 'Invitación no encontrada' });
      return;
    }
    if (invitation.accepted_at) {
      await reply.code(410).send({ error: 'invitation_accepted', message: 'Esta invitación ya fue usada' });
      return;
    }
    if (Date.parse(invitation.expires_at) < Date.now()) {
      await reply.code(410).send({ error: 'invitation_expired', message: 'Esta invitación venció' });
      return;
    }
    // El correo ya registrado no puede abrir otra organización: el login
    // busca por correo y dos filas lo dejarían ambiguo (misma regla que
    // tenía el registro público).
    const existing = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE email = ?', invitation.email);
    if (existing) {
      await reply.code(409).send({ error: 'conflict', message: 'El correo ya está registrado' });
      return;
    }
    const orgId = newId();
    const webhookSecret = generateWebhookSecret();
    await exec(
      db,
      'INSERT INTO organizations (id, name, webhook_secret, created_at) VALUES (?, ?, ?, ?)',
      orgId,
      invitation.org_name,
      webhookSecret,
      nowIso(),
    );
    const userId = newId();
    await exec(
      db,
      'INSERT INTO users (id, org_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId,
      orgId,
      body.name,
      invitation.email,
      hashPassword(body.password),
      'admin',
      nowIso(),
    );
    await exec(db, 'UPDATE invitations SET accepted_at = ? WHERE id = ?', nowIso(), invitation.id);
    await audit(db, orgId, invitation.email, 'org.created', 'organization', orgId, {});
    const user = { id: userId, orgId, role: 'admin' as const, email: invitation.email, name: body.name };
    // C7: la sesión también viaja en cookie httpOnly; el token en el
    // cuerpo se mantiene para clientes API.
    reply.header('Set-Cookie', authCookie(signToken(opts.jwtSecret, user)));
    await reply.code(201).send({
      token: signToken(opts.jwtSecret, user),
      org: { id: orgId, name: invitation.org_name, webhook_secret: webhookSecret },
      user: { id: userId, name: body.name, email: user.email, role: 'admin' },
    });
  });

  // C7: límite de intentos fallidos de login por IP (20 cada 15 min).
  // Solo cuentan los fallidos: un usuario legítimo que entra bien no
  // consume el cupo. El estado vive en memoria (se pierde al reiniciar,
  // aceptable para un tope anti-fuerza-bruta, no para auditoría).
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const LOGIN_MAX_ATTEMPTS = 20;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000;

  app.post('/api/auth/login', async (request, reply) => {
    const body = parse(loginSchema, request.body, reply);
    if (!body) return;
    const ip = request.ip;
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry && now < entry.resetAt && entry.count >= LOGIN_MAX_ATTEMPTS) {
      await reply.code(429).send({ error: 'rate_limited', message: 'Demasiados intentos de inicio de sesión; probá de nuevo más tarde' });
      return;
    }
    const row = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE email = ?', body.email.toLowerCase());
    if (!row || !verifyPassword(body.password, row.password_hash)) {
      loginAttempts.set(
        ip,
        entry && now < entry.resetAt
          ? { count: entry.count + 1, resetAt: entry.resetAt }
          : { count: 1, resetAt: now + LOGIN_WINDOW_MS },
      );
      await reply.code(401).send({ error: 'unauthorized', message: 'Credenciales inválidas' });
      return;
    }
    loginAttempts.delete(ip);
    const user = { id: row.id, orgId: row.org_id, role: row.role as 'admin' | 'member', email: row.email, name: row.name };
    await audit(db, row.org_id, row.email, 'user.login', 'user', row.id, {});
    // C7: cookie httpOnly, igual que en el registro.
    reply.header('Set-Cookie', authCookie(signToken(opts.jwtSecret, user)));
    await reply.send({
      token: signToken(opts.jwtSecret, user),
      org: { id: row.org_id },
      user: { id: row.id, name: row.name, email: row.email, role: row.role },
    });
  });

  // C7: cierra la sesión httpOnly (la UI llama acá al salir).
  app.post('/api/auth/logout', { preHandler: auth }, async (_request, reply) => {
    await reply.header('Set-Cookie', CLEAR_AUTH_COOKIE).send({ ok: true });
  });

  app.get('/api/me', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const org = (await queryOne<OrgRow>(db, 'SELECT * FROM organizations WHERE id = ?', user.orgId))!;
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      org: {
        id: org.id,
        name: org.name,
        // El secreto del webhook solo lo ve un admin; en producción debe
        // rotarse y no exponerse en listados.
        webhook_secret: user.role === 'admin' ? org.webhook_secret : undefined,
      },
    };
  });

  // Alta de usuarios de la organización (solo admin; rol member).
  app.post('/api/users', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(200),
        password: z.string().min(8).max(200),
      }),
      request.body,
      reply,
    );
    if (!body) return;
    const user = getUser(request);
    const existing = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE email = ?', body.email.toLowerCase());
    if (existing) {
      await reply.code(409).send({ error: 'conflict', message: 'El correo ya está registrado' });
      return;
    }
    const userId = newId();
    await exec(
      db,
      'INSERT INTO users (id, org_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId,
      user.orgId,
      body.name,
      body.email.toLowerCase(),
      hashPassword(body.password),
      'member',
      nowIso(),
    );
    await audit(db, user.orgId, user.email, 'user.created', 'user', userId, { role: 'member' });
    await reply.code(201).send({
      user: { id: userId, name: body.name, email: body.email.toLowerCase(), role: 'member' },
    });
  });

  // ---------- Oportunidades ----------
  app.post('/api/opportunities', { preHandler: auth }, async (request, reply) => {
    const body = parse(opportunityInputSchema, request.body, reply);
    if (!body) return;
    const user = getUser(request);
    try {
      const result = await runIntake(db, user.orgId, body, {
        actor: user.email,
        maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
      });
      await reply.code(result.created ? 201 : 200).send({ ...result, duplicate: !result.created });
    } catch (err) {
      if (err instanceof LimitExceededError) {
        await reply.code(429).send({ error: 'limit_exceeded', message: 'Límite diario de oportunidades alcanzado' });
        return;
      }
      throw err;
    }
  });

  // Jobs del worker (C7): encolar una ingesta para proceso asíncrono y
  // consultar su estado. El alta manual y el webhook siguen sincrónicos;
  // este es el camino asíncrono adicional (ver engine.ts).
  app.post('/api/jobs', { preHandler: auth }, async (request, reply) => {
    const body = parse(opportunityInputSchema, request.body, reply);
    if (!body) return;
    const user = getUser(request);
    const job = await enqueueIntakeJob(db, user.orgId, body);
    await reply.code(202).send({ job });
  });

  app.get('/api/jobs/:id', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const job = await queryOne<JobRow>(db, 'SELECT * FROM jobs WHERE id = ? AND org_id = ?', id, user.orgId);
    if (!job) {
      await reply.code(404).send({ error: 'not_found', message: 'Job no encontrado' });
      return;
    }
    return { job };
  });

  app.get('/api/opportunities', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    return {
      opportunities: await queryAll<OpportunityRow>(
        db,
        'SELECT * FROM opportunities WHERE org_id = ? ORDER BY created_at DESC LIMIT 100',
        user.orgId,
      ),
    };
  });

  app.get('/api/opportunities/:id', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const opp = await queryOne<OpportunityRow>(
      db,
      'SELECT * FROM opportunities WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!opp) {
      await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
      return;
    }
    return { opportunity: opp };
  });

  // ---------- Ingesta por webhook (firma HMAC + idempotencia) ----------
  app.post('/api/ingest/:orgId', async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const org = await queryOne<OrgRow>(db, 'SELECT * FROM organizations WHERE id = ?', orgId);
    if (!org) {
      await reply.code(404).send({ error: 'not_found', message: 'Organización no encontrada' });
      return;
    }
    const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? '';
    if (!verifySignature(org.webhook_secret, rawBody, request.headers['x-signature'] as string | undefined)) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Firma del webhook inválida' });
      return;
    }
    const headerKey = request.headers['x-idempotency-key'] as string | undefined;
    const key = headerKey ?? createHash('sha256').update(rawBody).digest('hex');
    const stored = await queryOne<{ response_json: string }>(
      db,
      'SELECT response_json FROM idempotency_keys WHERE org_id = ? AND key = ?',
      orgId,
      key,
    );
    if (stored) {
      await reply.send({ ...JSON.parse(stored.response_json), duplicate: true });
      return;
    }
    const raw = (request.body ?? {}) as Record<string, unknown>;
    const body = parse(opportunityInputSchema, { ...raw, source: raw.source ?? 'webhook' }, reply);
    if (!body) return;
    try {
      const result = await runIntake(db, orgId, body as OpportunityInput, {
        actor: 'webhook',
        idempotencyKey: key,
        maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
      });
      const response = { ...result, duplicate: !result.created };
      await exec(
        db,
        'INSERT INTO idempotency_keys (org_id, key, execution_id, response_json, created_at) VALUES (?, ?, ?, ?, ?)',
        orgId,
        key,
        result.executionId,
        JSON.stringify(response),
        nowIso(),
      );
      await reply.code(result.created ? 201 : 200).send(response);
    } catch (err) {
      if (err instanceof LimitExceededError) {
        await reply.code(429).send({ error: 'limit_exceeded', message: 'Límite diario de oportunidades alcanzado' });
        return;
      }
      throw err;
    }
  });

  // ---------- Tareas ----------
  app.get('/api/tasks', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const status = (request.query as { status?: string }).status;
    // Columnas explícitas: t.* duplicaría agent_id con el alias del JOIN.
    const base = `SELECT t.id, t.org_id, t.opportunity_id, t.title, t.assigned_to, t.agent_id,
              t.status, t.due_at, t.created_at, t.updated_at, a.name AS agent_name,
              o.contact_name, o.company
       FROM tasks t LEFT JOIN agents a ON a.id = t.agent_id
       LEFT JOIN opportunities o ON o.id = t.opportunity_id WHERE t.org_id = ?`;
    const rows = status
      ? await queryAll<TaskRow>(db, `${base} AND t.status = ? ORDER BY t.due_at ASC`, user.orgId, status)
      : await queryAll<TaskRow>(db, `${base} ORDER BY t.due_at ASC`, user.orgId);
    return { tasks: rows };
  });

  app.patch('/api/tasks/:id', { preHandler: auth }, async (request, reply) => {
    const body = parse(taskPatchSchema, request.body, reply);
    if (!body) return;
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const task = await queryOne<TaskRow>(db, 'SELECT * FROM tasks WHERE id = ? AND org_id = ?', id, user.orgId);
    if (!task) {
      await reply.code(404).send({ error: 'not_found', message: 'Tarea no encontrada' });
      return;
    }
    await exec(db, 'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', body.status, nowIso(), id);
    await audit(db, user.orgId, user.email, 'task.updated', 'task', id, { status: body.status });
    await reply.send({ task: (await queryOne<TaskRow>(db, 'SELECT * FROM tasks WHERE id = ?', id))! });
  });

  // ---------- Borradores y aprobaciones (solo admin aprueba/rechaza) ----------
  // C5: un borrador vence y se desactualiza si el mensaje de su
  // oportunidad cambió desde que se generó. Solo afecta a aprobar:
  // rechazar un borrador vencido o desactualizado sigue permitido (es la
  // forma de descartarlo; luego un intake nuevo genera uno fresco).
  // C6: el vencimiento se lee del registry de políticas (default 7 días).
  const loadPolicies = async (): Promise<Record<string, string>> => {
    const rows = await queryAll<{ key: string; value: string }>(db, 'SELECT key, value FROM policies');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  };
  const draftExpiryMs = (policies: Record<string, string>): number => {
    const days = Number(policies['draft.expiry_days'] ?? 7);
    return Number.isFinite(days) && days > 0 ? days * 24 * 3600_000 : 7 * 24 * 3600_000;
  };
  const isDraftExpired = (d: DraftRow, expiryMs: number): boolean =>
    Date.now() - Date.parse(d.created_at) > expiryMs;
  const isDraftStale = (d: DraftRow, currentMessage: string): boolean =>
    d.source_message !== null && d.source_message !== currentMessage;

  app.get('/api/drafts', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const expiryMs = draftExpiryMs(await loadPolicies());
    const rows = await queryAll<DraftRow & { contact_name: string; company: string; opportunity_message: string; opportunity_source: string }>(
      db,
      `SELECT d.*, o.contact_name, o.company, o.message AS opportunity_message, o.source AS opportunity_source FROM drafts d
       JOIN opportunities o ON o.id = d.opportunity_id
       WHERE d.org_id = ? ORDER BY d.created_at DESC`,
      user.orgId,
    );
    return {
      drafts: rows.map((d) => ({
        ...d,
        expired: isDraftExpired(d, expiryMs),
        stale: isDraftStale(d, d.opportunity_message),
      })),
    };
  });

  const decideDraft = async (
    request: FastifyRequest,
    reply: FastifyReply,
    decision: 'approved' | 'rejected',
  ): Promise<void> => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    // El cuerpo ya fue validado por la ruta (reject); approve no usa nota.
    const note =
      decision === 'rejected' ? ((request.body as { note?: string }).note ?? '') : '';
    const draft = await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ? AND org_id = ?', id, user.orgId);
    if (!draft) {
      await reply.code(404).send({ error: 'not_found', message: 'Borrador no encontrado' });
      return;
    }
    if (draft.status !== 'pending_approval') {
      await reply.code(409).send({ error: 'conflict', message: 'El borrador ya fue decidido' });
      return;
    }
    if (decision === 'approved') {
      const opp = await queryOne<{ message: string }>(
        db,
        'SELECT message FROM opportunities WHERE id = ?',
        draft.opportunity_id,
      );
      if (!opp) {
        await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
        return;
      }
      const policies = await loadPolicies();
      const expiryDays = Number(policies['draft.expiry_days'] ?? 7);
      if (isDraftExpired(draft, draftExpiryMs(policies))) {
        await reply.code(409).send({
          error: 'draft_expired',
          message: `El borrador venció: pasaron más de ${Number.isFinite(expiryDays) && expiryDays > 0 ? expiryDays : 7} días desde que se creó y ya no se puede aprobar`,
        });
        return;
      }
      if (isDraftStale(draft, opp.message)) {
        await reply.code(409).send({
          error: 'draft_stale',
          message: 'El borrador quedó desactualizado: el mensaje de la oportunidad cambió desde que se creó y ya no se puede aprobar',
        });
        return;
      }
    }
    await exec(
      db,
      'UPDATE drafts SET status = ?, note = ?, decided_by = ?, decided_at = ? WHERE id = ?',
      decision,
      note || null,
      user.email,
      nowIso(),
      id,
    );
    await exec(
      db,
      'INSERT INTO approvals (id, draft_id, org_id, decision, by_user, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newId(),
      id,
      user.orgId,
      decision,
      user.email,
      note || null,
      nowIso(),
    );
    // Sin aprobación no hay acción externa: aprobar mueve la oportunidad a
    // seguimiento; rechazar la devuelve a nueva. El envío real es Fase 3 y
    // requiere autorización y pruebas propias (ver SECURITY.md).
    await exec(
      db,
      'UPDATE opportunities SET status = ?, updated_at = ? WHERE id = ?',
      decision === 'approved' ? 'in_follow_up' : 'new',
      nowIso(),
      draft.opportunity_id,
    );
    await audit(db, user.orgId, user.email, `draft.${decision}`, 'draft', id, {
      opportunityId: draft.opportunity_id,
    });
    await reply.send({ draft: (await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', id))! });
  };

  app.post('/api/drafts/:id/approve', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    await decideDraft(request, reply, 'approved');
  });

  app.post('/api/drafts/:id/reject', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    // Validar el cuerpo antes de decidir; si falla, parse ya respondió 400.
    const parsed = draftRejectSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'validation',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    await decideDraft(request, reply, 'rejected');
  });

  // ---------- Auditoría ----------
  app.get('/api/audit', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const opportunityId = (request.query as { opportunityId?: string }).opportunityId;
    const rows = opportunityId
      ? await queryAll<AuditRow>(
          db,
          // Línea de tiempo de la oportunidad: eventos directos sobre ella
          // más eventos relacionados (tareas, borradores) que la citan en
          // su detalle.
          'SELECT * FROM audit_log WHERE org_id = ? AND (entity_id = ? OR detail_json LIKE ?) ORDER BY created_at DESC LIMIT 200',
          user.orgId,
          opportunityId,
          `%"opportunityId":"${opportunityId}"%`,
        )
      : await queryAll<AuditRow>(
          db,
          'SELECT * FROM audit_log WHERE org_id = ? ORDER BY created_at DESC LIMIT 200',
          user.orgId,
        );
    return { audit: rows };
  });

  // ---------- Ejecuciones y reintento ----------
  app.get('/api/executions', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    return {
      executions: await queryAll<ExecutionRow>(
        db,
        'SELECT * FROM executions WHERE org_id = ? ORDER BY created_at DESC LIMIT 100',
        user.orgId,
      ),
    };
  });

  // Pasos de una ejecución (C2, alineación PENSIA): los pasos ya se
  // persistían en execution_steps pero no se exponían. Solo la org dueña
  // de la ejecución puede verlos: una ejecución inexistente o de otra org
  // da 404, igual que el resto de lecturas por id.
  app.get('/api/executions/:id/steps', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const execution = await queryOne<ExecutionRow>(
      db,
      'SELECT * FROM executions WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!execution) {
      await reply.code(404).send({ error: 'not_found', message: 'Ejecución no encontrada' });
      return;
    }
    // created_at tiene precisión de milisegundos (nowIso): los pasos de una
    // ejecución se crean en secuencia y el orden temporal es el orden real.
    return {
      executionId: execution.id,
      steps: await queryAll<ExecutionStepRow>(
        db,
        'SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY created_at ASC',
        id,
      ),
    };
  });

  app.post('/api/executions/:id/retry', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const execution = await queryOne<ExecutionRow>(
      db,
      'SELECT * FROM executions WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!execution) {
      await reply.code(404).send({ error: 'not_found', message: 'Ejecución no encontrada' });
      return;
    }
    if (execution.status !== 'failed') {
      await reply.code(409).send({ error: 'conflict', message: 'Solo se pueden reintentar ejecuciones fallidas' });
      return;
    }
    // C6: el reintento se rige por el registry de políticas. El admin es
    // exigible salvo que la política diga lo contrario; el tope cuenta
    // por ejecución original (raíz de la cadena), no por cada reintento.
    const policies = await loadPolicies();
    if (policies['retry.admin_only'] !== 'false' && user.role !== 'admin') {
      await reply.code(403).send({ error: 'forbidden', message: 'Se requiere rol admin' });
      return;
    }
    const maxRaw = Number(policies['retry.max_attempts'] ?? 3);
    const maxAttempts = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 3;
    let rootId = id;
    for (;;) {
      const row = await queryOne<{ retry_of: string | null }>(
        db,
        'SELECT retry_of FROM executions WHERE id = ?',
        rootId,
      );
      if (!row || !row.retry_of) break;
      rootId = row.retry_of;
    }
    const attempts = Number(
      (await queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM executions WHERE retry_of = ?', rootId))?.c ?? 0,
    );
    if (attempts >= maxAttempts) {
      await reply.code(409).send({
        error: 'retry_limit',
        message: `Esta ejecución ya alcanzó el máximo de ${maxAttempts} reintentos`,
      });
      return;
    }
    const input = JSON.parse(execution.input_json) as OpportunityInput;
    const result = await runIntake(db, user.orgId, input, {
      actor: user.email,
      maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
      retryOf: rootId,
    });
    await audit(db, user.orgId, user.email, 'execution.retried', 'execution', id, {
      newExecutionId: result.executionId,
    });
    await reply.send({ ...result, retriedFrom: id });
  });

  // ---------- Procesos y workflows (C3, alineación PENSIA) ----------
  // El registry es global (definiciones, no datos de una org); las corridas
  // son por org, como el resto de lecturas. Una corrida inexistente o de
  // otra org da 404.
  app.get('/api/workflows', { preHandler: auth }, async () => {
    const rows = await queryAll<WorkflowRow>(
      db,
      'SELECT * FROM workflows ORDER BY workflow ASC, version ASC',
    );
    return {
      workflows: rows.map((w) => ({
        workflow: w.workflow,
        version: w.version,
        name: w.name,
        steps: JSON.parse(w.steps_json) as string[],
      })),
    };
  });

  // Registry de agentes (C4): global, como el de workflows; con auth.
  app.get('/api/agents', { preHandler: auth }, async () => {
    const rows = await queryAll<AgentRow>(db, 'SELECT * FROM agents ORDER BY sort_order ASC');
    return {
      agents: rows.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        steps: JSON.parse(a.steps_json) as string[],
      })),
    };
  });

  // Registry de políticas (C6): global, con auth. Los valores vigentes
  // viven en la tabla; el reintento y el vencimiento los leen de acá.
  app.get('/api/policies', { preHandler: auth }, async () => {
    const rows = await queryAll<{ key: string; value: string; description: string }>(
      db,
      'SELECT key, value, description FROM policies ORDER BY key ASC',
    );
    return { policies: rows };
  });

  // Registry de herramientas (C6): no hay herramientas externas (el
  // sistema no llama a ningún servicio ni envía nada); las herramientas
  // reales son los pasos del pipeline, cada uno de un agente (C4). Se
  // deriva del catálogo de agentes para no duplicar el mapeo.
  app.get('/api/tools', { preHandler: auth }, async () => {
    const agents = await queryAll<{ id: string; name: string; steps_json: string }>(
      db,
      'SELECT id, name, steps_json FROM agents ORDER BY sort_order ASC',
    );
    const tools = agents.flatMap((a) =>
      (JSON.parse(a.steps_json) as string[]).map((step) => ({
        step,
        agent_id: a.id,
        agent_name: a.name,
      })),
    );
    return { tools };
  });

  app.get('/api/processes', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    // Columnas explícitas: pr.* duplicaría execution_id con el alias del JOIN.
    const rows = await queryAll<ProcessRunRow & { execution_id: string | null; execution_status: string | null }>(
      db,
      `SELECT pr.id, pr.org_id, pr.workflow, pr.workflow_version, pr.status,
              pr.created_at, pr.updated_at,
              e.id AS execution_id, e.status AS execution_status
       FROM process_runs pr LEFT JOIN executions e ON e.id = pr.execution_id
       WHERE pr.org_id = ? ORDER BY pr.created_at DESC LIMIT 100`,
      user.orgId,
    );
    return {
      processes: rows.map((r) => ({
        id: r.id,
        org_id: r.org_id,
        workflow: r.workflow,
        workflow_version: r.workflow_version,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        execution: r.execution_id ? { id: r.execution_id, status: r.execution_status } : null,
      })),
    };
  });

  app.get('/api/processes/:id', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const run = await queryOne<ProcessRunRow>(
      db,
      'SELECT * FROM process_runs WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!run) {
      await reply.code(404).send({ error: 'not_found', message: 'Proceso no encontrado' });
      return;
    }
    const execution = await queryOne<ExecutionRow>(
      db,
      'SELECT * FROM executions WHERE id = ? AND org_id = ?',
      run.execution_id,
      user.orgId,
    );
    return { process: run, execution: execution ?? null };
  });

  // ---------- Estadísticas ----------
  app.get('/api/stats', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    // COUNT(*) vuelve como texto en Postgres: coerción explícita.
    const one = async (sql: string, ...params: Param[]): Promise<number> =>
      Number((await queryOne<{ c: number }>(db, sql, ...params))?.c ?? 0);
    const createdToday = await one(
      'SELECT COUNT(*) AS c FROM opportunities WHERE org_id = ? AND substr(created_at, 1, 10) = ?',
      user.orgId,
      todayUtc(),
    );
    return {
      opportunities: await one('SELECT COUNT(*) AS c FROM opportunities WHERE org_id = ?', user.orgId),
      openTasks: await one("SELECT COUNT(*) AS c FROM tasks WHERE org_id = ? AND status = 'open'", user.orgId),
      pendingDrafts: await one(
        "SELECT COUNT(*) AS c FROM drafts WHERE org_id = ? AND status = 'pending_approval'",
        user.orgId,
      ),
      failedExecutions: await one(
        "SELECT COUNT(*) AS c FROM executions WHERE org_id = ? AND status = 'failed'",
        user.orgId,
      ),
      createdToday,
      maxPerDay: opts.maxOpportunitiesPerDay,
    };
  });
}
