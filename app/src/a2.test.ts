import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { exec, newId } from './db.js';

// Pruebas de A2 (residuos de la auditoría UI 27-oct-2026).
// Punto 3: al completar una tarea, el evento task.updated cita a la
// oportunidad de la tarea (igual que task.created y draft.created),
// para que la línea de tiempo de la oportunidad
// (GET /api/audit?opportunityId=) lo incluya. Solo afecta a eventos
// futuros: las filas viejas no se reescriben.
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
  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { authorization: `Bearer ${res.json().token as string}` },
  });
  return {
    token: res.json().token as string,
    org: me.json().org as { id: string; webhook_secret: string },
  };
}

async function newServer() {
  return buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
}

async function createOpportunityWithTask(token: string, app: Awaited<ReturnType<typeof buildServer>>['app']) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/opportunities',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      contactName: 'Lucía',
      contactEmail: 'lucia@empresa.com',
      company: 'Empresa',
      message: 'Hola, queremos automatizar el seguimiento.',
    },
  });
  expect(created.statusCode).toBe(201);
  const oppId = created.json().opportunity.id as string;
  const tasks = await app.inject({
    method: 'GET',
    url: '/api/tasks',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(tasks.statusCode).toBe(200);
  const task = tasks.json().tasks.find((t: { opportunity_id: string }) => t.opportunity_id === oppId);
  expect(task).toBeDefined();
  return { oppId, taskId: task.id as string };
}

describe('A2 punto 3: task.updated cita a la oportunidad', () => {
  it('completar una tarea genera task.updated con opportunityId y la línea de tiempo lo incluye', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const { oppId, taskId } = await createOpportunityWithTask(token, app);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    });
    expect(patched.statusCode).toBe(200);

    const timeline = await app.inject({
      method: 'GET',
      url: `/api/audit?opportunityId=${oppId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(timeline.statusCode).toBe(200);
    const updated = timeline.json().audit.find((e: { action: string }) => e.action === 'task.updated');
    expect(updated).toBeDefined();
    expect(updated.entity).toBe('task');
    expect(updated.entity_id).toBe(taskId);
    const detail = JSON.parse(updated.detail_json as string);
    expect(detail.status).toBe('done');
    expect(detail.opportunityId).toBe(oppId);

    await app.close();
  });

  it('las filas viejas de task.updated no se reescriben: solo los eventos nuevos citan a la oportunidad', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    // Fila vieja, escrita antes de A2: sin opportunityId en el detalle.
    await exec(
      db,
      'INSERT INTO audit_log (id, org_id, actor, action, entity, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      org.id,
      'viejo@test.com',
      'task.updated',
      'task',
      'tarea-vieja',
      JSON.stringify({ status: 'done' }),
      '2026-01-01T00:00:00.000Z',
    );
    const { oppId, taskId } = await createOpportunityWithTask(token, app);
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    });
    expect(patched.statusCode).toBe(200);

    const all = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(all.statusCode).toBe(200);
    const legacy = all.json().audit.find((e: { entity_id: string }) => e.entity_id === 'tarea-vieja');
    expect(legacy).toBeDefined();
    expect(JSON.parse(legacy.detail_json as string)).not.toHaveProperty('opportunityId');
    const fresh = all.json().audit.find(
      (e: { action: string; entity_id: string }) => e.action === 'task.updated' && e.entity_id === taskId,
    );
    expect(fresh).toBeDefined();
    expect(JSON.parse(fresh.detail_json as string).opportunityId).toBe(oppId);

    await app.close();
  });
});
