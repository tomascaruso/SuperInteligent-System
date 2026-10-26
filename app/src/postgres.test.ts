// Camino Postgres (D14) contra pg-mem, emulador en memoria: cubre la
// traducción de placeholders ? -> $n, el DDL compartido, el JOIN de
// borradores, el LIKE de auditoría, el substr de "hoy" y la coerción de
// COUNT(*) (en Postgres real vuelve como texto). NO es un Postgres real:
// la verificación contra Neon queda pendiente (no hay cuenta todavía).
import Fastify from 'fastify';
import { DataType, newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { initSchema, PgDatabase } from './db.js';
import { registerRoutes } from './routes.js';

async function pgServer() {
  const mem = newDb();
  // pg-mem no implementa substr(): se registra la función tal como la
  // define Postgres real (1-based), solo para el emulador.
  mem.public.registerFunction({
    name: 'substr',
    args: [DataType.text, DataType.integer, DataType.integer],
    returns: DataType.text,
    implementation: (s: string, from: number, len: number) => s.substring(from - 1, from - 1 + len),
  });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db = new PgDatabase({
    query: (sql, params) =>
      pool.query(sql, params ?? []).then((r: { rows: unknown[] }) => ({ rows: r.rows })),
    end: () => pool.end(),
  });
  await initSchema(db);
  const app = Fastify({ logger: false });
  registerRoutes(app, db, { jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
  return { app, db };
}

const OPP = {
  contactName: 'Lucía Fernández',
  contactEmail: 'lucia@empresaejemplo.com',
  company: 'Empresa Ejemplo',
  message: 'Necesitamos automatizar nuestro seguimiento comercial urgente, esta semana.',
};

describe('Postgres (pg-mem) — mismo flujo que el MVP', () => {
  it('intake, dedup, tarea, borrador, aprobación, auditoría y stats', async () => {
    const { app, db } = await pgServer();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Agencia PG', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    expect(reg.statusCode).toBe(201);
    const token = reg.json().token as string;
    const auth = { authorization: `Bearer ${token}` };

    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth, payload: OPP });
    expect(created.statusCode).toBe(201);
    expect(created.json().opportunity.category).toBe('automatización');
    expect(created.json().opportunity.priority).toBe('high');
    const id = created.json().opportunity.id as string;

    const dup = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth, payload: OPP });
    expect(dup.json().duplicate).toBe(true);
    expect(dup.json().opportunity.id).toBe(id);

    const tasks = await app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: auth });
    expect(tasks.json().tasks).toHaveLength(1);
    expect(tasks.json().tasks[0].title).toBe('Llamar en menos de 24 h');

    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth });
    expect(drafts.json().drafts).toHaveLength(1);
    expect(drafts.json().drafts[0].status).toBe('pending_approval');
    const draftId = drafts.json().drafts[0].id as string;

    const approved = await app.inject({ method: 'POST', url: `/api/drafts/${draftId}/approve`, headers: auth, payload: {} });
    expect(approved.json().draft.status).toBe('approved');
    const opp = await app.inject({ method: 'GET', url: `/api/opportunities/${id}`, headers: auth });
    expect(opp.json().opportunity.status).toBe('in_follow_up');

    const auditRes = await app.inject({ method: 'GET', url: `/api/audit?opportunityId=${id}`, headers: auth });
    const actions = auditRes.json().audit.map((a: { action: string }) => a.action);
    expect(actions).toContain('opportunity.created');
    expect(actions).toContain('draft.approved');

    const stats = await app.inject({ method: 'GET', url: '/api/stats', headers: auth });
    expect(stats.json().opportunities).toBe(1);
    expect(stats.json().createdToday).toBe(1);
    expect(stats.json().openTasks).toBe(1);
    expect(stats.json().pendingDrafts).toBe(0);

    await app.close();
    await db.close();
  });

  it('una organización no ve los datos de otra', async () => {
    const { app, db } = await pgServer();
    const a = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Org A', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    const aToken = a.json().token as string;
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${aToken}` },
      payload: OPP,
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Org B', name: 'Bea', email: 'bea@test.com', password: 'Secreto123' },
    });
    const bToken = b.json().token as string;
    const foreign = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${created.json().opportunity.id}`,
      headers: { authorization: `Bearer ${bToken}` },
    });
    expect(foreign.statusCode).toBe(404);
    await app.close();
    await db.close();
  });

  it('C4: catálogo de agentes y tarea con agente en Postgres', async () => {
    const { app, db } = await pgServer();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Agencia PG', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    const token = reg.json().token as string;
    const agents = await app.inject({ method: 'GET', url: '/api/agents', headers: { authorization: `Bearer ${token}` } });
    expect(agents.statusCode).toBe(200);
    expect(agents.json().agents).toHaveLength(5);
    expect(agents.json().agents[4].id).toBe('qa_policy');
    await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: OPP,
    });
    const tasks = await app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: { authorization: `Bearer ${token}` } });
    expect(tasks.json().tasks[0].agent_id).toBe('follow_up');
    expect(tasks.json().tasks[0].agent_name).toBe('Seguimiento');
    await app.close();
    await db.close();
  });
});
