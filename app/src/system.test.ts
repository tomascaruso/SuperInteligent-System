// Tests de los 12 criterios de aceptación del MVP (PRD) contra una base
// SQLite en memoria nueva por test: entorno reproducible, sin servicios
// externos ni datos reales.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { ensureAgentCatalog, ensureProcessCatalog, exec, newId, nowIso } from './db.js';

async function testServer(max = 100) {
  return await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: max, operatorToken: 'test-operator' });
}

// C8: el alta es por invitación (ya no hay registro público). El helper
// crea la invitación como operador y la canjea, como haría un cliente.
async function register(
  app: Awaited<ReturnType<typeof buildServer>>['app'],
  orgName = 'Agencia Test',
  name = 'Ana',
  email = 'ana@test.com',
) {
  const inv = await app.inject({
    method: 'POST',
    url: '/api/invitations',
    headers: { 'x-operator-token': 'test-operator' },
    payload: { orgName, email },
  });
  expect(inv.statusCode).toBe(201);
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/accept-invitation',
    payload: { token: inv.json().token as string, name, password: 'Secreto123' },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { token: string; org: { id: string; webhook_secret: string } };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

const OPP = {
  contactName: 'Lucía Fernández',
  contactEmail: 'lucia@empresaejemplo.com',
  company: 'Empresa Ejemplo',
  message: 'Necesitamos automatizar nuestro seguimiento comercial urgente, esta semana.',
};

describe('MVP — 12 criterios de aceptación', () => {
  it('1. una oportunidad válida puede ingresar', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const res = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(res.statusCode).toBe(201);
    expect(res.json().opportunity.id).toBeTruthy();
    await app.close();
  });

  it('2. los datos se normalizan y persisten', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: auth(token),
      payload: { ...OPP, contactName: '  Lucía   Fernández ', contactEmail: 'LUCIA@EmpresaEjemplo.COM' },
    });
    const id = res.json().opportunity.id as string;
    const got = await app.inject({ method: 'GET', url: `/api/opportunities/${id}`, headers: auth(token) });
    expect(got.json().opportunity.contact_email).toBe('lucia@empresaejemplo.com');
    expect(got.json().opportunity.contact_name).toBe('Lucía Fernández');
    await app.close();
  });

  it('3. los duplicados no generan efectos duplicados (dedup + idempotencia)', async () => {
    const { app } = await testServer();
    const { token, org } = await register(app);
    const first = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const second = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(second.json().duplicate).toBe(true);
    expect(second.json().opportunity.id).toBe(first.json().opportunity.id);
    const list = await app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(token) });
    expect(list.json().opportunities).toHaveLength(1);

    // Idempotencia por webhook: misma clave, mismo resultado, sin duplicar.
    const raw = JSON.stringify({ contactName: 'Pedro', contactEmail: 'pedro@negocio.com', company: 'Negocio SRL', message: 'Hola' });
    const sig = `sha256=${createHmac('sha256', org.webhook_secret).update(raw).digest('hex')}`;
    const w1 = await app.inject({ method: 'POST', url: `/api/ingest/${org.id}`, payload: raw, headers: { 'content-type': 'application/json', 'x-signature': sig, 'x-idempotency-key': 'k-1' } });
    const w2 = await app.inject({ method: 'POST', url: `/api/ingest/${org.id}`, payload: raw, headers: { 'content-type': 'application/json', 'x-signature': sig, 'x-idempotency-key': 'k-1' } });
    expect(w1.statusCode).toBe(201);
    expect(w2.json().duplicate).toBe(true);
    expect(w2.json().executionId).toBe(w1.json().executionId);
    await app.close();
  });

  it('4. la clasificación produce una salida validada', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const res = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const opp = res.json().opportunity;
    expect(opp.category).toBe('automatización');
    expect(opp.priority).toBe('high');
    await app.close();
  });

  it('5. se crea una tarea siguiente', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const tasks = await app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: auth(token) });
    expect(tasks.json().tasks).toHaveLength(1);
    expect(tasks.json().tasks[0].opportunity_id).toBe(created.json().opportunity.id);
    expect(tasks.json().tasks[0].title).toBe('Llamar en menos de 24 h');
    await app.close();
  });

  it('6. el borrador se puede revisar y aprobar (y rechazar)', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    const draft = drafts.json().drafts[0];
    expect(draft.status).toBe('pending_approval');
    const approved = await app.inject({ method: 'POST', url: `/api/drafts/${draft.id}/approve`, headers: auth(token), payload: {} });
    expect(approved.json().draft.status).toBe('approved');
    const opp = await app.inject({ method: 'GET', url: `/api/opportunities/${created.json().opportunity.id}`, headers: auth(token) });
    expect(opp.json().opportunity.status).toBe('in_follow_up');
    const again = await app.inject({ method: 'POST', url: `/api/drafts/${draft.id}/approve`, headers: auth(token), payload: {} });
    expect(again.statusCode).toBe(409);
    await app.close();
  });

  it('7. una acción no autorizada se bloquea (sin token, miembro, firma inválida)', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const noToken = await app.inject({ method: 'GET', url: '/api/opportunities' });
    expect(noToken.statusCode).toBe(401);

    // Miembro no puede aprobar borradores (solo admin).
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(token),
      payload: { name: 'Luis', email: 'luis@test.com', password: 'Secreto123' },
    });
    expect(memberRes.statusCode).toBe(201);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'luis@test.com', password: 'Secreto123' } });
    const memberToken = login.json().token as string;
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    const forbidden = await app.inject({ method: 'POST', url: `/api/drafts/${drafts.json().drafts[0].id}/approve`, headers: auth(memberToken), payload: {} });
    expect(forbidden.statusCode).toBe(403);
    expect(created.statusCode).toBe(201);
    await app.close();
  });

  it('8. un fallo puede detectarse y recuperarse (reintento)', async () => {
    const { app, db } = await testServer();
    const { token, org } = await register(app);
    const failedId = newId();
    await exec(
      db,
      'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, status, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      failedId,
      org.id,
      'opportunity.intake',
      '1',
      JSON.stringify(OPP),
      'failed',
      'simulated',
      nowIso(),
      nowIso(),
    );
    const retry = await app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(token), payload: {} });
    expect(retry.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(token) });
    expect(list.json().opportunities).toHaveLength(1);
    await app.close();
  });

  it('9. cada ejecución puede auditarse', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    await app.inject({ method: 'POST', url: `/api/drafts/${drafts.json().drafts[0].id}/approve`, headers: auth(token), payload: {} });
    const auditRes = await app.inject({ method: 'GET', url: `/api/audit?opportunityId=${created.json().opportunity.id}`, headers: auth(token) });
    const actions = auditRes.json().audit.map((a: { action: string }) => a.action);
    expect(actions).toContain('opportunity.created');
    expect(actions).toContain('draft.approved');
    await app.close();
  });

  it('10. una organización no puede acceder a los datos de otra', async () => {
    const { app } = await testServer();
    const a = await register(app, 'Org A');
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(a.token), payload: OPP });
    const { token: bToken } = await register(app, 'Org B', 'Bea', 'bea@test.com');
    const foreign = await app.inject({ method: 'GET', url: `/api/opportunities/${created.json().opportunity.id}`, headers: auth(bToken) });
    expect(foreign.statusCode).toBe(404);
    const bList = await app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(bToken) });
    expect(bList.json().opportunities).toHaveLength(0);
    await app.close();
  });

  it('11. los límites de uso se aplican', async () => {
    const { app } = await testServer(1);
    const { token } = await register(app);
    const first = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: auth(token),
      payload: { ...OPP, contactEmail: 'otro@empresa.com' },
    });
    expect(second.statusCode).toBe(429);
    await app.close();
  });

  it('12. el flujo corre en un entorno de prueba reproducible (dos arranques vacíos)', async () => {
    const s1 = await testServer();
    const t1 = await register(s1.app);
    const l1 = await s1.app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(t1.token) });
    expect(l1.json().opportunities).toHaveLength(0);
    await s1.app.close();
    const s2 = await testServer();
    const t2 = await register(s2.app);
    const l2 = await s2.app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(t2.token) });
    expect(l2.json().opportunities).toHaveLength(0);
    await s2.app.close();
  });

  it('seguridad: webhook con firma inválida se rechaza', async () => {
    const { app } = await testServer();
    const { org } = await register(app);
    const raw = JSON.stringify(OPP);
    const bad = await app.inject({
      method: 'POST',
      url: `/api/ingest/${org.id}`,
      payload: raw,
      headers: { 'content-type': 'application/json', 'x-signature': 'sha256=00' },
    });
    expect(bad.statusCode).toBe(401);
    await app.close();
  });
});

describe('C2 — trazabilidad expuesta (alineación PENSIA)', () => {
  it('los pasos de una ejecución se exponen en orden', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/executions', headers: auth(token) });
    const executionId = list.json().executions[0].id as string;
    const res = await app.inject({ method: 'GET', url: `/api/executions/${executionId}/steps`, headers: auth(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().executionId).toBe(executionId);
    expect(res.json().steps.map((s: { step: string }) => s.step)).toEqual([
      'normalize', 'dedup', 'classify', 'upsert', 'next_action', 'draft',
    ]);
    expect(res.json().steps.every((s: { status: string }) => s.status === 'done')).toBe(true);
    await app.close();
  });

  it('pasos de otra org, ejecución inexistente y sin token se rechazan', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/executions', headers: auth(token) });
    const executionId = list.json().executions[0].id as string;
    const { token: otherToken } = await register(app, 'Otra Agencia', 'Beto', 'beto@otra.com');
    const cross = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}/steps`,
      headers: auth(otherToken),
    });
    expect(cross.statusCode).toBe(404);
    const missing = await app.inject({ method: 'GET', url: '/api/executions/inexistente/steps', headers: auth(token) });
    expect(missing.statusCode).toBe(404);
    const anon = await app.inject({ method: 'GET', url: `/api/executions/${executionId}/steps` });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });
});

describe('C3 — proceso como entidad (alineación PENSIA)', () => {
  it('un intake crea una corrida de proceso consultable', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const execs = await app.inject({ method: 'GET', url: '/api/executions', headers: auth(token) });
    const executionId = execs.json().executions[0].id as string;
    const runs = await app.inject({ method: 'GET', url: '/api/processes', headers: auth(token) });
    expect(runs.statusCode).toBe(200);
    expect(runs.json().processes).toHaveLength(1);
    const run = runs.json().processes[0];
    expect(run.workflow).toBe('opportunity.intake');
    expect(run.workflow_version).toBe('1');
    expect(run.status).toBe('done');
    expect(run.execution.id).toBe(executionId);
    const detail = await app.inject({ method: 'GET', url: `/api/processes/${run.id}`, headers: auth(token) });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().execution.id).toBe(executionId);
    await app.close();
  });

  it('el registry expone opportunity.intake v1 con sus pasos reales', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const res = await app.inject({ method: 'GET', url: '/api/workflows', headers: auth(token) });
    expect(res.statusCode).toBe(200);
    const w = res.json().workflows.find((x: { workflow: string }) => x.workflow === 'opportunity.intake');
    expect(w.version).toBe('1');
    expect(w.steps).toEqual(['normalize', 'dedup', 'classify', 'upsert', 'next_action', 'draft']);
    await app.close();
  });

  it('procesos de otra org, proceso inexistente y sin token se rechazan', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const runs = await app.inject({ method: 'GET', url: '/api/processes', headers: auth(token) });
    const runId = runs.json().processes[0].id as string;
    const { token: otherToken } = await register(app, 'Otra Agencia', 'Beto', 'beto@otra.com');
    const cross = await app.inject({ method: 'GET', url: `/api/processes/${runId}`, headers: auth(otherToken) });
    expect(cross.statusCode).toBe(404);
    const missing = await app.inject({ method: 'GET', url: '/api/processes/inexistente', headers: auth(token) });
    expect(missing.statusCode).toBe(404);
    const anon = await app.inject({ method: 'GET', url: '/api/processes' });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it('ejecuciones previas a C3 reciben corrida (backfill)', async () => {
    const s = await testServer();
    const { token, org } = await register(s.app);
    const legacyId = newId();
    await s.db.exec(
      'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, idempotency_key, status, result_json, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      legacyId, org.id, 'opportunity.intake', '1', '{}', null, 'done', null, null, nowIso(), nowIso(),
    );
    await ensureProcessCatalog(s.db);
    const runs = await s.app.inject({ method: 'GET', url: '/api/processes', headers: auth(token) });
    expect(runs.json().processes).toHaveLength(1);
    expect(runs.json().processes[0].execution.id).toBe(legacyId);
    expect(runs.json().processes[0].status).toBe('done');
    await s.app.close();
  });
});

describe('C4 — agentes como entidades (alineación PENSIA)', () => {
  it('la tarea del intake queda asignada al agente Seguimiento, no al texto fijo', async () => {
    const s = await testServer();
    const { token } = await register(s.app);
    const created = await s.app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const tasks = await s.app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: auth(token) });
    expect(tasks.json().tasks).toHaveLength(1);
    expect(tasks.json().tasks[0].agent_id).toBe('follow_up');
    expect(tasks.json().tasks[0].assigned_to).toBe('Seguimiento');
    expect(tasks.json().tasks[0].agent_name).toBe('Seguimiento');
    await s.app.close();
  });

  it('tareas previas a C4 reciben agente en el backfill', async () => {
    const s = await testServer();
    const { token, org } = await register(s.app);
    const created = await s.app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const oppId = created.json().opportunity.id as string;
    // Fila legado: sin agent_id y con el texto fijo viejo.
    await s.db.exec(
      'INSERT INTO tasks (id, org_id, opportunity_id, title, assigned_to, agent_id, status, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      newId(), org.id, oppId, 'Tarea legado', 'Fundador', null, 'open', nowIso(), nowIso(), nowIso(),
    );
    await ensureAgentCatalog(s.db);
    const tasks = await s.app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: auth(token) });
    const legacy = tasks.json().tasks.find((t: { title: string }) => t.title === 'Tarea legado');
    expect(legacy.agent_id).toBe('follow_up');
    expect(legacy.assigned_to).toBe('Seguimiento');
    expect(legacy.agent_name).toBe('Seguimiento');
    await s.app.close();
  });
});

describe('F3-DEMO — correcciones de lenguaje y contexto', () => {
  it('la tarea muestra el contacto y la empresa de su oportunidad', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const tasks = await app.inject({ method: 'GET', url: '/api/tasks?status=open', headers: auth(token) });
    expect(tasks.json().tasks).toHaveLength(1);
    expect(tasks.json().tasks[0].contact_name).toBe('Lucía Fernández');
    expect(tasks.json().tasks[0].company).toBe('Empresa Ejemplo');
    await app.close();
  });

  it('el borrador muestra el canal de entrada de su oportunidad', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    expect(drafts.json().drafts).toHaveLength(1);
    // Alta manual por la API: el esquema pone source 'manual' por defecto.
    expect(drafts.json().drafts[0].opportunity_source).toBe('manual');
    await app.close();
  });
});

describe('C5 — expiración e invalidación de borradores (alineación PENSIA)', () => {
  async function setupPending(s: Awaited<ReturnType<typeof testServer>>, token: string) {
    const created = await s.app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const drafts = await s.app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    expect(drafts.json().drafts).toHaveLength(1);
    return { oppId: created.json().opportunity.id as string, draftId: drafts.json().drafts[0].id as string };
  }

  it('un borrador de más de 7 días no se puede aprobar', async () => {
    const s = await testServer();
    const { token } = await register(s.app);
    const { oppId, draftId } = await setupPending(s, token);
    const old = new Date(Date.now() - 8 * 24 * 3600_000).toISOString();
    await s.db.exec('UPDATE drafts SET created_at = ? WHERE id = ?', old, draftId);
    const flags = await s.app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    expect(flags.json().drafts[0].expired).toBe(true);
    expect(flags.json().drafts[0].stale).toBe(false);
    const res = await s.app.inject({ method: 'POST', url: `/api/drafts/${draftId}/approve`, headers: auth(token), payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('draft_expired');
    const opp = await s.app.inject({ method: 'GET', url: `/api/opportunities/${oppId}`, headers: auth(token) });
    expect(opp.json().opportunity.status).toBe('proposal_draft');
    await s.app.close();
  });

  it('un borrador desactualizado no se puede aprobar', async () => {
    const s = await testServer();
    const { token } = await register(s.app);
    const { oppId, draftId } = await setupPending(s, token);
    await s.db.exec('UPDATE opportunities SET message = ? WHERE id = ?', 'mensaje cambiado después', oppId);
    const flags = await s.app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    expect(flags.json().drafts[0].stale).toBe(true);
    expect(flags.json().drafts[0].expired).toBe(false);
    const res = await s.app.inject({ method: 'POST', url: `/api/drafts/${draftId}/approve`, headers: auth(token), payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('draft_stale');
    await s.app.close();
  });

  it('un borrador vencido sí se puede rechazar', async () => {
    const s = await testServer();
    const { token } = await register(s.app);
    const { oppId, draftId } = await setupPending(s, token);
    const old = new Date(Date.now() - 8 * 24 * 3600_000).toISOString();
    await s.db.exec('UPDATE drafts SET created_at = ? WHERE id = ?', old, draftId);
    const res = await s.app.inject({ method: 'POST', url: `/api/drafts/${draftId}/reject`, headers: auth(token), payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json().draft.status).toBe('rejected');
    const opp = await s.app.inject({ method: 'GET', url: `/api/opportunities/${oppId}`, headers: auth(token) });
    expect(opp.json().opportunity.status).toBe('new');
    await s.app.close();
  });
});

describe('C6 — Policy/Tool Registry y reintento con tope (alineación PENSIA)', () => {
  async function failedExecution(s: Awaited<ReturnType<typeof testServer>>, orgId: string) {
    const failedId = newId();
    await s.db.exec(
      'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, status, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      failedId,
      orgId,
      'opportunity.intake',
      '1',
      JSON.stringify(OPP),
      'failed',
      'simulated',
      nowIso(),
      nowIso(),
    );
    return failedId;
  }

  async function memberToken(s: Awaited<ReturnType<typeof testServer>>, adminToken: string) {
    const created = await s.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(adminToken),
      payload: { name: 'Beto', email: 'beto@test.com', password: 'Secreto123' },
    });
    expect(created.statusCode).toBe(201);
    const login = await s.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'beto@test.com', password: 'Secreto123' },
    });
    expect(login.statusCode).toBe(200);
    return login.json().token as string;
  }

  it('un member no puede reintentar una ejecución fallida (403)', async () => {
    const s = await testServer();
    const { token, org } = await register(s.app);
    const failedId = await failedExecution(s, org.id);
    const member = await memberToken(s, token);
    const res = await s.app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(member), payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('forbidden');
    await s.app.close();
  });

  it('el tope es 3 reintentos por ejecución original, con vínculo guardado', async () => {
    const s = await testServer();
    const { token, org } = await register(s.app);
    const failedId = await failedExecution(s, org.id);
    for (let i = 0; i < 3; i++) {
      const res = await s.app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(token), payload: {} });
      expect(res.statusCode).toBe(200);
    }
    const list = await s.app.inject({ method: 'GET', url: '/api/executions', headers: auth(token) });
    const retries = list.json().executions.filter((e: { retry_of: string | null }) => e.retry_of === failedId);
    expect(retries).toHaveLength(3);
    const fourth = await s.app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(token), payload: {} });
    expect(fourth.statusCode).toBe(409);
    expect(fourth.json().error).toBe('retry_limit');
    await s.app.close();
  });

  it('el tope se lee del registry: con max 1, el segundo reintento se bloquea', async () => {
    const s = await testServer();
    const { token, org } = await register(s.app);
    const failedId = await failedExecution(s, org.id);
    await s.db.exec("UPDATE policies SET value = '1' WHERE key = 'retry.max_attempts'");
    const first = await s.app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(token), payload: {} });
    expect(first.statusCode).toBe(200);
    const second = await s.app.inject({ method: 'POST', url: `/api/executions/${failedId}/retry`, headers: auth(token), payload: {} });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('retry_limit');
    await s.app.close();
  });

  it('el vencimiento se lee del registry: con expiry 1 día, un borrador de 2 días no aprueba', async () => {
    const s = await testServer();
    const { token } = await register(s.app);
    const created = await s.app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
    expect(created.statusCode).toBe(201);
    const drafts = await s.app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
    const draftId = drafts.json().drafts[0].id as string;
    await s.db.exec("UPDATE policies SET value = '1' WHERE key = 'draft.expiry_days'");
    const old = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
    await s.db.exec('UPDATE drafts SET created_at = ? WHERE id = ?', old, draftId);
    const res = await s.app.inject({ method: 'POST', url: `/api/drafts/${draftId}/approve`, headers: auth(token), payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('draft_expired');
    await s.app.close();
  });
});

describe('C7 — worker asíncrono y reconciliación (alineación PENSIA)', () => {
  it('un job encolado por API se procesa y crea la oportunidad con su ejecución', async () => {
    const { processPendingJobs } = await import('./engine.js');
    const s = await testServer();
    const { token, org } = await register(s.app);
    const enqueued = await s.app.inject({ method: 'POST', url: '/api/jobs', headers: auth(token), payload: OPP });
    expect(enqueued.statusCode).toBe(202);
    const jobId = enqueued.json().job.id as string;
    expect(enqueued.json().job.status).toBe('pending');
    const result = await processPendingJobs(s.db, { actor: 'worker', maxOpportunitiesPerDay: 100 });
    expect(result).toEqual({ processed: 1, done: 1, failed: 0 });
    const job = await s.app.inject({ method: 'GET', url: `/api/jobs/${jobId}`, headers: auth(token) });
    expect(job.json().job.status).toBe('done');
    expect(job.json().job.execution_id).toBeTruthy();
    const opps = await s.app.inject({ method: 'GET', url: '/api/opportunities', headers: auth(token) });
    expect(opps.json().opportunities).toHaveLength(1);
    const missing = await s.app.inject({ method: 'GET', url: '/api/jobs/no-existe', headers: auth(token) });
    expect(missing.statusCode).toBe(404);
    await s.app.close();
  });

  it('la reconciliación marca fallidas las ejecuciones viejas en running y sincroniza corridas', async () => {
    const { reconcileOrphans } = await import('./engine.js');
    const s = await testServer();
    const { org } = await register(s.app);
    const old = new Date(Date.now() - 2 * 3600_000).toISOString();
    const now = nowIso();
    await s.db.exec(
      'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'exec-vieja-running',
      org.id,
      'opportunity.intake',
      '1',
      JSON.stringify(OPP),
      'running',
      old,
      old,
    );
    await s.db.exec(
      'INSERT INTO executions (id, org_id, workflow, workflow_version, input_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'exec-ya-done',
      org.id,
      'opportunity.intake',
      '1',
      JSON.stringify(OPP),
      'done',
      now,
      now,
    );
    await s.db.exec(
      'INSERT INTO process_runs (id, org_id, workflow, workflow_version, status, execution_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'run-huerfana',
      org.id,
      'opportunity.intake',
      '1',
      'running',
      'exec-ya-done',
      now,
      now,
    );
    const result = await reconcileOrphans(s.db);
    expect(result).toEqual({ executionsFailed: 1, runsSynced: 1 });
    await s.app.close();
  });
});
