import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { exec, newId, nowIso } from './db.js';
import { encryptCredentials, ProviderError, type MailProvider } from './sending.js';

// Pruebas de F0 + F1 (envío por Gmail tras aprobar, diseño de
// 28-oct-2026). NUNCA hay envíos reales: el proveedor es simulado y
// se inyecta por RouteOptions. Solo se prueba el camino real de
// Gmail cuando Tomás autorice cuentas de prueba (decisión pendiente
// del diseño, fuera de estos tests).

const TEST_KEY = 'clave-de-prueba-f0f1';

class FakeMailProvider implements MailProvider {
  calls: Array<{ to: string; subject: string; body: string }> = [];
  failWith: ProviderError | null = null;
  async send(input: { to: string; subject: string; body: string; credentials: { access_token: string } }) {
    this.calls.push({ to: input.to, subject: input.subject, body: input.body });
    if (this.failWith) throw this.failWith;
    return { providerMessageId: 'fake-msg-1' };
  }
}

type App = Awaited<ReturnType<typeof buildServer>>['app'];

async function registerAdmin(app: App) {
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

// key = null significa "sin clave" (pasar undefined dispararía el
// default de JS y la clave terminaría siendo la de prueba).
async function newServer(fake = new FakeMailProvider(), key: string | null = TEST_KEY) {
  const built = await buildServer({
    dbPath: ':memory:',
    jwtSecret: 'test-secret',
    maxOpportunitiesPerDay: 100,
    operatorToken: 'test-operator',
    mailProvider: fake,
    connectionEncryptionKey: key === null ? undefined : key,
  });
  return { ...built, fake };
}

async function createOpportunity(
  token: string,
  app: App,
  extra: Record<string, unknown> = {},
) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/opportunities',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      contactName: 'Lucía',
      contactEmail: 'lucia@empresa.com',
      company: 'Empresa',
      message: 'Hola, queremos automatizar el seguimiento.',
      ...extra,
    },
  });
  expect(created.statusCode).toBe(201);
  const oppId = created.json().opportunity.id as string;
  const drafts = await app.inject({
    method: 'GET',
    url: '/api/drafts',
    headers: { authorization: `Bearer ${token}` },
  });
  const draft = drafts.json().drafts.find((d: { opportunity_id: string }) => d.opportunity_id === oppId);
  expect(draft).toBeDefined();
  return { oppId, draftId: draft.id as string };
}

async function connectGmail(db: Awaited<ReturnType<typeof buildServer>>['db'], orgId: string, status = 'connected') {
  await exec(
    db,
    'INSERT INTO org_connections (id, org_id, provider, status, display_account, credentials_ciphertext, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    orgId,
    'gmail',
    status,
    'equipo@empresa.com',
    encryptCredentials(JSON.stringify({ access_token: 'token-simulado' }), TEST_KEY),
    nowIso(),
    nowIso(),
    nowIso(),
  );
}

async function timeline(token: string, app: App, oppId: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/audit?opportunityId=${oppId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  return res.json().audit as Array<{ action: string; entity: string; detail_json: string }>;
}

describe('F0: teléfono en la oportunidad', () => {
  it('el teléfono se normaliza, se guarda y vuelve en la lectura', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const { oppId } = await createOpportunity(token, app, { contactPhone: '+54 9 11 1234-5678' });
    const res = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().opportunity.contact_phone).toBe('+5491112345678');
    await app.close();
  });

  it('un teléfono inválido da 400 y sin teléfono queda null', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contactName: 'Lucía',
        contactEmail: 'lucia@empresa.com',
        company: 'Empresa',
        message: 'Hola.',
        contactPhone: 'abc',
      },
    });
    expect(bad.statusCode).toBe(400);
    const { oppId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().opportunity.contact_phone).toBeNull();
    await app.close();
  });

  it('la clave de dedup no cambia: mismo contacto con otro teléfono no duplica', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const first = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const second = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        contactName: 'Lucía',
        contactEmail: 'lucia@empresa.com',
        company: 'Empresa',
        message: 'Hola, queremos automatizar el seguimiento.',
        contactPhone: '+5491187654321',
      },
    });
    expect(second.json().duplicate).toBe(true);
    expect(second.json().opportunity.id).toBe(first.oppId);
    await app.close();
  });
});

describe('F1: aprobar con canal Gmail', () => {
  it('aprobar con Gmail conectado envía, registra entrega sent y evento message.sent', async () => {
    const { app, db, fake } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { oppId, draftId } = await createOpportunity(token, app);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().draft.status).toBe('approved');
    const delivery = approved.json().delivery;
    expect(delivery).toBeDefined();
    expect(delivery.channel).toBe('gmail');
    expect(delivery.status).toBe('sent');
    expect(delivery.provider_message_id).toBe('fake-msg-1');
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].to).toBe('lucia@empresa.com');
    expect(fake.calls[0].subject).toContain('Agencia Test');
    expect(fake.calls[0].body).toContain('Hola Lucía');

    const events = await timeline(token, app, oppId);
    const sent = events.find((e) => e.action === 'message.sent');
    expect(sent).toBeDefined();
    expect(sent!.entity).toBe('delivery');
    const detail = JSON.parse(sent!.detail_json);
    expect(detail.channel).toBe('gmail');
    expect(detail.opportunityId).toBe(oppId);
    expect(detail.providerMessageId).toBe('fake-msg-1');
    expect(detail.recipient).toBe('lucia@empresa.com');

    // Una entrega por borrador: el segundo intento de aprobar da 409
    // y no genera otro envío.
    const again = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(again.statusCode).toBe(409);
    expect(fake.calls).toHaveLength(1);
    await app.close();
  });

  it('aprobar sin canal no envía nada y se comporta como antes', async () => {
    const { app, db, fake } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { oppId, draftId } = await createOpportunity(token, app);
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().delivery).toBeNull();
    expect(fake.calls).toHaveLength(0);
    const events = await timeline(token, app, oppId);
    expect(events.some((e) => e.action.startsWith('message.'))).toBe(false);
    await app.close();
  });

  it('aprobar con Gmail sin conexión da 409 channel_unavailable sin decidir', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const { draftId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('channel_unavailable');
    const drafts = await app.inject({
      method: 'GET',
      url: '/api/drafts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(drafts.json().drafts.find((d: { id: string }) => d.id === draftId).status).toBe('pending_approval');
    await app.close();
  });

  it('aprobar con conexión en error también da channel_unavailable', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id, 'error');
    const { draftId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('channel_unavailable');
    await app.close();
  });

  it('aprobar con WhatsApp en F1 da channel_unavailable sin decidir', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('channel_unavailable');
    await app.close();
  });

  it('aprobar con el agente en pausa da 409 agent_paused sin decidir ni guardar', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { draftId } = await createOpportunity(token, app);
    const paused = await app.inject({
      method: 'PATCH',
      url: '/api/agents/response_proposal/paused',
      headers: { authorization: `Bearer ${token}` },
      payload: { paused: true },
    });
    expect(paused.statusCode).toBe(200);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('agent_paused');
    const drafts = await app.inject({
      method: 'GET',
      url: '/api/drafts',
      headers: { authorization: `Bearer ${token}` },
    });
    const draft = drafts.json().drafts.find((d: { id: string }) => d.id === draftId);
    expect(draft.status).toBe('pending_approval');
    expect(draft.delivery).toBeNull();
    await app.close();
  });

  it('sin clave de cifrado el envío queda cerrado: entrega failed connection_error', async () => {
    const fake = new FakeMailProvider();
    const { app, db } = await newServer(fake, null);
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { draftId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().draft.status).toBe('approved');
    expect(res.json().delivery.status).toBe('failed');
    expect(res.json().delivery.error_code).toBe('connection_error');
    expect(fake.calls).toHaveLength(0);
    await app.close();
  });
});

describe('F1: fallo y reintento de entrega', () => {
  it('el fallo del proveedor deja failed + message.failed y la oportunidad no queda como comunicada', async () => {
    const fake = new FakeMailProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { oppId, draftId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().draft.status).toBe('approved');
    expect(res.json().delivery.status).toBe('failed');
    expect(res.json().delivery.error_code).toBe('provider_error');
    const events = await timeline(token, app, oppId);
    expect(events.some((e) => e.action === 'message.sent')).toBe(false);
    const failed = events.find((e) => e.action === 'message.failed');
    expect(failed).toBeDefined();
    expect(JSON.parse(failed!.detail_json).errorCode).toBe('provider_error');
    const drafts = await app.inject({
      method: 'GET',
      url: '/api/drafts',
      headers: { authorization: `Bearer ${token}` },
    });
    const draft = drafts.json().drafts.find((d: { id: string }) => d.id === draftId);
    expect(draft.delivery.status).toBe('failed');
    await app.close();
  });

  it('reintento admin tras arreglar el proveedor envía; member no puede; enviada no se reintenta', async () => {
    const fake = new FakeMailProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const { draftId } = await createOpportunity(token, app);
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    const deliveryId = approved.json().delivery.id as string;

    // Member: crear usuario member y loguearse.
    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Beto', email: 'beto@test.com', password: 'Secreto123' },
    });
    expect(created.statusCode).toBe(201);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'beto@test.com', password: 'Secreto123' },
    });
    const memberToken = login.json().token as string;
    const denied = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(denied.statusCode).toBe(403);

    fake.failWith = null;
    const retried = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(retried.statusCode).toBe(200);
    expect(retried.json().delivery.status).toBe('sent');
    const again = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('conflict');
    await app.close();
  });

  it('el tope de reintentos se cumple: con max 2, el tercer intento da retry_limit', async () => {
    const fake = new FakeMailProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    await exec(db, "UPDATE policies SET value = '2' WHERE key = 'send.retry.max_attempts'");
    const { draftId } = await createOpportunity(token, app);
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'gmail' },
    });
    const deliveryId = approved.json().delivery.id as string;
    const first = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().delivery.attempts).toBe(2);
    const second = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('retry_limit');
    await app.close();
  });
});

describe('F1: conexiones sin secretos y OAuth cerrado sin configurar', () => {
  it('GET /api/connections no devuelve credenciales', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectGmail(db, org.id);
    const res = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().connections).toHaveLength(1);
    expect(res.json().connections[0].provider).toBe('gmail');
    expect(res.json().connections[0].display_account).toBe('equipo@empresa.com');
    expect(res.body).not.toContain('credentials_ciphertext');
    expect(res.body).not.toContain('token-simulado');
    await app.close();
  });

  it('el inicio de OAuth sin credenciales de Google da 503, no un flujo fingido', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/gmail/oauth/start',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('not_configured');
    await app.close();
  });
});
