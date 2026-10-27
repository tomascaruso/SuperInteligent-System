import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

// ---------- Interfaz de base de datos (asíncrona, agnóstica del motor) ----------
//
// Los dos motores soportados hablan el mismo SQL con placeholders `?` en el
// código de la app. La implementación de Postgres traduce `?` a `$1..$n`
// antes de enviar la consulta. El código de la app nunca usa sintaxis
// exclusiva de un motor (sin PRAGMA; las fechas se comparan como texto ISO).
// Los parámetros son solo string | number | null en todo el código actual.

export type Param = string | number | null;

export interface Database {
  queryAll<T>(sql: string, ...params: Param[]): Promise<T[]>;
  queryOne<T>(sql: string, ...params: Param[]): Promise<T | undefined>;
  exec(sql: string, ...params: Param[]): Promise<void>;
  close(): Promise<void>;
}

export type Db = Database;

// Funciones sueltas (misma convención que los antiguos q/q1/run): delegan
// en la implementación del motor elegido.
export async function queryAll<T>(db: Db, sql: string, ...params: Param[]): Promise<T[]> {
  return db.queryAll(sql, ...params);
}

export async function queryOne<T>(db: Db, sql: string, ...params: Param[]): Promise<T | undefined> {
  return db.queryOne(sql, ...params);
}

export async function exec(db: Db, sql: string, ...params: Param[]): Promise<void> {
  return db.exec(sql, ...params);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Fecha UTC actual como `YYYY-MM-DD` (equivale a date('now') de SQLite). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  return randomUUID();
}

// ---------- Esquema (válido en SQLite y en Postgres) ----------

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      dedup_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (org_id, dedup_key)
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
      title TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id),
      status TEXT NOT NULL CHECK (status IN ('open', 'done')),
      due_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
      body TEXT NOT NULL,
      source_message TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved', 'rejected')),
      note TEXT,
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL REFERENCES drafts(id),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
      by_user TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      org_name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      kind TEXT NOT NULL,
      input_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      execution_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policies (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      workflow TEXT NOT NULL,
      workflow_version TEXT NOT NULL,
      input_json TEXT NOT NULL,
      idempotency_key TEXT,
      retry_of TEXT REFERENCES executions(id),
      status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
      result_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS execution_steps (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id),
      step TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('done', 'failed')),
      output_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflows (
      workflow TEXT NOT NULL,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (workflow, version)
    );
    CREATE TABLE IF NOT EXISTS process_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      workflow TEXT NOT NULL,
      workflow_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
      execution_id TEXT NOT NULL REFERENCES executions(id),
      opportunity_id TEXT REFERENCES opportunities(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      execution_id TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      org_id TEXT NOT NULL,
      key TEXT NOT NULL,
      execution_id TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (org_id, key)
    );
  `;

// ---------- SQLite (node:sqlite, default local) ----------

class SqliteDatabase implements Database {
  constructor(private db: DatabaseSync) {}

  async queryAll<T>(sql: string, ...params: Param[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async queryOne<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  async exec(sql: string, ...params: Param[]): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// ---------- Postgres (paquete pg) ----------

// Interfaz mínima de pool: la cumple el Pool real de pg y el Pool emulado
// de pg-mem usado en tests. El adaptador envuelve al Pool real para no
// depender de sus sobrecargas de tipos.
export interface PgPoolLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

function toPostgres(sql: string): string {
  // El SQL de la app no usa `?` dentro de literales, así que el reemplazo
  // secuencial es seguro.
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export class PgDatabase implements Database {
  constructor(private pool: PgPoolLike) {}

  async queryAll<T>(sql: string, ...params: Param[]): Promise<T[]> {
    const res = await this.pool.query(toPostgres(sql), params);
    return res.rows as T[];
  }

  async queryOne<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
    const rows = await this.queryAll<T>(sql, ...params);
    return rows[0];
  }

  async exec(sql: string, ...params: Param[]): Promise<void> {
    await this.pool.query(toPostgres(sql), params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ---------- Apertura ----------

/** Crea el esquema si falta (idempotente por CREATE TABLE IF NOT EXISTS). */
export async function initSchema(db: Db): Promise<void> {
  // El DDL no tiene `;` dentro de literales: partir por sentencia es seguro
  // y necesario porque prepare() de SQLite no acepta varias sentencias.
  for (const stmt of SCHEMA.split(';')) {
    const sql = stmt.trim();
    if (sql) await db.exec(sql);
  }
  await ensureProcessCatalog(db);
  await ensureProcessOpportunityBackfill(db);
  await ensureAgentCatalog(db);
  await ensureAgentPauseColumn(db);
  await ensureDraftSnapshots(db);
  await ensurePolicyCatalog(db);
}

// ---------- Catálogo de procesos (C3, alineación PENSIA) ----------
//
// Workflows conocidos: solo los que el código realmente ejecuta. Hoy uno:
// opportunity.intake v1, con sus pasos reales en orden (ver engine.ts).
// El backfill cubre ejecuciones anteriores a C3: cada una recibe su
// corrida con sus mismos datos (una corrida por ejecución). Es idempotente:
// solo se crean corridas para ejecuciones que todavía no tienen una.
const KNOWN_WORKFLOWS = [
  {
    workflow: 'opportunity.intake',
    version: '1',
    name: 'Captación de oportunidad',
    steps: ['normalize', 'dedup', 'classify', 'upsert', 'next_action', 'draft'],
  },
];

export async function ensureProcessCatalog(db: Db): Promise<void> {
  for (const w of KNOWN_WORKFLOWS) {
    const existing = await queryOne<{ workflow: string }>(
      db,
      'SELECT workflow FROM workflows WHERE workflow = ? AND version = ?',
      w.workflow,
      w.version,
    );
    if (!existing) {
      await exec(
        db,
        'INSERT INTO workflows (workflow, version, name, steps_json, created_at) VALUES (?, ?, ?, ?, ?)',
        w.workflow,
        w.version,
        w.name,
        JSON.stringify(w.steps),
        nowIso(),
      );
    }
  }
  // LEFT JOIN + IS NULL en vez de NOT EXISTS correlacionado: equivalente y
  // compatible con pg-mem (el emulador no resuelve la referencia externa).
  const legacy = await queryAll<{
    id: string;
    org_id: string;
    workflow: string;
    workflow_version: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    db,
    'SELECT e.* FROM executions e LEFT JOIN process_runs pr ON pr.execution_id = e.id WHERE pr.id IS NULL',
  );
  for (const e of legacy) {
    await exec(
      db,
      'INSERT INTO process_runs (id, org_id, workflow, workflow_version, status, execution_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      e.org_id,
      e.workflow,
      e.workflow_version,
      e.status,
      e.id,
      e.created_at,
      e.updated_at,
    );
  }
}

// ---------- Vínculo corrida–oportunidad (H1) ----------
//
// process_runs no guardaba a qué oportunidad dio lugar la corrida: la
// columna Cliente de Inicio se derivaba parseando result_json en cada
// lectura. H1 la persiste: runIntake la escribe al terminar con éxito
// (ver engine.ts) y este backfill la completa en arranque para corridas
// viejas, parseando result_json en código (sin SQL JSON, que difiere
// entre SQLite y Postgres) y, si no hay resultado, el evento de intake
// de esa ejecución. Migración con el patrón C4/C5: probar la columna y
// ALTER solo si falta. Corridas sin vínculo (fallidas antes de crear la
// oportunidad) quedan en NULL y la UI muestra "—", nunca un cliente
// inventado.
export async function ensureProcessOpportunityBackfill(db: Db): Promise<void> {
  const hasColumn = await queryOne<Record<string, unknown>>(
    db,
    'SELECT opportunity_id FROM process_runs LIMIT 0',
  ).then(
    () => true,
    () => false,
  );
  if (!hasColumn) {
    await exec(db, 'ALTER TABLE process_runs ADD COLUMN opportunity_id TEXT');
  }
  const runs = await queryAll<{ id: string; execution_id: string }>(
    db,
    'SELECT id, execution_id FROM process_runs WHERE opportunity_id IS NULL',
  );
  for (const run of runs) {
    let oppId: string | null = null;
    const execution = await queryOne<{ result_json: string | null }>(
      db,
      'SELECT result_json FROM executions WHERE id = ?',
      run.execution_id,
    );
    if (execution?.result_json) {
      try {
        const parsed = JSON.parse(execution.result_json) as {
          opportunity?: { id?: unknown };
        };
        if (parsed && typeof parsed.opportunity?.id === 'string') oppId = parsed.opportunity.id;
      } catch {
        oppId = null;
      }
    }
    if (!oppId) {
      const event = await queryOne<{ payload_json: string }>(
        db,
        'SELECT payload_json FROM events WHERE execution_id = ? ORDER BY created_at ASC LIMIT 1',
        run.execution_id,
      );
      if (event?.payload_json) {
        try {
          const parsed = JSON.parse(event.payload_json) as { opportunityId?: unknown };
          if (typeof parsed.opportunityId === 'string') oppId = parsed.opportunityId;
        } catch {
          oppId = null;
        }
      }
    }
    if (oppId) {
      await exec(db, 'UPDATE process_runs SET opportunity_id = ? WHERE id = ?', oppId, run.id);
    }
  }
}

// ---------- Pausa de agentes (H1) ----------
//
// Migración con el patrón C4/C5: probar la columna y ALTER solo si
// falta. En bases nuevas la columna ya viene del DDL (DEFAULT 0). El
// flag es global (el catálogo de agentes es global, como en C4): pausar
// un agente lo pausa para todas las organizaciones, no solo para la
// del admin que lo pausó. Se documenta en el informe H1.
export async function ensureAgentPauseColumn(db: Db): Promise<void> {
  const hasColumn = await queryOne<Record<string, unknown>>(
    db,
    'SELECT paused FROM agents LIMIT 0',
  ).then(
    () => true,
    () => false,
  );
  if (!hasColumn) {
    await exec(db, 'ALTER TABLE agents ADD COLUMN paused INTEGER DEFAULT 0');
  }
}

// ---------- Catálogo de agentes (C4, alineación PENSIA) ----------
//
// Agentes conocidos: solo los 5 que el código realmente tiene como pasos
// del pipeline (ver docs/WORKFLOWS.md). Siguen siendo deterministas: la
// tabla los convierte en entidades consultables, no les agrega IA ni
// autonomía. steps_json lista los pasos reales del pipeline que cada uno
// posee; QA y políticas no tiene paso propio (revisa antes de aprobar,
// sin poder aprobar solo), por eso su lista es vacía, no inventada.
// El catálogo es global (no por org): el Core no se bifurca por cliente.
export const FOLLOW_UP_AGENT_ID = 'follow_up';
export const FOLLOW_UP_AGENT_NAME = 'Seguimiento';

const KNOWN_AGENTS = [
  {
    id: 'intake',
    name: 'Captación',
    description: 'Normaliza, deduplica y persiste la oportunidad entrante.',
    steps: ['normalize', 'dedup', 'upsert'],
    sortOrder: 1,
  },
  {
    id: 'qualification',
    name: 'Calificación',
    description: 'Clasifica por reglas: categoría y prioridad.',
    steps: ['classify'],
    sortOrder: 2,
  },
  {
    id: 'response_proposal',
    name: 'Respuesta y propuesta',
    description: 'Genera el borrador desde plantillas.',
    steps: ['draft'],
    sortOrder: 3,
  },
  {
    id: 'follow_up',
    name: 'Seguimiento',
    description: 'Recomienda y programa la próxima acción; crea la tarea.',
    steps: ['next_action'],
    sortOrder: 4,
  },
  {
    id: 'qa_policy',
    name: 'QA y políticas',
    description:
      'Revisa estructura, consistencia y políticas antes de la aprobación; no aprueba solo. Sin paso propio en el pipeline actual.',
    steps: [] as string[],
    sortOrder: 5,
  },
];

export async function ensureAgentCatalog(db: Db): Promise<void> {
  for (const a of KNOWN_AGENTS) {
    const existing = await queryOne<{ id: string }>(db, 'SELECT id FROM agents WHERE id = ?', a.id);
    if (!existing) {
      await exec(
        db,
        'INSERT INTO agents (id, name, description, steps_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        a.id,
        a.name,
        a.description,
        JSON.stringify(a.steps),
        a.sortOrder,
        nowIso(),
      );
    }
    // C6: el catálogo es propiedad del código, así que se sincroniza en
    // cada arranque. Sin esto, la corrección de pasos (upsert → Captación)
    // no llegaría a bases creadas antes de C6.
    await exec(
      db,
      'UPDATE agents SET name = ?, description = ?, steps_json = ?, sort_order = ? WHERE id = ?',
      a.name,
      a.description,
      JSON.stringify(a.steps),
      a.sortOrder,
      a.id,
    );
  }
  // Migración de bases pre-C4: la columna no existe en ellas. Probarla es
  // portable (SQLite, Postgres y pg-mem fallan igual si falta); el ALTER
  // solo corre en ese caso. En bases nuevas la columna ya viene del DDL.
  const hasColumn = await queryOne<Record<string, unknown>>(db, 'SELECT agent_id FROM tasks LIMIT 0').then(
    () => true,
    () => false,
  );
  if (!hasColumn) {
    await exec(db, 'ALTER TABLE tasks ADD COLUMN agent_id TEXT');
  }
  // Backfill: toda tarea del sistema la creó el paso next_action, del
  // agente Seguimiento. Solo se tocan filas sin agente (legado); las
  // creadas desde C4 ya lo traen. El assigned_to 'Fundador' era texto
  // fijo, no una persona: se alinea con el nombre del agente.
  await exec(
    db,
    'UPDATE tasks SET agent_id = ?, assigned_to = CASE WHEN assigned_to = ? THEN ? ELSE assigned_to END WHERE agent_id IS NULL',
    FOLLOW_UP_AGENT_ID,
    'Fundador',
    FOLLOW_UP_AGENT_NAME,
  );
}

// ---------- Foto del mensaje por borrador (C5, alineación PENSIA) ----------
//
// Cada borrador guarda el mensaje de la oportunidad con el que se generó.
// Así, aprobar puede verificar que el contenido no cambió desde entonces
// (un intake duplicado actualiza el mensaje sin regenerar el borrador
// pendiente). Migración como en C4: probar la columna y ALTER solo si
// falta; backfill en JS (bucle sobre filas, no subconsulta correlacionada)
// para no depender de emuladores. Limitación honesta del backfill: para
// borradores pre-C5 se asume que el mensaje actual es el original; en la
// demo vale (el seed no tuvo intakes duplicados), pero un borrador viejo
// ya desincronizado antes de C5 no quedaría marcado como tal.
export async function ensureDraftSnapshots(db: Db): Promise<void> {
  const hasColumn = await queryOne<Record<string, unknown>>(db, 'SELECT source_message FROM drafts LIMIT 0').then(
    () => true,
    () => false,
  );
  if (!hasColumn) {
    await exec(db, 'ALTER TABLE drafts ADD COLUMN source_message TEXT');
  }
  const legacy = await queryAll<{ id: string; message: string }>(
    db,
    'SELECT d.id, o.message FROM drafts d JOIN opportunities o ON o.id = d.opportunity_id WHERE d.source_message IS NULL',
  );
  for (const row of legacy) {
    await exec(db, 'UPDATE drafts SET source_message = ? WHERE id = ?', row.message, row.id);
  }
}

// ---------- Registry de políticas (C6, alineación PENSIA) ----------
//
// Políticas globales del sistema, con su valor vigente en una tabla (no
// solo en código): el reintento y el vencimiento de borradores leen de
// acá, así cambiar una fila cambia el comportamiento. La regla de admin
// para aprobar/rechazar sigue impuesta por el pre-handler requireAdmin
// (anterior al registry); la fila la documenta en el mismo lugar.
// La migración de executions.retry_of sigue el patrón C4/C5; no hay
// backfill: los reintentos pre-C6 no se cuentan para el tope (el vínculo
// solo vivía en la auditoría, y reconstruirlo desde JSON sería frágil).
const KNOWN_POLICIES = [
  {
    key: 'retry.admin_only',
    value: 'true',
    description: 'Solo un admin puede reintentar ejecuciones.',
  },
  {
    key: 'retry.max_attempts',
    value: '3',
    description: 'Máximo de reintentos por ejecución original.',
  },
  {
    key: 'draft.approval.admin_only',
    value: 'true',
    description: 'Solo un admin aprueba o rechaza borradores.',
  },
  {
    key: 'draft.expiry_days',
    value: '7',
    description: 'Días hasta que un borrador vence.',
  },
];

export async function ensurePolicyCatalog(db: Db): Promise<void> {
  for (const p of KNOWN_POLICIES) {
    const existing = await queryOne<{ key: string }>(db, 'SELECT key FROM policies WHERE key = ?', p.key);
    if (!existing) {
      await exec(
        db,
        'INSERT INTO policies (key, value, description, created_at) VALUES (?, ?, ?, ?)',
        p.key,
        p.value,
        p.description,
        nowIso(),
      );
    }
  }
  const hasColumn = await queryOne<Record<string, unknown>>(db, 'SELECT retry_of FROM executions LIMIT 0').then(
    () => true,
    () => false,
  );
  if (!hasColumn) {
    await exec(db, 'ALTER TABLE executions ADD COLUMN retry_of TEXT');
  }
}

export interface OpenOptions {
  databaseUrl?: string;
  databasePath: string;
}

/**
 * Abre la base según el entorno: si DATABASE_URL está definida usa
 * Postgres (pg honra el sslmode de la cadena, p. ej. el `sslmode=require`
 * de Neon); si no, SQLite local en DATABASE_PATH (o :memory: en tests).
 */
export async function openDatabase(opts: OpenOptions): Promise<Db> {
  if (opts.databaseUrl) {
    const pool = new Pool({ connectionString: opts.databaseUrl });
    const db = new PgDatabase({
      query: (sql, params) => pool.query(sql, params ?? []).then((r) => ({ rows: r.rows })),
      end: () => pool.end(),
    });
    await initSchema(db);
    return db;
  }
  if (opts.databasePath !== ':memory:') {
    mkdirSync(dirname(opts.databasePath), { recursive: true });
  }
  const sqlite = new DatabaseSync(opts.databasePath);
  // Postgres ya impone las claves foráneas por defecto; en SQLite hay que
  // activarlo explícitamente.
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = new SqliteDatabase(sqlite);
  await initSchema(db);
  return db;
}

export async function audit(
  db: Db,
  orgId: string,
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await db.exec(
    'INSERT INTO audit_log (id, org_id, actor, action, entity, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    orgId,
    actor,
    action,
    entity,
    entityId,
    JSON.stringify(detail),
    nowIso(),
  );
}
