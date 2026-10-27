// R3b — Borrador editable + plantilla humanizada. Suite contra
// una base SQLite en memoria nueva por test, mismo patrón que
// system.test.ts (invitación de operador + inject, sin servicios
// externos ni datos reales).
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { classifyOpportunity, draftBody } from './domain.js';
import { exec, newId } from './db.js';

async function testServer(max = 100) {
  return await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: max, operatorToken: 'test-operator' });
}

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
  return res.json() as { token: string; org: { id: string } };
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

async function createOppWithDraft(app: Awaited<ReturnType<typeof buildServer>>['app'], token: string) {
  const created = await app.inject({ method: 'POST', url: '/api/opportunities', headers: auth(token), payload: OPP });
  expect(created.statusCode).toBe(201);
  const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: auth(token) });
  expect(drafts.json().drafts).toHaveLength(1);
  return { opp: created.json().opportunity as { id: string }, draft: drafts.json().drafts[0] as { id: string; body: string } };
}

describe('R3b — edición del borrador', () => {
  it('editar OK: cambia el body, marca edited y audita, sin decidir', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const { opp, draft } = await createOppWithDraft(app, token);
    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draft.id}`,
      headers: auth(token),
      payload: { body: 'Hola Lucía, te escribo con una propuesta a medida para Empresa Ejemplo.' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().draft.body).toContain('propuesta a medida');
    expect(edited.json().draft.edited).toBe(true);
    expect(edited.json().draft.edited_at).toBeTruthy();
    expect(edited.json().draft.status).toBe('pending_approval');
    const auditRes = await app.inject({ method: 'GET', url: `/api/audit?opportunityId=${opp.id}`, headers: auth(token) });
    const actions = auditRes.json().audit.map((a: { action: string }) => a.action);
    expect(actions).toContain('draft.edited');
    await app.close();
  });

  it('editar un borrador ya decidido da 409', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const { draft } = await createOppWithDraft(app, token);
    const approved = await app.inject({ method: 'POST', url: `/api/drafts/${draft.id}/approve`, headers: auth(token), payload: {} });
    expect(approved.statusCode).toBe(200);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draft.id}`,
      headers: auth(token),
      payload: { body: 'Otro texto' },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('editar un borrador vencido da 409 draft_expired', async () => {
    const { app, db } = await testServer();
    const { token, org } = await register(app);
    const { opp } = await createOppWithDraft(app, token);
    const oldId = newId();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600_000).toISOString();
    await exec(
      db,
      'INSERT INTO drafts (id, org_id, opportunity_id, body, source_message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      oldId,
      org.id,
      opp.id,
      'Texto viejo',
      OPP.message,
      'pending_approval',
      tenDaysAgo,
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${oldId}`,
      headers: auth(token),
      payload: { body: 'Texto nuevo' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('draft_expired');
    await app.close();
  });

  it('editar un borrador desactualizado da 409 draft_stale', async () => {
    const { app, db } = await testServer();
    const { token, org } = await register(app);
    const { opp } = await createOppWithDraft(app, token);
    const staleId = newId();
    await exec(
      db,
      'INSERT INTO drafts (id, org_id, opportunity_id, body, source_message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      staleId,
      org.id,
      opp.id,
      'Texto viejo',
      'un mensaje distinto al actual',
      'pending_approval',
      new Date().toISOString(),
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${staleId}`,
      headers: auth(token),
      payload: { body: 'Texto nuevo' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('draft_stale');
    await app.close();
  });

  it('un member no puede editar (403)', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const { draft } = await createOppWithDraft(app, token);
    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: auth(token),
      payload: { name: 'Luis', email: 'luis@test.com', password: 'Secreto123' },
    });
    expect(memberRes.statusCode).toBe(201);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'luis@test.com', password: 'Secreto123' } });
    const memberToken = login.json().token as string;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draft.id}`,
      headers: auth(memberToken),
      payload: { body: 'Texto nuevo' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('body vacío o mayor a 5000 da 400', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const { draft } = await createOppWithDraft(app, token);
    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draft.id}`,
      headers: auth(token),
      payload: { body: '   ' },
    });
    expect(empty.statusCode).toBe(400);
    const long = await app.inject({
      method: 'PATCH',
      url: `/api/drafts/${draft.id}`,
      headers: auth(token),
      payload: { body: 'x'.repeat(5001) },
    });
    expect(long.statusCode).toBe(400);
    await app.close();
  });

  it('editar un borrador inexistente da 404', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/drafts/no-existe',
      headers: auth(token),
      payload: { body: 'Texto' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('R3b — plantilla humanizada', () => {
  it('llamada (alta): frase humana, sin la línea vieja', () => {
    const n = {
      contactName: 'Lucía Fernández',
      contactEmail: 'lucia@empresaejemplo.com',
      company: 'Empresa Ejemplo',
      message: 'Necesitamos automatizar urgente, esta semana. Tenemos presupuesto aprobado.',
      source: 'manual',
    };
    const c = classifyOpportunity(n);
    expect(c.nextAction).toBe('Llamar en menos de 24 h');
    const body = draftBody(n, c);
    expect(body).toContain('¿Te parece si agendamos una breve llamada en las próximas 24 horas');
    expect(body).not.toContain('Propuesta de siguiente paso');
  });

  it('propuesta (media): frase humana de 48 h', () => {
    const n = {
      contactName: 'Pedro Gómez',
      contactEmail: 'pedro@negocio.com',
      company: 'Negocio SRL',
      message: 'Buscamos apoyo en marketing para nuestras redes.',
      source: 'manual',
    };
    const c = classifyOpportunity(n);
    expect(c.nextAction).toBe('Enviar propuesta en 48 h');
    const body = draftBody(n, c);
    expect(body).toContain('En las próximas 48 horas te vamos a enviar una propuesta');
    expect(body).not.toContain('Propuesta de siguiente paso');
  });

  it('calificación (baja, general): frase humana y sin "apoyo en general"', () => {
    const n = {
      contactName: 'Ana Ruiz',
      contactEmail: 'ana@gmail.com',
      company: '',
      message: 'Me interesa saber más sobre sus servicios.',
      source: 'manual',
    };
    const c = classifyOpportunity(n);
    expect(c.nextAction).toBe('Enviar mensaje de calificación');
    const body = draftBody(n, c);
    expect(body).toContain('Te escribo para conocer un poco mejor lo que necesitan');
    expect(body).not.toContain('Propuesta de siguiente paso');
    expect(body).not.toContain('apoyo en general');
    expect(body).toContain('apoyo con su negocio');
  });

  it('el alta nueva ya trae la plantilla humanizada', async () => {
    const { app } = await testServer();
    const { token } = await register(app);
    const { draft } = await createOppWithDraft(app, token);
    expect(draft.body).toContain('¿Te parece si agendamos una breve llamada en las próximas 24 horas');
    expect(draft.body).not.toContain('Propuesta de siguiente paso');
    await app.close();
  });
});
