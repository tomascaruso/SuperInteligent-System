import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { exec, newId, nowIso } from './db.js';
import { encryptCredentials, ProviderError, type WhatsAppProvider } from './sending.js';

// Pruebas de F2 (envío por WhatsApp Business tras aprobar, diseño de
// 28-oct-2026). NUNCA hay envíos reales: el proveedor es simulado y
// se inyecta por RouteOptions. El proveedor real de la Cloud API de
// Meta solo corre con credenciales de operador y cuentas de prueba
// autorizadas expresamente por Tomás (decisión pendiente, fuera de
// estos tests). La máscara del teléfono en Actividad ya vive en
// lib/mask.ts (clave `recipient` → teléfono) y la cubre
// client/src/lib/mask.test.ts desde F1; acá se verifica que el
// servidor emita recipient = teléfono en los eventos message.*.

const TEST_KEY = 'clave-de-prueba-f2';

class FakeWhatsAppProvider implements WhatsAppProvider {
  calls: Array<{ to: string; phoneNumberId: string; body: string }> = [];
  failWith: ProviderError | null = null;
  verifyFailWith: ProviderError | null = null;
  displayPhoneNumber = '+54 9 11 1234-5678';
  async verify(credentials: { phone_number_id: string; token: string }) {
    if (this.verifyFailWith) throw this.verifyFailWith;
    if (credentials.token === '') throw new ProviderError('connection_error', 'Token vacío');
    return { displayPhoneNumber: this.displayPhoneNumber };
  }
  async send(input: { to: string; phoneNumberId: string; body: string; credentials: { token: string } }) {
    this.calls.push({ to: input.to, phoneNumberId: input.phoneNumberId, body: input.body });
    if (this.failWith) throw this.failWith;
    return { providerMessageId: 'wamid.fake-1' };
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

async function newServer(fake = new FakeWhatsAppProvider(), key: string | null = TEST_KEY) {
  const built = await buildServer({
    dbPath: ':memory:',
    jwtSecret: 'test-secret',
    maxOpportunitiesPerDay: 100,
    operatorToken: 'test-operator',
    whatsappProvider: fake,
    connectionEncryptionKey: key === null ? undefined : key,
  });
  return { ...built, fake };
}

async function createOpportunity(token: string, app: App, extra: Record<string, unknown> = {}) {
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

async function connectWhatsApp(
  db: Awaited<ReturnType<typeof buildServer>>['db'],
  orgId: string,
  status = 'connected',
) {
  await exec(
    db,
    'INSERT INTO org_connections (id, org_id, provider, status, display_account, credentials_ciphertext, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    orgId,
    'whatsapp',
    status,
    '+54 9 11 1234-5678',
    encryptCredentials(JSON.stringify({ phone_number_id: 'pn-1', token: 'token-simulado' }), TEST_KEY),
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

async function createMember(app: App, adminToken: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: 'Beto', email: 'beto@test.com', password: 'Secreto123' },
  });
  expect(created.statusCode).toBe(201);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'beto@test.com', password: 'Secreto123' },
  });
  return login.json().token as string;
}

describe('F2: registro de la conexión WhatsApp', () => {
  it('registra con verificación ok: connected, número verificado y sin secretos en la respuesta', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/whatsapp',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        phoneNumber: '+5491112345678',
        phoneNumberId: 'pn-1',
        token: 'token-secreto-de-prueba',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().connection.provider).toBe('whatsapp');
    expect(res.json().connection.status).toBe('connected');
    expect(res.json().connection.display_account).toBe('+54 9 11 1234-5678');
    expect(res.body).not.toContain('credentials_ciphertext');
    expect(res.body).not.toContain('token-secreto-de-prueba');

    const list = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().connections).toHaveLength(1);
    expect(list.body).not.toContain('token-secreto-de-prueba');
    await app.close();
  });

  it('verificación fallida: 409, la fila queda en error y aprobar no puede usar el canal', async () => {
    const fake = new FakeWhatsAppProvider();
    fake.verifyFailWith = new ProviderError('connection_error', 'Meta rechazó la credencial (401)');
    const { app } = await newServer(fake);
    const { token } = await registerAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/whatsapp',
      headers: { authorization: `Bearer ${token}` },
      payload: { phoneNumber: '+5491112345678', phoneNumberId: 'pn-1', token: 'token-malo' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('connection_error');
    expect(res.json().connection.status).toBe('error');

    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(approved.statusCode).toBe(409);
    expect(approved.json().error).toBe('channel_unavailable');
    await app.close();
  });

  it('sin clave de cifrado el registro queda cerrado con 503', async () => {
    const { app } = await newServer(new FakeWhatsAppProvider(), null);
    const { token } = await registerAdmin(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/whatsapp',
      headers: { authorization: `Bearer ${token}` },
      payload: { phoneNumber: '+5491112345678', phoneNumberId: 'pn-1', token: 'token-x' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('not_configured');
    await app.close();
  });

  it('solo admin puede registrar; un cuerpo inválido da 400', async () => {
    const { app } = await newServer();
    const { token } = await registerAdmin(app);
    const memberToken = await createMember(app, token);
    const denied = await app.inject({
      method: 'POST',
      url: '/api/connections/whatsapp',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { phoneNumber: '+5491112345678', phoneNumberId: 'pn-1', token: 'token-x' },
    });
    expect(denied.statusCode).toBe(403);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/connections/whatsapp',
      headers: { authorization: `Bearer ${token}` },
      payload: { phoneNumber: 'abc', phoneNumberId: 'pn-1', token: 'token-x' },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it('re-verificar actualiza el estado: ok vuelve a connected, fallo deja error', async () => {
    const fake = new FakeWhatsAppProvider();
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id, 'error');
    const list = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { authorization: `Bearer ${token}` },
    });
    const connId = list.json().connections[0].id as string;
    const ok = await app.inject({
      method: 'POST',
      url: `/api/connections/${connId}/verify`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().connection.status).toBe('connected');

    fake.verifyFailWith = new ProviderError('connection_error', 'Meta rechazó la credencial (401)');
    const bad = await app.inject({
      method: 'POST',
      url: `/api/connections/${connId}/verify`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(bad.statusCode).toBe(409);
    const after = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(after.json().connections[0].status).toBe('error');
    await app.close();
  });

  it('desconectar marca revoked y aprobar con whatsapp vuelve a dar 409', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const list = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { authorization: `Bearer ${token}` },
    });
    const connId = list.json().connections[0].id as string;
    const off = await app.inject({
      method: 'POST',
      url: `/api/connections/${connId}/disconnect`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().connection.status).toBe('revoked');
    expect(off.body).not.toContain('token-simulado');

    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(approved.statusCode).toBe(409);
    expect(approved.json().error).toBe('channel_unavailable');
    await app.close();
  });
});

describe('F2: aprobar con canal WhatsApp', () => {
  it('aprobar con WhatsApp conectado envía el borrador, registra sent y message.sent con teléfono', async () => {
    const { app, db, fake } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { oppId, draftId } = await createOpportunity(token, app, { contactPhone: '+54 9 11 1234-5678' });

    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().draft.status).toBe('approved');
    const delivery = approved.json().delivery;
    expect(delivery.channel).toBe('whatsapp');
    expect(delivery.status).toBe('sent');
    expect(delivery.provider_message_id).toBe('wamid.fake-1');
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].to).toBe('+5491112345678');
    expect(fake.calls[0].phoneNumberId).toBe('pn-1');
    expect(fake.calls[0].body).toContain('Hola Lucía');

    const events = await timeline(token, app, oppId);
    const sent = events.find((e) => e.action === 'message.sent');
    expect(sent).toBeDefined();
    expect(sent!.entity).toBe('delivery');
    const detail = JSON.parse(sent!.detail_json);
    expect(detail.channel).toBe('whatsapp');
    expect(detail.opportunityId).toBe(oppId);
    expect(detail.providerMessageId).toBe('wamid.fake-1');
    // El servidor guarda el destinatario completo; la vista de
    // Actividad lo enmascara por la clave `recipient` (mask.test.ts).
    expect(detail.recipient).toBe('+5491112345678');

    // Una entrega por borrador: el segundo intento de aprobar da 409
    // y no genera otro envío.
    const again = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(again.statusCode).toBe(409);
    expect(fake.calls).toHaveLength(1);
    await app.close();
  });

  it('aprobar con WhatsApp sin conexión da 409 channel_unavailable sin decidir', async () => {
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
    const drafts = await app.inject({
      method: 'GET',
      url: '/api/drafts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(drafts.json().drafts.find((d: { id: string }) => d.id === draftId).status).toBe('pending_approval');
    await app.close();
  });

  it('aprobar con WhatsApp conectado pero sin teléfono da 409 sin decidir', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { draftId } = await createOpportunity(token, app);
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('channel_unavailable');
    expect(res.json().message).toContain('teléfono');
    const drafts = await app.inject({
      method: 'GET',
      url: '/api/drafts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(drafts.json().drafts.find((d: { id: string }) => d.id === draftId).status).toBe('pending_approval');
    await app.close();
  });

  it('aprobar con el agente en pausa da 409 agent_paused sin decidir', async () => {
    const { app, db } = await newServer();
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
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
      payload: { channel: 'whatsapp' },
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

  it('ventana cerrada: entrega failed window_closed y evento message.failed', async () => {
    const fake = new FakeWhatsAppProvider();
    fake.failWith = new ProviderError('window_closed', 'La ventana de 24 horas está cerrada');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { oppId, draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().draft.status).toBe('approved');
    expect(res.json().delivery.status).toBe('failed');
    expect(res.json().delivery.error_code).toBe('window_closed');
    const events = await timeline(token, app, oppId);
    expect(events.some((e) => e.action === 'message.sent')).toBe(false);
    const failed = events.find((e) => e.action === 'message.failed');
    expect(failed).toBeDefined();
    const detail = JSON.parse(failed!.detail_json);
    expect(detail.errorCode).toBe('window_closed');
    expect(detail.recipient).toBe('+5491112345678');
    await app.close();
  });
});

describe('F2: fallo y reintento de entrega WhatsApp', () => {
  it('reintento admin tras arreglar el proveedor envía; member no puede; enviada no se reintenta', async () => {
    const fake = new FakeWhatsAppProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    expect(approved.json().delivery.status).toBe('failed');
    const deliveryId = approved.json().delivery.id as string;

    const memberToken = await createMember(app, token);
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
    expect(retried.json().delivery.channel).toBe('whatsapp');
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
    const fake = new FakeWhatsAppProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    await exec(db, "UPDATE policies SET value = '2' WHERE key = 'send.retry.max_attempts'");
    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
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

  it('el reintento de una entrega whatsapp con la conexión caída da channel_unavailable', async () => {
    const fake = new FakeWhatsAppProvider();
    fake.failWith = new ProviderError('provider_error', 'El proveedor falló');
    const { app, db } = await newServer(fake);
    const { token, org } = await registerAdmin(app);
    await connectWhatsApp(db, org.id);
    const { draftId } = await createOpportunity(token, app, { contactPhone: '+5491112345678' });
    const approved = await app.inject({
      method: 'POST',
      url: `/api/drafts/${draftId}/approve`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'whatsapp' },
    });
    const deliveryId = approved.json().delivery.id as string;
    await exec(db, "UPDATE org_connections SET status = 'error' WHERE org_id = ? AND provider = 'whatsapp'", org.id);
    const retried = await app.inject({
      method: 'POST',
      url: `/api/deliveries/${deliveryId}/retry`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(retried.statusCode).toBe(409);
    expect(retried.json().error).toBe('channel_unavailable');
    await app.close();
  });
});
