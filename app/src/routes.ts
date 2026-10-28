import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit, exec, newId, nowIso, queryAll, queryOne, todayUtc, type Db, type Param } from './db.js';
import {
  acceptInvitationSchema,
  draftApproveSchema,
  draftEditSchema,
  draftRejectSchema,
  invitationSchema,
  loginSchema,
  opportunityInputSchema,
  taskPatchSchema,
  whatsappConnectionSchema,
  type OpportunityInput,
} from './domain.js';
import {
  ConnectionKeyMissingError,
  GmailMailProvider,
  ProviderError,
  WhatsAppCloudProvider,
  buildGoogleAuthUrl,
  decryptCredentials,
  encryptCredentials,
  signOAuthState,
  verifyOAuthState,
  type MailCredentials,
  type MailProvider,
  type WhatsAppCredentials,
  type WhatsAppProvider,
} from './sending.js';
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
import { AgentPausedError, LimitExceededError, enqueueIntakeJob, runIntake, type JobRow, type OpportunityRow } from './engine.js';
import { deriveStages, type Stage } from './stages.js';

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
  // F1: proveedor de correo inyectable (tests usan un simulado; en
  // producción es el adaptador real de Gmail). Sin él, se construye el
  // real si hay OAuth de Google configurado; si no, no hay envío.
  mailProvider?: MailProvider;
  // F2: proveedor de WhatsApp inyectable (tests usan un simulado; en
  // producción es el adaptador real de la Cloud API de Meta). Las
  // credenciales son por org y viven cifradas en org_connections:
  // no hay variables globales nuevas para WhatsApp.
  whatsappProvider?: WhatsAppProvider;
  // F1: clave de cifrado de credenciales de conexión (variable de
  // entorno del operador, sync:false). Sin ella, el módulo de envío
  // queda cerrado (fail-closed).
  connectionEncryptionKey?: string;
  // F1: credenciales OAuth de Google del operador (cliente de la app
  // de Google, no de un usuario). Sin ellas, el inicio de OAuth
  // responde 503: nunca se finge una conexión.
  googleOAuth?: { clientId: string; clientSecret: string; redirectUri: string };
  // Fase A: secretos de la app de Meta para el webhook de WhatsApp
  // (verificación del canal, no por org). Sin ellos, el endpoint
  // responde cerrado (fail-closed, ver la sección del webhook).
  metaWebhook?: { appSecret: string; verifyToken: string };
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
  paused: number | null;
  created_at: string;
}

// H1: estado derivado de un agente. Pausado manda sobre todo (flag
// manual del admin); si no, ocupado si tiene tareas abiertas (la
// señal real disponible: los agentes no son trabajadores de fondo,
// así que no hay "en curso" persistente); si no, disponible.
function agentStatus(paused: boolean, openTasks: number): 'paused' | 'busy' | 'available' {
  if (paused) return 'paused';
  if (openTasks > 0) return 'busy';
  return 'available';
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
  // R3b: marca de edición humana (migración portable; 0/1 en base).
  edited: number;
  edited_at: string | null;
}

// R3b: la base guarda edited como 0/1 y el cliente lo espera
// booleano; se normaliza en el borde, en todas las salidas de
// borrador, para no filtrar el detalle de almacenamiento.
function draftOut(d: DraftRow): Omit<DraftRow, 'edited'> & { edited: boolean } {
  return { ...d, edited: d.edited === 1 || (d.edited as unknown) === true };
}

// F0/F1: conexiones de envío por organización y entregas de mensajes.
// La fila de conexión NUNCA sale con su secreto: la API pública de
// conexiones devuelve solo provider, status, display_account y
// verificación (ver connectionOut). La entrega es el registro de que
// un borrador aprobado se envió (o falló) por un canal.
interface ConnectionRow {
  id: string;
  org_id: string;
  provider: string;
  status: string;
  display_account: string;
  credentials_ciphertext: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function connectionOut(c: ConnectionRow): Omit<ConnectionRow, 'credentials_ciphertext'> {
  const { credentials_ciphertext: _secret, ...rest } = c;
  return rest;
}

interface DeliveryRow {
  id: string;
  org_id: string;
  draft_id: string;
  opportunity_id: string;
  channel: string;
  status: string;
  attempts: number;
  provider_message_id: string | null;
  error_code: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// Verificación de perfil a través del proveedor inyectado (real o
// simulado). Un proveedor sin verifyProfile no puede verificar ni
// conectar: fail-closed, nunca un «connected» inventado.
async function providerVerifyProfile(
  provider: MailProvider,
  credentials: MailCredentials,
): Promise<{ email: string; credentials: MailCredentials }> {
  if (!provider.verifyProfile) {
    throw new ProviderError('not_supported', 'Este proveedor no admite verificación de cuenta');
  }
  return provider.verifyProfile(credentials);
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
  opportunity_id: string | null;
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

  // ---------- Interfaz web ----------
  // FLIP (cierre de la migración React): la app React pasa a ser la
  // principal en / (antes vivía en /v2/) y la app vanilla NO se
  // borra: queda en /vanilla/ con el mismo contenido de hoy, sin
  // cambios. Las rutas históricas /app.js y /styles/* siguen
  // sirviendo los archivos vanilla (compatibilidad: la vanilla de
  // /vanilla/ los referencia con rutas absolutas), y /v2 y /v2/*
  // redirigen a sus equivalentes en / para no romper marcadores.
  // No es un cambio de API: solo serving de archivos estáticos.
  const publicDir = new URL('../public/', import.meta.url);
  const clientDir = new URL('../client/dist/', import.meta.url);
  const CLIENT_EXTS = new Set(['js', 'css', 'svg', 'png', 'ico']);
  const CLIENT_TYPES: Record<string, string> = {
    js: 'application/javascript',
    css: 'text/css',
    svg: 'image/svg+xml',
    png: 'image/png',
    ico: 'image/x-icon',
  };
  // Hojas del sistema de diseño. Solo se sirven los archivos de la lista blanca;
  // cualquier otro nombre (incluidos intentos de salir del directorio) da 404.
  const STYLE_FILES = new Set(['tokens.css', 'base.css', 'components.css', 'layout.css']);
  // App React (principal). El build de Vite vive en client/dist
  // (gitignorado); si no está construido, / responde 404 en vez
  // de servir algo a medias.
  app.get('/', async (_req, reply) => {
    try {
      void reply.type('text/html').send(readFileSync(new URL('index.html', clientDir)));
    } catch {
      void reply.code(404).send({ error: 'No encontrado' });
    }
  });
  app.get('/assets/*', async (request, reply) => {
    const rest = (request.params as { '*': string })['*'] ?? '';
    const file = rest.split('/').filter(Boolean).pop() ?? '';
    const ext = file.includes('.') ? file.split('.').pop()! : '';
    if (!CLIENT_EXTS.has(ext) || rest.includes('..')) {
      void reply.code(404).send({ error: 'No encontrado' });
      return;
    }
    try {
      void reply.type(CLIENT_TYPES[ext]).send(readFileSync(new URL(`assets/${rest}`, clientDir)));
    } catch {
      void reply.code(404).send({ error: 'No encontrado' });
    }
  });
  // App vanilla (respaldo, contenido intacto).
  app.get('/vanilla', async (_req, reply) => {
    void reply.redirect('/vanilla/', 302);
  });
  app.get('/vanilla/', async (_req, reply) => {
    void reply.type('text/html').send(readFileSync(new URL('index.html', publicDir)));
  });
  app.get('/vanilla/app.js', async (_req, reply) => {
    void reply.type('application/javascript').send(readFileSync(new URL('app.js', publicDir)));
  });
  app.get('/vanilla/styles/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!STYLE_FILES.has(file)) {
      void reply.code(404).send({ error: 'No encontrado' });
      return;
    }
    void reply.type('text/css').send(readFileSync(new URL(`styles/${file}`, publicDir)));
  });
  // Rutas históricas vanilla (compatibilidad; la vanilla de
  // /vanilla/ las referencia con rutas absolutas).
  app.get('/app.js', async (_req, reply) => {
    void reply.type('application/javascript').send(readFileSync(new URL('app.js', publicDir)));
  });
  app.get('/styles/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!STYLE_FILES.has(file)) {
      void reply.code(404).send({ error: 'No encontrado' });
      return;
    }
    void reply.type('text/css').send(readFileSync(new URL(`styles/${file}`, publicDir)));
  });
  // Redirecciones desde la antigua convivencia en /v2/.
  app.get('/v2', async (_req, reply) => {
    void reply.redirect('/', 302);
  });
  app.get('/v2/', async (_req, reply) => {
    void reply.redirect('/', 302);
  });
  app.get('/v2/*', async (request, reply) => {
    const rest = (request.params as { '*': string })['*'] ?? '';
    if (rest.includes('..')) {
      void reply.redirect('/', 302);
      return;
    }
    void reply.redirect(`/${rest}`, 302);
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
      // H1: un agente en pausa bloquea el ingreso con 409 (conflicto
      // de estado), no con 500. No se creó oportunidad, tarea ni
      // borrador; la ejecución y la corrida fallidas quedan visibles.
      if (err instanceof AgentPausedError) {
        await reply.code(409).send({ error: 'agent_paused', message: err.message });
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
    const rows = await queryAll<OpportunityRow>(
      db,
      'SELECT * FROM opportunities WHERE org_id = ? ORDER BY created_at DESC LIMIT 100',
      user.orgId,
    );
    // A1, P1-1: el backfill de arranque calcula el puntaje de las filas
    // viejas, así que score no debería ser NULL; el ?? 0 es solo defensa
    // (0 es además el piso legítimo del clasificador).
    return { opportunities: rows.map((o) => ({ ...o, score: o.score ?? 0 })) };
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
    return { opportunity: { ...opp, score: opp.score ?? 0 } };
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
      // H1: igual que el alta manual. No se guarda clave de
      // idempotencia del intento bloqueado: al reanudar, el mismo
      // webhook vuelve a ingresar sin quedar marcado como duplicado.
      if (err instanceof AgentPausedError) {
        await reply.code(409).send({ error: 'agent_paused', message: err.message });
        return;
      }
      throw err;
    }
  });

  // ---------- Webhook de WhatsApp (Fase A: respuestas entrantes) ----------
  // Endpoint PÚBLICO por necesidad: Meta no inicia sesión en SIS, así
  // que no hay JWT. La única protección es criptográfica: verificación
  // por token en el GET y firma HMAC-SHA256 del cuerpo crudo en el
  // POST (misma función verifySignature que la ingesta, otra clave).
  // Sin secretos de operador configurados, el endpoint responde
  // cerrado (fail-closed): el GET exige token y el POST descarta
  // todo. Hacia afuera, el POST siempre responde 200 vacío, válido
  // o no: Meta reintenta lo que no es 200, el dedup hace seguros
  // los reintentos y no se filtra si algo falló. Excepción: un
  // cuerpo JSON malformado lo rechaza el parser compartido con 400
  // (Meta siempre envía JSON válido); un contenido que no sea
  // application/json responde 415 por el mismo parser.
  // Nunca se registra contenido de mensajes en logs: solo el
  // resultado del enrutado vive en la base, no en los registros.
  // Normalización canónica E.164: Meta envía `from` solo con dígitos
  // (sin +) mientras el contacto guardado lleva +; sin este paso, un
  // mensaje real nunca igualaría a su oportunidad.
  function normalizePhone(value: string): string {
    const digits = value.replace(/[\s\-()]/g, '');
    if (digits === '') return '';
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  interface InboundMessageRow {
    id: string;
    org_id: string;
    opportunity_id: string | null;
    provider_message_id: string;
    from_phone: string;
    message_type: string;
    body: string;
    received_at: string;
    created_at: string;
  }

  async function findOrgByWhatsappNumberId(phoneNumberId: string): Promise<string | null> {
    const conns = await queryAll<ConnectionRow>(
      db,
      "SELECT * FROM org_connections WHERE provider = 'whatsapp' AND credentials_ciphertext IS NOT NULL",
    );
    for (const conn of conns) {
      try {
        const creds = JSON.parse(
          decryptCredentials(conn.credentials_ciphertext!, opts.connectionEncryptionKey),
        ) as WhatsAppCredentials;
        if (creds.phone_number_id === phoneNumberId) return conn.org_id;
      } catch {
        // Sin clave de cifrado (o credencial corrupta) no se puede
        // enrutar: se descarta el evento, no se adivina la org.
        continue;
      }
    }
    return null;
  }

  async function matchOpportunityByPhone(orgId: string, fromPhone: string): Promise<string | null> {
    const opps = await queryAll<{ id: string; contact_phone: string | null; created_at: string }>(
      db,
      'SELECT id, contact_phone, created_at FROM opportunities WHERE org_id = ?',
      orgId,
    );
    const matches = opps.filter((o) => o.contact_phone && normalizePhone(o.contact_phone) === fromPhone);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0].id;
    // Varias con el mismo teléfono: la de envío de WhatsApp más
    // reciente; sin envíos, la creada más recientemente.
    const lastSent = await queryAll<{ opportunity_id: string; last_sent: string }>(
      db,
      "SELECT opportunity_id, MAX(created_at) AS last_sent FROM message_deliveries WHERE org_id = ? AND channel = 'whatsapp' GROUP BY opportunity_id",
      orgId,
    );
    const lastSentByOpp = new Map(lastSent.map((r) => [r.opportunity_id, r.last_sent]));
    matches.sort((a, b) => {
      const sa = lastSentByOpp.get(a.id) ?? '';
      const sb = lastSentByOpp.get(b.id) ?? '';
      if (sa !== sb) return sb.localeCompare(sa);
      return b.created_at.localeCompare(a.created_at);
    });
    return matches[0].id;
  }

  app.get('/api/webhooks/whatsapp', async (request, reply) => {
    const q = request.query as { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string };
    const configured = opts.metaWebhook?.verifyToken;
    if (
      q['hub.mode'] === 'subscribe' &&
      configured &&
      q['hub.verify_token'] === configured &&
      typeof q['hub.challenge'] === 'string'
    ) {
      await reply.type('text/plain').send(q['hub.challenge']);
      return;
    }
    await reply.code(403).send({ error: 'forbidden', message: 'Verificación del webhook no válida' });
  });

  app.post('/api/webhooks/whatsapp', async (request, reply) => {
    const done = () => reply.code(200).send('');
    const appSecret = opts.metaWebhook?.appSecret;
    if (!appSecret) return done();
    const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? '';
    if (!verifySignature(appSecret, rawBody, request.headers['x-hub-signature-256'] as string | undefined)) {
      return done();
    }
    const payload = (request.body ?? {}) as Record<string, unknown>;
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as { changes?: unknown }).changes)
        ? (entry as { changes: Array<Record<string, unknown>> }).changes
        : [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = (change.value ?? {}) as Record<string, unknown>;
        const metadata = (value.metadata ?? {}) as Record<string, unknown>;
        const phoneNumberId = typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : null;
        if (!phoneNumberId) continue;
        const orgId = await findOrgByWhatsappNumberId(phoneNumberId);
        if (!orgId) continue;
        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const raw of messages) {
          const msg = raw as Record<string, unknown>;
          // Solo texto en esta fase. El resto (imagen, audio, video,
          // documento, sticker) se ignora con 200, igual que los
          // recibos de estado (value.statuses): no cambian entregas.
          if (msg.type !== 'text' || typeof msg.id !== 'string' || typeof msg.from !== 'string') continue;
          const text = (msg.text ?? {}) as Record<string, unknown>;
          const body = typeof text.body === 'string' ? text.body : '';
          const existing = await queryOne<{ id: string }>(
            db,
            'SELECT id FROM inbound_messages WHERE org_id = ? AND provider_message_id = ?',
            orgId,
            msg.id,
          );
          if (existing) continue;
          const fromPhone = normalizePhone(msg.from);
          const opportunityId = await matchOpportunityByPhone(orgId, fromPhone);
          const receivedAt =
            typeof msg.timestamp === 'string' && /^\d+$/.test(msg.timestamp)
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : nowIso();
          const id = newId();
          await exec(
            db,
            'INSERT INTO inbound_messages (id, org_id, opportunity_id, provider_message_id, from_phone, message_type, body, received_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            id,
            orgId,
            opportunityId,
            msg.id,
            fromPhone,
            'text',
            body,
            receivedAt,
            nowIso(),
          );
          // Claves recipient/message: la vista de Actividad ya las
          // enmascara (mask.ts); el detalle completo vive solo en
          // la oportunidad y en la lista de revisión (con máscara).
          await audit(db, orgId, 'webhook:whatsapp', 'message.received', 'inbound_message', id, {
            channel: 'whatsapp',
            opportunityId,
            providerMessageId: msg.id,
            recipient: fromPhone,
            message: body,
          });
        }
      }
    }
    return done();
  });

  // Respuestas de una oportunidad (detalle: datos completos, como el
  // resto de Oportunidades) y respuestas sin coincidencia (revisión
  // manual: el cliente las muestra enmascaradas en la lista).
  app.get('/api/opportunities/:id/responses', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const opp = await queryOne<{ id: string }>(
      db,
      'SELECT id FROM opportunities WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!opp) {
      await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
      return;
    }
    const responses = await queryAll<InboundMessageRow>(
      db,
      'SELECT * FROM inbound_messages WHERE org_id = ? AND opportunity_id = ? ORDER BY received_at DESC, created_at DESC',
      user.orgId,
      id,
    );
    return { responses };
  });

  app.get('/api/inbound-messages/unmatched', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const responses = await queryAll<InboundMessageRow>(
      db,
      'SELECT * FROM inbound_messages WHERE org_id = ? AND opportunity_id IS NULL ORDER BY received_at DESC, created_at DESC LIMIT 200',
      user.orgId,
    );
    return { responses };
  });

  // Ventana derivada (Fase A): no es una columna, se calcula del
  // último mensaje entrante de ese contacto en las últimas 24 h.
  // Es solo una sugerencia para la UI: SIS nunca se niega a intentar
  // un envío por este cálculo; Meta sigue siendo la autoridad y
  // 131047 sigue mapeándose a window_closed como en F2.
  app.get('/api/opportunities/:id/whatsapp-window', { preHandler: auth }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const opp = await queryOne<{ contact_phone: string | null }>(
      db,
      'SELECT contact_phone FROM opportunities WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!opp) {
      await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
      return;
    }
    if (!opp.contact_phone) return { windowOpen: false, lastInboundAt: null };
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const row = await queryOne<{ last_inbound: string }>(
      db,
      'SELECT MAX(received_at) AS last_inbound FROM inbound_messages WHERE org_id = ? AND from_phone = ? AND received_at >= ?',
      user.orgId,
      normalizePhone(opp.contact_phone),
      cutoff,
    );
    return { windowOpen: row?.last_inbound != null, lastInboundAt: row?.last_inbound ?? null };
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
    // A2: task.updated cita a la oportunidad de la tarea, igual que
    // task.created y draft.created (engine.ts): así la línea de tiempo
    // de la oportunidad (GET /api/audit?opportunityId=) la incluye.
    await audit(db, user.orgId, user.email, 'task.updated', 'task', id, {
      status: body.status,
      opportunityId: task.opportunity_id,
    });
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
    const rows = await queryAll<
      DraftRow & {
        contact_name: string;
        company: string;
        opportunity_message: string;
        opportunity_source: string;
        delivery_id: string | null;
        delivery_channel: string | null;
        delivery_status: string | null;
        delivery_attempts: number | null;
        delivery_provider_message_id: string | null;
        delivery_error_code: string | null;
        delivery_error: string | null;
        delivery_created_at: string | null;
        delivery_updated_at: string | null;
      }
    >(
      db,
      `SELECT d.*, o.contact_name, o.company, o.message AS opportunity_message, o.source AS opportunity_source,
              md.id AS delivery_id, md.channel AS delivery_channel, md.status AS delivery_status,
              md.attempts AS delivery_attempts, md.provider_message_id AS delivery_provider_message_id,
              md.error_code AS delivery_error_code, md.error AS delivery_error,
              md.created_at AS delivery_created_at, md.updated_at AS delivery_updated_at
       FROM drafts d
       JOIN opportunities o ON o.id = d.opportunity_id
       LEFT JOIN message_deliveries md ON md.draft_id = d.id
       WHERE d.org_id = ? ORDER BY d.created_at DESC`,
      user.orgId,
    );
    return {
      drafts: rows.map((d) => ({
        ...draftOut(d),
        expired: isDraftExpired(d, expiryMs),
        stale: isDraftStale(d, d.opportunity_message),
        delivery: d.delivery_id
          ? {
              id: d.delivery_id,
              channel: d.delivery_channel,
              status: d.delivery_status,
              attempts: d.delivery_attempts,
              provider_message_id: d.delivery_provider_message_id,
              error_code: d.delivery_error_code,
              error: d.delivery_error,
              created_at: d.delivery_created_at,
              updated_at: d.delivery_updated_at,
            }
          : null,
      })),
    };
  });

  // ---------- Conexiones de envío (F1) ----------
  // Solo datos no secretos: ningún endpoint devuelve credenciales, ni
  // siquiera al admin de la org (ver connectionOut).
  app.get('/api/connections', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const rows = await queryAll<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE org_id = ? ORDER BY provider ASC',
      user.orgId,
    );
    return { connections: rows.map(connectionOut) };
  });

  // Inicio de OAuth de Google (solo admin). Sin credenciales de
  // operador configuradas responde 503: nunca se finge un flujo.
  app.post('/api/connections/gmail/oauth/start', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const user = getUser(request);
    if (!opts.googleOAuth) {
      await reply.code(503).send({
        error: 'not_configured',
        message: 'La conexión con Gmail no está configurada en el servidor',
      });
      return;
    }
    const state = signOAuthState(opts.jwtSecret, user.orgId, user.email);
    await reply.send({
      url: buildGoogleAuthUrl({
        clientId: opts.googleOAuth.clientId,
        redirectUri: opts.googleOAuth.redirectUri,
        state,
      }),
    });
  });

  // Callback de OAuth de Google (lo llama el navegador tras consentir;
  // el state firmado ata org, admin y vencimiento, así que no necesita
  // sesión: se verifica la firma, el vencimiento y que el correo sea
  // admin de esa org). Intercambia el código, verifica el perfil real
  // y guarda los tokens cifrados. Redirige a la app: el estado real
  // se consulta con GET /api/connections.
  app.get('/api/connections/gmail/oauth/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const failRedirect = '/?connection=gmail&status=error';
    if (query.error || !query.code || !query.state || !opts.googleOAuth) {
      await reply.redirect(failRedirect);
      return;
    }
    const verified = verifyOAuthState(opts.jwtSecret, query.state);
    if (!verified) {
      await reply.redirect(failRedirect);
      return;
    }
    const admin = await queryOne<UserRow>(
      db,
      'SELECT * FROM users WHERE org_id = ? AND email = ? AND role = ?',
      verified.orgId,
      verified.email.toLowerCase(),
      'admin',
    );
    if (!admin) {
      await reply.redirect(failRedirect);
      return;
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: query.code,
          client_id: opts.googleOAuth.clientId,
          client_secret: opts.googleOAuth.clientSecret,
          redirect_uri: opts.googleOAuth.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!tokenRes.ok) {
        await reply.redirect(failRedirect);
        return;
      }
      const tokens = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (!tokens.access_token) {
        await reply.redirect(failRedirect);
        return;
      }
      const credentials: MailCredentials = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      };
      const provider = opts.mailProvider ?? new GmailMailProvider(opts.googleOAuth);
      const { email: profileEmail, credentials: verifiedCredentials } =
        await providerVerifyProfile(provider, credentials);
      const now = nowIso();
      const existing = await queryOne<ConnectionRow>(
        db,
        'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
        verified.orgId,
        'gmail',
      );
      const ciphertext = encryptCredentials(JSON.stringify(verifiedCredentials), opts.connectionEncryptionKey);
      if (existing) {
        await exec(
          db,
          'UPDATE org_connections SET status = ?, display_account = ?, credentials_ciphertext = ?, last_verified_at = ?, last_error = NULL, updated_at = ? WHERE id = ?',
          'connected',
          profileEmail,
          ciphertext,
          now,
          now,
          existing.id,
        );
      } else {
        await exec(
          db,
          'INSERT INTO org_connections (id, org_id, provider, status, display_account, credentials_ciphertext, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          newId(),
          verified.orgId,
          'gmail',
          'connected',
          profileEmail,
          ciphertext,
          now,
          now,
          now,
        );
      }
      await reply.redirect('/?connection=gmail&status=connected');
    } catch {
      await reply.redirect(failRedirect);
    }
  });

  // F2: registro de la conexión WhatsApp Business por org (solo
  // admin). A diferencia de Gmail no hay OAuth de navegador: el
  // operador carga número Business + ID de número + token de
  // sistema de la cuenta, y el servidor verifica de verdad contra
  // la Graph API de Meta antes de marcar 'connected'. Sin clave de
  // cifrado el módulo está cerrado (503, fail-closed). Si la
  // verificación falla, la fila queda en 'error' con el motivo (sin
  // secretos) y se responde 409: el admin la puede re-verificar
  // tras corregir los datos en Meta. El token nunca sale en la
  // respuesta (ver connectionOut).
  app.post('/api/connections/whatsapp', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const user = getUser(request);
    const parsed = whatsappConnectionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'validation',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (!opts.connectionEncryptionKey) {
      await reply.code(503).send({
        error: 'not_configured',
        message: 'La conexión con WhatsApp no está configurada en el servidor',
      });
      return;
    }
    const credentials: WhatsAppCredentials = {
      phone_number_id: parsed.data.phoneNumberId,
      token: parsed.data.token,
    };
    const provider = opts.whatsappProvider ?? new WhatsAppCloudProvider();
    const now = nowIso();
    const existing = await queryOne<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
      user.orgId,
      'whatsapp',
    );
    const ciphertext = encryptCredentials(JSON.stringify(credentials), opts.connectionEncryptionKey);
    const upsert = async (status: string, displayAccount: string, lastError: string | null) => {
      if (existing) {
        await exec(
          db,
          'UPDATE org_connections SET status = ?, display_account = ?, credentials_ciphertext = ?, last_verified_at = ?, last_error = ?, updated_at = ? WHERE id = ?',
          status,
          displayAccount,
          ciphertext,
          status === 'connected' ? now : existing.last_verified_at,
          lastError,
          now,
          existing.id,
        );
      } else {
        await exec(
          db,
          'INSERT INTO org_connections (id, org_id, provider, status, display_account, credentials_ciphertext, last_verified_at, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          newId(),
          user.orgId,
          'whatsapp',
          status,
          displayAccount,
          ciphertext,
          status === 'connected' ? now : null,
          lastError,
          now,
          now,
        );
      }
      return (await queryOne<ConnectionRow>(
        db,
        'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
        user.orgId,
        'whatsapp',
      ))!;
    };
    try {
      const { displayPhoneNumber } = await provider.verify(credentials);
      const saved = await upsert('connected', displayPhoneNumber, null);
      await reply.send({ connection: connectionOut(saved) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'La verificación falló';
      const saved = await upsert('error', parsed.data.phoneNumber, message.slice(0, 500));
      await reply.code(409).send({
        error: 'connection_error',
        message,
        connection: connectionOut(saved),
      });
    }
  });

  // Re-verificación de una conexión (solo admin; Gmail en F1,
  // WhatsApp en F2). Vuelve a verificar contra el proveedor real y
  // actualiza el estado: nunca un «connected» inventado.
  app.post('/api/connections/:id/verify', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const conn = await queryOne<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!conn) {
      await reply.code(404).send({ error: 'not_found', message: 'Conexión no encontrada' });
      return;
    }
    if ((conn.provider !== 'gmail' && conn.provider !== 'whatsapp') || !conn.credentials_ciphertext) {
      await reply.code(409).send({ error: 'not_supported', message: 'Esta conexión no se puede verificar' });
      return;
    }
    if (conn.provider === 'whatsapp') {
      try {
        const credentials = JSON.parse(
          decryptCredentials(conn.credentials_ciphertext, opts.connectionEncryptionKey),
        ) as WhatsAppCredentials;
        const provider = opts.whatsappProvider ?? new WhatsAppCloudProvider();
        const { displayPhoneNumber } = await provider.verify(credentials);
        await exec(
          db,
          'UPDATE org_connections SET status = ?, display_account = ?, last_verified_at = ?, last_error = NULL, updated_at = ? WHERE id = ?',
          'connected',
          displayPhoneNumber,
          nowIso(),
          nowIso(),
          conn.id,
        );
        await reply.send({ connection: connectionOut((await queryOne<ConnectionRow>(db, 'SELECT * FROM org_connections WHERE id = ?', id))!) });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'La verificación falló';
        await exec(
          db,
          'UPDATE org_connections SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
          'error',
          message.slice(0, 500),
          nowIso(),
          conn.id,
        );
        await reply.code(409).send({ error: 'connection_error', message });
      }
      return;
    }
    try {
      const credentials = JSON.parse(
        decryptCredentials(conn.credentials_ciphertext, opts.connectionEncryptionKey),
      ) as MailCredentials;
      const provider = opts.mailProvider ?? (opts.googleOAuth ? new GmailMailProvider(opts.googleOAuth) : undefined);
      if (!provider) {
        throw new ProviderError('connection_error', 'El envío por correo no está configurado en el servidor');
      }
      const { email, credentials: fresh } = await providerVerifyProfile(provider, credentials);
      await exec(
        db,
        'UPDATE org_connections SET status = ?, display_account = ?, credentials_ciphertext = ?, last_verified_at = ?, last_error = NULL, updated_at = ? WHERE id = ?',
        'connected',
        email,
        encryptCredentials(JSON.stringify(fresh), opts.connectionEncryptionKey),
        nowIso(),
        nowIso(),
        conn.id,
      );
      await reply.send({ connection: connectionOut((await queryOne<ConnectionRow>(db, 'SELECT * FROM org_connections WHERE id = ?', id))!) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'La verificación falló';
      await exec(
        db,
        'UPDATE org_connections SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
        'error',
        message.slice(0, 500),
        nowIso(),
        conn.id,
      );
      await reply.code(409).send({ error: 'connection_error', message });
    }
  });

  // Desconexión (solo admin): borra el secreto y marca revocada. No
  // borra las entregas ya registradas (la auditoría no se reescribe).
  app.post('/api/connections/:id/disconnect', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const conn = await queryOne<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!conn) {
      await reply.code(404).send({ error: 'not_found', message: 'Conexión no encontrada' });
      return;
    }
    await exec(
      db,
      'UPDATE org_connections SET status = ?, credentials_ciphertext = NULL, updated_at = ? WHERE id = ?',
      'revoked',
      nowIso(),
      id,
    );
    await reply.send({ connection: connectionOut((await queryOne<ConnectionRow>(db, 'SELECT * FROM org_connections WHERE id = ?', id))!) });
  });

  // Reintento de una entrega fallida (solo admin, con tope por
  // política send.retry.*). Nunca reenvía una entrega ya enviada.
  app.post('/api/deliveries/:id/retry', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const delivery = await queryOne<DeliveryRow>(
      db,
      'SELECT * FROM message_deliveries WHERE id = ? AND org_id = ?',
      id,
      user.orgId,
    );
    if (!delivery) {
      await reply.code(404).send({ error: 'not_found', message: 'Entrega no encontrada' });
      return;
    }
    if (delivery.status !== 'failed') {
      await reply.code(409).send({ error: 'conflict', message: 'Solo se pueden reintentar entregas fallidas' });
      return;
    }
    const policies = await loadPolicies();
    if (policies['send.retry.admin_only'] !== 'false' && user.role !== 'admin') {
      await reply.code(403).send({ error: 'forbidden', message: 'Se requiere rol admin' });
      return;
    }
    const maxRaw = Number(policies['send.retry.max_attempts'] ?? 3);
    const maxAttempts = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 3;
    if (delivery.attempts >= maxAttempts) {
      await reply.code(409).send({
        error: 'retry_limit',
        message: `Esta entrega ya alcanzó el máximo de ${maxAttempts} reintentos`,
      });
      return;
    }
    const sender = await queryOne<{ paused: number | null }>(
      db,
      'SELECT paused FROM agents WHERE id = ?',
      'response_proposal',
    );
    if (sender && Number(sender.paused ?? 0) === 1) {
      await reply.code(409).send({
        error: 'agent_paused',
        message: 'El agente Respuesta y propuesta está en pausa; el envío quedó bloqueado hasta que se reanude.',
      });
      return;
    }
    const conn = await queryOne<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
      user.orgId,
      delivery.channel,
    );
    if (!conn || conn.status !== 'connected') {
      await reply.code(409).send({
        error: 'channel_unavailable',
        message: 'La organización ya no tiene ese canal conectado',
      });
      return;
    }
    const opp = await queryOne<OpportunityRow>(db, 'SELECT * FROM opportunities WHERE id = ?', delivery.opportunity_id);
    const org = (await queryOne<OrgRow>(db, 'SELECT * FROM organizations WHERE id = ?', user.orgId))!;
    if (!opp) {
      await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
      return;
    }
    const draft = await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', delivery.draft_id);
    if (!draft) {
      await reply.code(404).send({ error: 'not_found', message: 'Borrador no encontrado' });
      return;
    }
    const updated = await attemptDelivery(delivery, draft.body, opp, org);
    await reply.send({ delivery: updated });
  });

  // F1: intento de envío de una entrega. La entrega ya existe en
  // estado pending (creada antes de llamar al proveedor, así que un
  // corte no la pierde: queda pending y el reintento la retoma). En
  // plan gratis sin worker esto corre sincrónico dentro de aprobar;
  // el registro es el mismo cuando haya worker. El destinatario va
  // completo en el detalle de auditoría: la vista de Actividad lo
  // enmascara por la clave `recipient` (ver lib/mask.ts); nunca se
  // guarda el cuerpo del mensaje en el error, solo el código y un
  // texto genérico del proveedor.
  const attemptDelivery = async (
    delivery: DeliveryRow,
    body: string,
    opp: { contact_email: string; contact_phone: string | null },
    org: OrgRow,
  ): Promise<DeliveryRow> => {
    // El destinatario del evento va completo en auditoría (la vista
    // de Actividad lo enmascara por la clave `recipient`): correo
    // para Gmail, teléfono para WhatsApp.
    const recipient = delivery.channel === 'whatsapp' ? (opp.contact_phone ?? '') : opp.contact_email;
    const fail = async (code: string, message: string): Promise<DeliveryRow> => {
      await exec(
        db,
        'UPDATE message_deliveries SET status = ?, attempts = ?, error_code = ?, error = ?, updated_at = ? WHERE id = ?',
        'failed',
        delivery.attempts + 1,
        code,
        message.slice(0, 500),
        nowIso(),
        delivery.id,
      );
      await audit(db, delivery.org_id, 'agent:response_proposal', 'message.failed', 'delivery', delivery.id, {
        channel: delivery.channel,
        draftId: delivery.draft_id,
        opportunityId: delivery.opportunity_id,
        recipient,
        errorCode: code,
      });
      return (await queryOne<DeliveryRow>(db, 'SELECT * FROM message_deliveries WHERE id = ?', delivery.id))!;
    };
    const markSent = async (providerMessageId: string): Promise<DeliveryRow> => {
      await exec(
        db,
        'UPDATE message_deliveries SET status = ?, attempts = ?, provider_message_id = ?, error_code = NULL, error = NULL, updated_at = ? WHERE id = ?',
        'sent',
        delivery.attempts + 1,
        providerMessageId,
        nowIso(),
        delivery.id,
      );
      await audit(db, delivery.org_id, 'agent:response_proposal', 'message.sent', 'delivery', delivery.id, {
        channel: delivery.channel,
        draftId: delivery.draft_id,
        opportunityId: delivery.opportunity_id,
        providerMessageId,
        recipient,
      });
      return (await queryOne<DeliveryRow>(db, 'SELECT * FROM message_deliveries WHERE id = ?', delivery.id))!;
    };
    const conn = await queryOne<ConnectionRow>(
      db,
      'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
      delivery.org_id,
      delivery.channel,
    );
    if (!conn || conn.status !== 'connected' || !conn.credentials_ciphertext) {
      return fail(
        'connection_error',
        delivery.channel === 'whatsapp'
          ? 'La organización no tiene WhatsApp conectado'
          : 'La organización no tiene Gmail conectado',
      );
    }
    if (delivery.channel === 'gmail') {
      let credentials: MailCredentials;
      try {
        credentials = JSON.parse(
          decryptCredentials(conn.credentials_ciphertext, opts.connectionEncryptionKey),
        ) as MailCredentials;
      } catch (err) {
        return fail(
          'connection_error',
          err instanceof Error ? err.message : 'No se pudo leer la credencial de Gmail',
        );
      }
      const provider = opts.mailProvider ?? (opts.googleOAuth ? new GmailMailProvider(opts.googleOAuth) : undefined);
      if (!provider) {
        return fail('connection_error', 'El envío por correo no está configurado en el servidor');
      }
      try {
        const result = await provider.send({
          to: opp.contact_email,
          subject: `Respuesta de ${org.name}`,
          body,
          credentials,
        });
        if (result.refreshedCredentials) {
          await exec(
            db,
            'UPDATE org_connections SET credentials_ciphertext = ?, updated_at = ? WHERE id = ?',
            encryptCredentials(JSON.stringify(result.refreshedCredentials), opts.connectionEncryptionKey),
            nowIso(),
            conn.id,
          );
        }
        return await markSent(result.providerMessageId);
      } catch (err) {
        const code =
          err instanceof ProviderError
            ? err.code
            : err instanceof ConnectionKeyMissingError
              ? 'connection_error'
              : 'provider_error';
        return fail(code, err instanceof Error ? err.message : 'El envío falló');
      }
    }
    if (delivery.channel === 'whatsapp') {
      // F2: el cuerpo enviado es el borrador aprobado vigente, ni más
      // ni menos (igual que Gmail). Sin teléfono no hay destinatario:
      // eso ya se bloquea al aprobar, pero el reintento lo vuelve a
      // verificar por si el dato cambió.
      if (!opp.contact_phone) {
        return fail('connection_error', 'La oportunidad no tiene teléfono para WhatsApp');
      }
      let credentials: WhatsAppCredentials;
      try {
        credentials = JSON.parse(
          decryptCredentials(conn.credentials_ciphertext, opts.connectionEncryptionKey),
        ) as WhatsAppCredentials;
      } catch (err) {
        return fail(
          'connection_error',
          err instanceof Error ? err.message : 'No se pudo leer la credencial de WhatsApp',
        );
      }
      const provider = opts.whatsappProvider ?? new WhatsAppCloudProvider();
      try {
        const result = await provider.send({
          to: opp.contact_phone,
          phoneNumberId: credentials.phone_number_id,
          body,
          credentials,
        });
        return await markSent(result.providerMessageId);
      } catch (err) {
        const code =
          err instanceof ProviderError
            ? err.code
            : err instanceof ConnectionKeyMissingError
              ? 'connection_error'
              : 'provider_error';
        return fail(code, err instanceof Error ? err.message : 'El envío falló');
      }
    }
    return fail('not_supported', 'El envío por este canal todavía no está disponible');
  };

  const decideDraft = async (
    request: FastifyRequest,
    reply: FastifyReply,
    decision: 'approved' | 'rejected',
    approveChannel?: 'gmail' | 'whatsapp' | null,
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
    // F1: la oportunidad completa se necesita para el envío (correo y
    // teléfono del destinatario) además del mensaje para el chequeo
    // de desactualización.
    const opp = await queryOne<OpportunityRow>(
      db,
      'SELECT * FROM opportunities WHERE id = ?',
      draft.opportunity_id,
    );
    if (decision === 'approved') {
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
      if (approveChannel) {
        // F1, variante explícita (decisión de Tomás 28-oct-2026: el
        // admin elige el canal al aprobar). Pre-chequeo de pausa
        // ANTES de decidir, mismo criterio H1 del intake: si el agente
        // que envía está en pausa, no se decide nada y el borrador
        // queda pendiente para cuando se reanude.
        const sender = await queryOne<{ paused: number | null }>(
          db,
          'SELECT paused FROM agents WHERE id = ?',
          'response_proposal',
        );
        if (sender && Number(sender.paused ?? 0) === 1) {
          await reply.code(409).send({
            error: 'agent_paused',
            message: 'El agente Respuesta y propuesta está en pausa; el envío quedó bloqueado hasta que se reanude.',
          });
          return;
        }
        const conn = await queryOne<ConnectionRow>(
          db,
          'SELECT * FROM org_connections WHERE org_id = ? AND provider = ?',
          user.orgId,
          approveChannel,
        );
        if (!conn || conn.status !== 'connected') {
          await reply.code(409).send({
            error: 'channel_unavailable',
            message:
              approveChannel === 'whatsapp'
                ? 'La organización no tiene WhatsApp conectado'
                : 'La organización no tiene Gmail conectado',
          });
          return;
        }
        if (approveChannel === 'whatsapp' && !opp.contact_phone) {
          // F2: sin teléfono no hay destinatario. Se bloquea ANTES
          // de decidir, como el resto del pre-chequeo: el borrador
          // queda pendiente y el admin corrige y reintenta.
          await reply.code(409).send({
            error: 'channel_unavailable',
            message: 'La oportunidad no tiene teléfono para WhatsApp',
          });
          return;
        }
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
    // F1 (decisión de Tomás 28-oct-2026): aprobar con canal elegido
    // envía el borrador por ese canal a cargo del agente Respuesta y
    // propuesta; sin canal, aprobar funciona exactamente como antes
    // (la oportunidad pasa a seguimiento, sin envío). Rechazar
    // devuelve la oportunidad a nueva, como siempre.
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
    let delivery: DeliveryRow | null = null;
    if (decision === 'approved' && approveChannel && opp) {
      const org = (await queryOne<OrgRow>(db, 'SELECT * FROM organizations WHERE id = ?', user.orgId))!;
      const deliveryId = newId();
      await exec(
        db,
        'INSERT INTO message_deliveries (id, org_id, draft_id, opportunity_id, channel, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        deliveryId,
        user.orgId,
        id,
        draft.opportunity_id,
        approveChannel,
        'pending',
        0,
        nowIso(),
        nowIso(),
      );
      const created = (await queryOne<DeliveryRow>(db, 'SELECT * FROM message_deliveries WHERE id = ?', deliveryId))!;
      const decided = (await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', id))!;
      delivery = await attemptDelivery(created, decided.body, opp, org);
    }
    await reply.send({
      draft: draftOut((await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', id))!),
      delivery,
    });
  };

  app.post('/api/drafts/:id/approve', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const parsed = draftApproveSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'validation',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    await decideDraft(request, reply, 'approved', parsed.data.channel ?? null);
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

  // R3b: edición del borrador por un humano. Solo admin (mismo
  // requireAdmin que decidir) y solo pendiente vigente: los
  // chequeos C5 se reutilizan tal cual (vencido y desactualizado
  // dan los mismos códigos que al aprobar). Editar NO cambia el
  // vencimiento (sigue contando desde created_at) ni afecta la
  // desactualización (que compara el mensaje de la oportunidad
  // con source_message, no con body): solo reemplaza el texto y
  // marca el borrador como editado, con evento de auditoría que
  // guarda el cuerpo anterior para trazabilidad.
  app.patch('/api/drafts/:id', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const parsed = draftEditSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'validation',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const draft = await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ? AND org_id = ?', id, user.orgId);
    if (!draft) {
      await reply.code(404).send({ error: 'not_found', message: 'Borrador no encontrado' });
      return;
    }
    if (draft.status !== 'pending_approval') {
      await reply.code(409).send({ error: 'conflict', message: 'El borrador ya fue decidido' });
      return;
    }
    const policies = await loadPolicies();
    const expiryDays = Number(policies['draft.expiry_days'] ?? 7);
    if (isDraftExpired(draft, draftExpiryMs(policies))) {
      await reply.code(409).send({
        error: 'draft_expired',
        message: `El borrador venció: pasaron más de ${Number.isFinite(expiryDays) && expiryDays > 0 ? expiryDays : 7} días desde que se creó y ya no se puede editar`,
      });
      return;
    }
    const opp = await queryOne<{ message: string }>(
      db,
      'SELECT message FROM opportunities WHERE id = ?',
      draft.opportunity_id,
    );
    if (!opp) {
      await reply.code(404).send({ error: 'not_found', message: 'Oportunidad no encontrada' });
      return;
    }
    if (isDraftStale(draft, opp.message)) {
      await reply.code(409).send({
        error: 'draft_stale',
        message: 'El borrador quedó desactualizado: el mensaje de la oportunidad cambió desde que se creó y ya no se puede editar',
      });
      return;
    }
    await exec(
      db,
      'UPDATE drafts SET body = ?, edited = 1, edited_at = ? WHERE id = ?',
      parsed.data.body,
      nowIso(),
      id,
    );
    await audit(db, user.orgId, user.email, 'draft.edited', 'draft', id, {
      opportunityId: draft.opportunity_id,
      previousBody: draft.body,
    });
    const updated = await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', id);
    await reply.send({ draft: draftOut(updated!) });
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
    let result;
    try {
      result = await runIntake(db, user.orgId, input, {
        actor: user.email,
        maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
        retryOf: rootId,
      });
    } catch (err) {
      // H1: reintentar con un agente en pausa también se bloquea
      // con 409, igual que el ingreso nuevo.
      if (err instanceof AgentPausedError) {
        await reply.code(409).send({ error: 'agent_paused', message: err.message });
        return;
      }
      throw err;
    }
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
  // H1: suma el estado derivado (paused/busy/available), el flag de
  // pausa y las tareas abiertas por agente. Los campos de C4 no
  // cambian: esto es aditivo.
  app.get('/api/agents', { preHandler: auth }, async () => {
    // Conteos en consulta agrupada separada, no en subconsulta
    // correlacionada: pg-mem (tests de Postgres) no resuelve la
    // referencia externa, igual que pasó en C3 con NOT EXISTS.
    const rows = await queryAll<AgentRow>(db, 'SELECT * FROM agents ORDER BY sort_order ASC');
    const counts = await queryAll<{ agent_id: string; c: number }>(
      db,
      "SELECT agent_id, COUNT(*) AS c FROM tasks WHERE status = 'open' GROUP BY agent_id",
    );
    const openByAgent = new Map(counts.map((c) => [c.agent_id, Number(c.c ?? 0)]));
    return {
      agents: rows.map((a) => {
        const paused = Number(a.paused ?? 0) === 1;
        const openTasks = openByAgent.get(a.id) ?? 0;
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          steps: JSON.parse(a.steps_json) as string[],
          paused,
          openTasks,
          status: agentStatus(paused, openTasks),
        };
      }),
    };
  });

  // H1: pausar/reanudar un agente (solo admin, como aprobar y
  // reintentar). La pausa es global (el catálogo es global): vale
  // para todas las organizaciones. El cambio queda en auditoría con
  // el agente y el valor. Errores: 400 body inválido, 403 member,
  // 404 agente inexistente.
  app.patch('/api/agents/:id/paused', { preHandler: [auth, requireAdmin] }, async (request, reply) => {
    const body = parse(z.object({ paused: z.boolean() }), request.body, reply);
    if (!body) return;
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const row = await queryOne<AgentRow>(db, 'SELECT * FROM agents WHERE id = ?', id);
    if (!row) {
      await reply.code(404).send({ error: 'not_found', message: 'Agente no encontrado' });
      return;
    }
    await exec(db, 'UPDATE agents SET paused = ? WHERE id = ?', body.paused ? 1 : 0, id);
    await audit(db, user.orgId, user.email, body.paused ? 'agent.paused' : 'agent.resumed', 'agent', id, {
      paused: body.paused,
    });
    const updated = (await queryOne<AgentRow>(db, 'SELECT * FROM agents WHERE id = ?', id))!;
    const openRow = await queryOne<{ c: number }>(
      db,
      "SELECT COUNT(*) AS c FROM tasks WHERE agent_id = ? AND status = 'open'",
      id,
    );
    const paused = Number(updated.paused ?? 0) === 1;
    const openTasks = Number(openRow?.c ?? 0);
    await reply.send({
      agent: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        steps: JSON.parse(updated.steps_json) as string[],
        paused,
        openTasks,
        status: agentStatus(paused, openTasks),
      },
    });
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
    // H1: la oportunidad vinculada (por el JOIN barato y portable) da la
    // columna Cliente real de Inicio; sin vínculo, opportunity es null
    // y la UI muestra "—". La etapa actual no va en la lista: se deriva
    // en el detalle (con pasos, borrador y tarea), y la vista Inicio
    // carga el detalle solo de las filas que muestra (máx. 8).
    const rows = await queryAll<
      ProcessRunRow & { execution_id: string | null; execution_status: string | null; opp_contact: string | null; opp_company: string | null }
    >(
      db,
      `SELECT pr.id, pr.org_id, pr.workflow, pr.workflow_version, pr.status,
              pr.created_at, pr.updated_at,
              e.id AS execution_id, e.status AS execution_status,
              o.contact_name AS opp_contact, o.company AS opp_company
       FROM process_runs pr LEFT JOIN executions e ON e.id = pr.execution_id
       LEFT JOIN opportunities o ON o.id = pr.opportunity_id
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
        opportunity:
          r.opp_contact !== null || r.opp_company !== null
            ? { contact_name: r.opp_contact, company: r.opp_company }
            : null,
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
    // H1: etapas derivadas (campo aditivo `stages`; el contrato
    // anterior { process, execution } no cambia). La oportunidad se
    // resuelve por opportunity_id y, si la corrida es anterior a H1
    // y el backfill no la cubrió, parseando result_json en código.
    let opportunityId: string | null = run.opportunity_id ?? null;
    if (!opportunityId && execution?.result_json) {
      try {
        const parsed = JSON.parse(execution.result_json) as { opportunity?: { id?: unknown } };
        if (typeof parsed.opportunity?.id === 'string') opportunityId = parsed.opportunity.id;
      } catch {
        opportunityId = null;
      }
    }
    const opportunity = opportunityId
      ? await queryOne<OpportunityRow>(db, 'SELECT * FROM opportunities WHERE id = ? AND org_id = ?', opportunityId, user.orgId)
      : undefined;
    const steps = execution
      ? await queryAll<{ step: string; status: string }>(
          db,
          'SELECT step, status FROM execution_steps WHERE execution_id = ? ORDER BY created_at ASC',
          execution.id,
        )
      : [];
    const draft = opportunity
      ? await queryOne<{ status: string; source_message: string | null; created_at: string }>(
          db,
          'SELECT status, source_message, created_at FROM drafts WHERE org_id = ? AND opportunity_id = ? ORDER BY created_at DESC LIMIT 1',
          user.orgId,
          opportunity.id,
        )
      : undefined;
    const openTask = opportunity
      ? await queryOne<{ title: string }>(
          db,
          "SELECT title FROM tasks WHERE org_id = ? AND opportunity_id = ? AND status = 'open' ORDER BY created_at ASC LIMIT 1",
          user.orgId,
          opportunity.id,
        )
      : undefined;
    const policies = await loadPolicies();
    const agentRows = await queryAll<{ id: string; name: string }>(db, 'SELECT id, name FROM agents');
    const agentNames = Object.fromEntries(agentRows.map((a) => [a.id, a.name]));
    const derivation = deriveStages({
      steps,
      runStatus: run.status,
      executionError: execution?.error ?? null,
      opportunity: opportunity
        ? {
            status: opportunity.status,
            contact_name: opportunity.contact_name,
            contact_email: opportunity.contact_email,
            company: opportunity.company,
            message: opportunity.message,
            category: opportunity.category,
            priority: opportunity.priority,
          }
        : null,
      draft: draft ?? null,
      openTaskTitle: openTask?.title ?? null,
      expiryMs: draftExpiryMs(policies),
      agentNames,
    });
    return {
      process: run,
      execution: execution ?? null,
      stages: derivation.stages as Stage[],
      currentStageId: derivation.currentStageId,
      opportunity: opportunity
        ? {
            id: opportunity.id,
            contact_name: opportunity.contact_name,
            company: opportunity.company,
            status: opportunity.status,
          }
        : null,
    };
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
      // H1: conteos de procesos para las tarjetas de Inicio. Los
      // campos anteriores no cambian.
      runningProcesses: await one(
        "SELECT COUNT(*) AS c FROM process_runs WHERE org_id = ? AND status = 'running'",
        user.orgId,
      ),
      doneProcesses: await one(
        "SELECT COUNT(*) AS c FROM process_runs WHERE org_id = ? AND status = 'done'",
        user.orgId,
      ),
      createdToday,
      maxPerDay: opts.maxOpportunitiesPerDay,
    };
  });
}
