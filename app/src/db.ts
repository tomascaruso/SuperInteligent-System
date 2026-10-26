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
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
      title TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      workflow TEXT NOT NULL,
      workflow_version TEXT NOT NULL,
      input_json TEXT NOT NULL,
      idempotency_key TEXT,
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
