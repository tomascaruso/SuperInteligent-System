import {
  FOLLOW_UP_AGENT_ID,
  FOLLOW_UP_AGENT_NAME,
  audit,
  exec,
  newId,
  nowIso,
  queryOne,
  todayUtc,
  type Db,
} from './db.js';
import {
  classifyOpportunity,
  dedupKey,
  draftBody,
  normalizeOpportunity,
  type Classification,
  type NormalizedOpportunity,
  type OpportunityInput,
} from './domain.js';

export class LimitExceededError extends Error {
  constructor() {
    super('limit_exceeded');
    this.name = 'LimitExceededError';
  }
}

export interface OpportunityRow {
  id: string;
  org_id: string;
  contact_name: string;
  contact_email: string;
  company: string;
  message: string;
  source: string;
  status: string;
  category: string;
  priority: string;
  dedup_key: string;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  org_id: string;
  opportunity_id: string;
  title: string;
  assigned_to: string;
  agent_id: string | null;
  status: string;
  due_at: string;
  created_at: string;
  updated_at: string;
}

export interface DraftRow {
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

export interface IntakeOptions {
  actor: string;
  idempotencyKey?: string;
  maxOpportunitiesPerDay: number;
}

export interface IntakeResult {
  executionId: string;
  processRunId: string;
  opportunity: OpportunityRow;
  created: boolean;
  task: TaskRow | null;
  draft: DraftRow | null;
}

async function step(
  db: Db,
  executionId: string,
  name: string,
  status: 'done' | 'failed',
  output?: unknown,
  error?: string,
): Promise<void> {
  await exec(
    db,
    'INSERT INTO execution_steps (id, execution_id, step, status, output_json, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(),
    executionId,
    name,
    status,
    output === undefined ? null : JSON.stringify(output),
    error ?? null,
    nowIso(),
  );
}

function dueAt(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

/**
 * Garantiza que la oportunidad tenga una tarea abierta y un borrador
 * pendiente. Esto hace que un reintento tras un fallo parcial converja en
 * vez de duplicar: si la tarea o el borrador ya existen, no se crean de
 * nuevo.
 */
async function ensureTaskAndDraft(
  db: Db,
  orgId: string,
  opp: OpportunityRow,
  c: Classification,
  n: NormalizedOpportunity,
  actor: string,
): Promise<{ task: TaskRow; draft: DraftRow }> {
  let task = await queryOne<TaskRow>(
    db,
    'SELECT * FROM tasks WHERE org_id = ? AND opportunity_id = ? AND status = ? ORDER BY created_at LIMIT 1',
    orgId,
    opp.id,
    'open',
  );
  if (!task) {
    const taskId = newId();
    await exec(
      db,
      'INSERT INTO tasks (id, org_id, opportunity_id, title, assigned_to, agent_id, status, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      taskId,
      orgId,
      opp.id,
      c.nextAction,
      FOLLOW_UP_AGENT_NAME,
      FOLLOW_UP_AGENT_ID,
      'open',
      dueAt(c.dueHours),
      nowIso(),
      nowIso(),
    );
    task = (await queryOne<TaskRow>(db, 'SELECT * FROM tasks WHERE id = ?', taskId))!;
    await audit(db, orgId, actor, 'task.created', 'task', task.id, { opportunityId: opp.id });
  }

  let draft = await queryOne<DraftRow>(
    db,
    'SELECT * FROM drafts WHERE org_id = ? AND opportunity_id = ? AND status = ? ORDER BY created_at LIMIT 1',
    orgId,
    opp.id,
    'pending_approval',
  );
  if (!draft) {
    const draftId = newId();
    await exec(
      db,
      'INSERT INTO drafts (id, org_id, opportunity_id, body, source_message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      draftId,
      orgId,
      opp.id,
      draftBody(n, c),
      opp.message,
      'pending_approval',
      nowIso(),
    );
    draft = (await queryOne<DraftRow>(db, 'SELECT * FROM drafts WHERE id = ?', draftId))!;
    await audit(db, orgId, actor, 'draft.created', 'draft', draft.id, { opportunityId: opp.id });
  }

  if (opp.status === 'new') {
    await exec(db, 'UPDATE opportunities SET status = ?, updated_at = ? WHERE id = ?', 'proposal_draft', nowIso(), opp.id);
    opp.status = 'proposal_draft';
  }
  return { task, draft };
}

/**
 * Ejecuta el workflow `opportunity.intake` v1 completo, con cada paso
 * persistido. Es idempotente a nivel de negocio gracias a la clave de
 * deduplicación: un reintento no duplica la oportunidad, la tarea ni el
 * borrador.
 *
 * C3 (alineación PENSIA): la ejecución queda envuelta en una corrida de
 * proceso (`process_runs`, 1:1 con la ejecución en este flujo). El
 * pipeline por dentro no cambia: solo se crea la corrida al inicio y se
 * espeja su estado al final, en el mismo `finish` de la ejecución.
 */
export async function runIntake(
  db: Db,
  orgId: string,
  input: OpportunityInput,
  opts: IntakeOptions,
): Promise<IntakeResult> {
  const executionId = newId();
  const processRunId = newId();
  const now = nowIso();
  await exec(
    db,
    'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, idempotency_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    executionId,
    orgId,
    'opportunity.intake',
    '1',
    JSON.stringify(input),
    opts.idempotencyKey ?? null,
    'running',
    now,
    now,
  );
  await exec(
    db,
    'INSERT INTO process_runs (id, org_id, workflow, workflow_version, status, execution_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    processRunId,
    orgId,
    'opportunity.intake',
    '1',
    'running',
    executionId,
    now,
    now,
  );

  const finish = async (status: 'done' | 'failed', result?: unknown, error?: string): Promise<void> => {
    await exec(
      db,
      'UPDATE executions SET status = ?, result_json = ?, error = ?, updated_at = ? WHERE id = ?',
      status,
      result === undefined ? null : JSON.stringify(result),
      error ?? null,
      nowIso(),
      executionId,
    );
    await exec(
      db,
      'UPDATE process_runs SET status = ?, updated_at = ? WHERE execution_id = ?',
      status,
      nowIso(),
      executionId,
    );
  };

  try {
    const normalized = normalizeOpportunity(input);
    await step(db, executionId, 'normalize', 'done', normalized);

    // created_at es texto ISO: comparar el prefijo YYYY-MM-DD funciona en
    // SQLite y en Postgres (sin la función date() exclusiva de SQLite).
    // COUNT(*) vuelve como texto en Postgres: coerción explícita.
    const createdToday = Number(
      (await queryOne<{ c: number }>(
        db,
        'SELECT COUNT(*) AS c FROM opportunities WHERE org_id = ? AND substr(created_at, 1, 10) = ?',
        orgId,
        todayUtc(),
      ))?.c ?? 0,
    );
    if (createdToday >= opts.maxOpportunitiesPerDay) {
      throw new LimitExceededError();
    }

    const key = dedupKey(normalized);
    const existing = await queryOne<OpportunityRow>(
      db,
      'SELECT * FROM opportunities WHERE org_id = ? AND dedup_key = ?',
      orgId,
      key,
    );
    await step(db, executionId, 'dedup', 'done', { matched: Boolean(existing) });

    if (existing) {
      await exec(
        db,
        'UPDATE opportunities SET message = ?, updated_at = ? WHERE id = ?',
        normalized.message,
        nowIso(),
        existing.id,
      );
      const opp = (await queryOne<OpportunityRow>(db, 'SELECT * FROM opportunities WHERE id = ?', existing.id))!;
      const classification = classifyOpportunity({
        contactName: opp.contact_name,
        contactEmail: opp.contact_email,
        company: opp.company,
        message: opp.message,
        source: opp.source,
      });
      await step(db, executionId, 'classify', 'done', classification);
      const { task, draft } = await ensureTaskAndDraft(db, orgId, opp, classification, normalized, opts.actor);
      await step(db, executionId, 'next_action', 'done', { taskId: task.id });
      await step(db, executionId, 'draft', 'done', { draftId: draft.id });
      await audit(db, orgId, opts.actor, 'opportunity.updated', 'opportunity', opp.id, { dedup: true });
      await exec(
        db,
        'INSERT INTO events (id, org_id, execution_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        newId(),
        orgId,
        executionId,
        'opportunity.intake',
        JSON.stringify({ opportunityId: opp.id, duplicate: true }),
        nowIso(),
      );
      const result: IntakeResult = { executionId, processRunId, opportunity: opp, created: false, task, draft };
      await finish('done', result);
      return result;
    }

    const classification = classifyOpportunity(normalized);
    await step(db, executionId, 'classify', 'done', classification);
    const oppId = newId();
    await exec(
      db,
      'INSERT INTO opportunities (id, org_id, contact_name, contact_email, company, message, source, status, category, priority, dedup_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      oppId,
      orgId,
      normalized.contactName,
      normalized.contactEmail,
      normalized.company,
      normalized.message,
      normalized.source,
      'new',
      classification.category,
      classification.priority,
      key,
      now,
      now,
    );
    await step(db, executionId, 'upsert', 'done', { opportunityId: oppId });
    const opp = (await queryOne<OpportunityRow>(db, 'SELECT * FROM opportunities WHERE id = ?', oppId))!;
    const { task, draft } = await ensureTaskAndDraft(db, orgId, opp, classification, normalized, opts.actor);
    await step(db, executionId, 'next_action', 'done', { taskId: task.id });
    await step(db, executionId, 'draft', 'done', { draftId: draft.id });
    await audit(db, orgId, opts.actor, 'opportunity.created', 'opportunity', opp.id, {
      category: classification.category,
      priority: classification.priority,
    });
    await exec(
      db,
      'INSERT INTO events (id, org_id, execution_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId(),
      orgId,
      executionId,
      'opportunity.intake',
      JSON.stringify({ opportunityId: opp.id, duplicate: false }),
      nowIso(),
    );
    const result: IntakeResult = { executionId, processRunId, opportunity: opp, created: true, task, draft };
    await finish('done', result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await step(db, executionId, 'intake', 'failed', undefined, message);
    await finish('failed', undefined, message);
    throw err;
  }
}
