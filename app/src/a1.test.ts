import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { exec, ensureOpportunityScoreColumn } from './db.js';

// Pruebas de A1 (correcciones de la auditoría UI 27-oct-2026).
// P1-1: el puntaje se persiste en el alta y se devuelve en la API, y el
// backfill lo calcula para filas viejas sin puntaje. Cada test levanta
// su propio servidor en memoria; la base real nunca se toca.
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

describe('A1 P1-1: puntaje persistido y devuelto', () => {
  it('el alta manual persiste el puntaje y la lista lo devuelve', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    // urgente +2, presupuesto +1, empresa +1, dominio corporativo +1,
    // categoría automatización (no general) +1 = 6.
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contactName: 'Lucía',
        contactEmail: 'lucia@empresa.com',
        company: 'Empresa',
        message: 'Urgente: necesitamos automatizar el seguimiento esta semana. Tenemos presupuesto aprobado.',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().opportunity.score).toBe(6);
    const list = await app.inject({
      method: 'GET',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().opportunities[0].score).toBe(6);
    await app.close();
  });

  it('el webhook persiste el puntaje', async () => {
    const { app } = await newServer();
    const { org } = await registerAdmin(app);
    // empresa +1, dominio corporativo +1 = 2 (sin urgencia ni presupuesto,
    // categoría general).
    const raw = JSON.stringify({ contactName: 'Pedro', contactEmail: 'pedro@negocio.com', company: 'Negocio SRL', message: 'Hola' });
    const sig = `sha256=${createHmac('sha256', org.webhook_secret).update(raw).digest('hex')}`;
    const res = await app.inject({
      method: 'POST',
      url: `/api/ingest/${org.id}`,
      payload: raw,
      headers: { 'content-type': 'application/json', 'x-signature': sig },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().opportunity.score).toBe(2);
    await app.close();
  });

  it('el alta duplicada recalcula el puntaje con el mensaje nuevo', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const base = { contactName: 'Pedro', contactEmail: 'pedro@negocio.com', company: 'Negocio SRL' };
    const first = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...base, message: 'Hola' },
    });
    expect(first.json().opportunity.score).toBe(2);
    const second = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: { ...base, message: 'Urgente: automatizar cuanto antes, con presupuesto aprobado.' },
    });
    expect(second.json().duplicate).toBe(true);
    expect(second.json().opportunity.score).toBe(6);
    await app.close();
  });

  it('el backfill calcula el puntaje de una fila vieja sin score', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await exec(
      db,
      'INSERT INTO opportunities (id, org_id, contact_name, contact_email, company, message, source, status, category, priority, dedup_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'legacy-1',
      org.id,
      'Juan',
      'juan@tech.com',
      'Tech SRL',
      'Necesitamos automatizar urgente, tenemos presupuesto.',
      'manual',
      'new',
      'automatización',
      'high',
      'legacy-dedup-1',
      '2026-10-20T10:00:00.000Z',
      '2026-10-20T10:00:00.000Z',
    );
    await ensureOpportunityScoreColumn(db);
    const list = await app.inject({
      method: 'GET',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
    });
    const legacy = list.json().opportunities.find((o: { id: string }) => o.id === 'legacy-1');
    expect(legacy.score).toBe(6);
    await app.close();
  });
});
