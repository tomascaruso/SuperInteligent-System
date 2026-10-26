import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit, exec, newId, nowIso, queryAll, queryOne, todayUtc, type Db, type Param } from './db.js';
import {
  draftRejectSchema,
  loginSchema,
  opportunityInputSchema,
  registerSchema,
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
import { LimitExceededError, runIntake, type OpportunityRow } from './engine.js';

export const SERVICE_VERSION = '0.1.0';

export interface RouteOptions {
  jwtSecret: string;
  maxOpportunitiesPerDay: number;
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

interface TaskRow {
  id: string;
  org_id: string;
  opportunity_id: string;
  title: string;
  assigned_to: string;
  status: string;
  due_at: string;
  created_at: string;
  updated_at: string;
}

interface DraftRow {
  id: string;
  org_id: string;
  opportunity_id: string;
  body: string;
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
  status: string;
  result_json: string | null;
  error: string | null;
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

  // ---------- Interfaz web mínima (sin framework) ----------
  const publicDir = new URL('../public/', import.meta.url);
  app.get('/', async (_req, reply) => {
    void reply.type('text/html').send(readFileSync(new URL('index.html', publicDir)));
  });
  app.get('/app.js', async (_req, reply) => {
    void reply.type('application/javascript').send(readFileSync(new URL('app.js', publicDir)));
  });

  // ---------- Auth ----------
  app.post('/api/auth/register', async (request, reply) => {
    const body = parse(registerSchema, request.body, reply);
    if (!body) return;
    const existing = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE email = ?', body.email.toLowerCase());
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
      body.orgName,
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
      body.email.toLowerCase(),
      hashPassword(body.password),
      'admin',
      nowIso(),
    );
    await audit(db, orgId, body.email.toLowerCase(), 'org.created', 'organization', orgId, {});
    const user = { id: userId, orgId, role: 'admin' as const, email: body.email.toLowerCase(), name: body.name };
    await reply.code(201).send({
      token: signToken(opts.jwtSecret, user),
      org: { id: orgId, name: body.orgName, webhook_secret: webhookSecret },
      user: { id: userId, name: body.name, email: user.email, role: 'admin' },
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = parse(loginSchema, request.body, reply);
    if (!body) return;
    const row = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE email = ?', body.email.toLowerCase());
    if (!row || !verifyPassword(body.password, row.password_hash)) {
      await reply.code(401).send({ error: 'unauthorized', message: 'Credenciales inválidas' });
      return;
    }
    const user = { id: row.id, orgId: row.org_id, role: row.role as 'admin' | 'member', email: row.email, name: row.name };
    await audit(db, row.org_id, row.email, 'user.login', 'user', row.id, {});
    await reply.send({
      token: signToken(opts.jwtSecret, user),
      org: { id: row.org_id },
      user: { id: row.id, name: row.name, email: row.email, role: row.role },
    });
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
    const rows = status
      ? await queryAll<TaskRow>(db, 'SELECT * FROM tasks WHERE org_id = ? AND status = ? ORDER BY due_at ASC', user.orgId, status)
      : await queryAll<TaskRow>(db, 'SELECT * FROM tasks WHERE org_id = ? ORDER BY due_at ASC', user.orgId);
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
  app.get('/api/drafts', { preHandler: auth }, async (request) => {
    const user = getUser(request);
    const rows = await queryAll<DraftRow & { contact_name: string; company: string }>(
      db,
      `SELECT d.*, o.contact_name, o.company FROM drafts d
       JOIN opportunities o ON o.id = d.opportunity_id
       WHERE d.org_id = ? ORDER BY d.created_at DESC`,
      user.orgId,
    );
    return { drafts: rows };
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
    const input = JSON.parse(execution.input_json) as OpportunityInput;
    const result = await runIntake(db, user.orgId, input, {
      actor: user.email,
      maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
    });
    await audit(db, user.orgId, user.email, 'execution.retried', 'execution', id, {
      newExecutionId: result.executionId,
    });
    await reply.send({ ...result, retriedFrom: id });
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
