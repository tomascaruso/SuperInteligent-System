import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

// Pruebas de API de H1 (pausa de agentes, etapas en el detalle de
// proceso, stats con procesos). Cada test levanta su propio servidor
// en memoria; la base real nunca se toca.
async function registerAdmin(app: Awaited<ReturnType<typeof buildServer>>['app']) {
  const inv = await app.inject({
    method: 'POST',
    url: '/api/invitations',
    headers: { 'x-operator-token': 'test-operator' },
    payload: { orgName: 'Agencia Test', email: 'ana@test.com' },
  });
  expect(inv.statusCode).toBe(201);
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/accept-invitation',
    payload: { token: inv.json().token as string, name: 'Ana', password: 'Secreto123' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token as string, org: res.json().org as { id: string } };
}

async function memberToken(app: Awaited<ReturnType<typeof buildServer>>['app'], adminToken: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: 'Luis', email: 'luis@test.com', password: 'Secreto123' },
  });
  expect(created.statusCode).toBe(201);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'luis@test.com', password: 'Secreto123' },
  });
  expect(login.statusCode).toBe(200);
  return login.json().token as string;
}

const OPP = {
  contactName: 'Ana',
  contactEmail: 'ana@empresa.com',
  company: 'Empresa',
  message: 'Necesitamos automatizar el seguimiento',
};

async function newServer() {
  return buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
}

describe('pausa de agentes (H1)', () => {
  it('GET /api/agents deriva el estado: ocupado si tiene tareas abiertas, disponible si no', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: OPP,
    });
    expect(created.statusCode).toBe(201);
    const res = await app.inject({ method: 'GET', url: '/api/agents', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const agents = res.json().agents as Array<{ id: string; paused: boolean; openTasks: number; status: string }>;
    expect(agents.map((a) => a.id)).toEqual(['intake', 'qualification', 'response_proposal', 'follow_up', 'qa_policy']);
    // La tarea del intake es de Seguimiento: solo ese agente está ocupado.
    expect(agents.find((a) => a.id === 'follow_up')).toMatchObject({ paused: false, openTasks: 1, status: 'busy' });
    expect(agents.find((a) => a.id === 'intake')).toMatchObject({ paused: false, openTasks: 0, status: 'available' });
    await app.close();
  });

  it('PATCH /api/agents/:id/paused: solo admin, 404, body inválido, y queda en auditoría', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const member = await memberToken(app, token);

    const forbidden = await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${member}` },
      payload: { paused: true },
    });
    expect(forbidden.statusCode).toBe(403);

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: 'sí' },
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({
      method: 'PATCH',
      url: '/api/agents/noexiste/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: true },
    });
    expect(missing.statusCode).toBe(404);

    const paused = await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: true },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json().agent).toMatchObject({ id: 'intake', paused: true, status: 'paused' });

    const audit = await app.inject({ method: 'GET', url: '/api/audit', headers: { authorization: `Bearer ${token}` } });
    expect(audit.json().audit.some((a: { action: string }) => a.action === 'agent.paused')).toBe(true);

    const resumed = await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: false },
    });
    expect(resumed.json().agent).toMatchObject({ paused: false, status: 'available' });
    await app.close();
  });

  it('un agente en pausa bloquea el alta manual sin crear nada y al reanudar vuelve a funcionar', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: true },
    });
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: OPP,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toBe('agent_paused');
    expect(blocked.json().message).toContain('Captación');

    // Nada de negocio creado, pero el intento queda visible.
    const opps = await app.inject({ method: 'GET', url: '/api/opportunities', headers: { authorization: `Bearer ${token}` } });
    expect(opps.json().opportunities).toHaveLength(0);
    const tasks = await app.inject({ method: 'GET', url: '/api/tasks', headers: { authorization: `Bearer ${token}` } });
    expect(tasks.json().tasks).toHaveLength(0);
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: { authorization: `Bearer ${token}` } });
    expect(drafts.json().drafts).toHaveLength(0);
    const executions = await app.inject({ method: 'GET', url: '/api/executions', headers: { authorization: `Bearer ${token}` } });
    expect(executions.json().executions).toHaveLength(1);
    expect(executions.json().executions[0].status).toBe('failed');
    const processes = await app.inject({ method: 'GET', url: '/api/processes', headers: { authorization: `Bearer ${token}` } });
    expect(processes.json().processes).toHaveLength(1);
    expect(processes.json().processes[0].status).toBe('failed');
    const detail = await app.inject({
      method: 'GET',
      url: `/api/processes/${processes.json().processes[0].id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.json().stages[0].status).toBe('paused');
    expect(detail.json().currentStageId).toBe('recepcion');

    await app.inject({
      method: 'PATCH',
      url: '/api/agents/intake/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: false },
    });
    const ok = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: OPP,
    });
    expect(ok.statusCode).toBe(201);
    await app.close();
  });

  it('un agente en pausa bloquea también el webhook con 409 y no deja clave de idempotencia', async () => {
    const { app } = await newServer();
    const { token, org } = await registerAdmin(app);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${token}` } });
    const secret = me.json().org.webhook_secret as string;
    await app.inject({
      method: 'PATCH',
      url: '/api/agents/follow_up/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: true },
    });
    const raw = JSON.stringify(OPP);
    const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/ingest/${org.id}`,
      headers: { 'x-signature': signature, 'content-type': 'application/json' },
      payload: raw,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toBe('agent_paused');
    await app.inject({
      method: 'PATCH',
      url: '/api/agents/follow_up/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: false },
    });
    const ok = await app.inject({
      method: 'POST',
      url: `/api/ingest/${org.id}`,
      headers: { 'x-signature': signature, 'content-type': 'application/json' },
      payload: raw,
    });
    expect(ok.statusCode).toBe(201);
    await app.close();
  });
});

describe('procesos y stats (H1)', () => {
  it('GET /api/stats suma procesos en curso y completados; el detalle trae etapas y cliente', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: OPP,
    });
    expect(created.statusCode).toBe(201);
    const stats = await app.inject({ method: 'GET', url: '/api/stats', headers: { authorization: `Bearer ${token}` } });
    expect(stats.json()).toMatchObject({ runningProcesses: 0, doneProcesses: 1 });
    const list = await app.inject({ method: 'GET', url: '/api/processes', headers: { authorization: `Bearer ${token}` } });
    expect(list.json().processes).toHaveLength(1);
    expect(list.json().processes[0].opportunity).toEqual({ contact_name: 'Ana', company: 'Empresa' });
    const detail = await app.inject({
      method: 'GET',
      url: `/api/processes/${list.json().processes[0].id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().stages.map((s: { id: string }) => s.id)).toEqual([
      'recepcion',
      'analisis',
      'validacion',
      'aprobacion',
      'resultado',
    ]);
    expect(detail.json().currentStageId).toBe('aprobacion');
    expect(detail.json().opportunity).toMatchObject({ contact_name: 'Ana', company: 'Empresa' });
    const missing = await app.inject({
      method: 'GET',
      url: '/api/processes/noexiste',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
