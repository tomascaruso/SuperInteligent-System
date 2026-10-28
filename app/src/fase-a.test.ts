import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { exec, newId, nowIso, queryAll, queryOne } from './db.js';
import { encryptCredentials } from './sending.js';

// Pruebas de Fase A (webhook de WhatsApp, diseño de respuestas
// entrantes 28-oct-2026). NUNCA hay mensajes reales: los payloads
// de Meta son simulados y se firman con el secreto de prueba.
// El endpoint es público por necesidad (Meta no inicia sesión en
// SIS): su única protección es la verificación por token (GET) y
// la firma HMAC-SHA256 (POST). Hacia afuera, el POST siempre
// responde 200 vacío, válido o no.

const TEST_KEY = 'clave-de-prueba-fase-a';
const APP_SECRET = 'secreto-app-meta-prueba';
const VERIFY_TOKEN = 'token-verificacion-prueba';

type App = Awaited<ReturnType<typeof buildServer>>['app'];
type Db = Awaited<ReturnType<typeof buildServer>>['db'];

async function registerAdmin(app: App, email = 'ana@test.com', orgName = 'Agencia Test') {
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
    orgId: (me.json().org as { id: string }).id,
  };
}

async function newServer(metaWebhook: { appSecret: string; verifyToken: string } | null = { appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN }) {
  const built = await buildServer({
    dbPath: ':memory:',
    jwtSecret: 'test-secret',
    maxOpportunitiesPerDay: 100,
    operatorToken: 'test-operator',
    connectionEncryptionKey: TEST_KEY,
    metaWebhook: metaWebhook ?? undefined,
  });
  return built;
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
      contactPhone: '+54 9 11 1234-5678',
      ...extra,
    },
  });
  expect(created.statusCode).toBe(201);
  return created.json().opportunity.id as string;
}

async function connectWhatsApp(db: Db, orgId: string, phoneNumberId = 'pn-1') {
  await exec(
    db,
    'INSERT INTO org_connections (id, org_id, provider, status, display_account, credentials_ciphertext, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId(),
    orgId,
    'whatsapp',
    'connected',
    '+54 9 11 1234-5678',
    encryptCredentials(JSON.stringify({ phone_number_id: phoneNumberId, token: 'token-simulado' }), TEST_KEY),
    nowIso(),
    nowIso(),
    nowIso(),
  );
}

function sign(body: string, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function metaPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '+54 9 11 1234-5678', phone_number_id: 'pn-1' },
              messages: [
                {
                  from: '+54 9 11 1234-5678',
                  id: 'wamid.1',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'Hola, me interesa la propuesta' },
                },
              ],
              ...overrides,
            },
          },
        ],
      },
    ],
  };
}

async function postWebhook(app: App, body: unknown, signature?: string) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return app.inject({
    method: 'POST',
    url: '/api/webhooks/whatsapp',
    headers: {
      'content-type': 'application/json',
      ...(signature !== undefined ? { 'x-hub-signature-256': signature } : {}),
    },
    payload: raw,
  });
}

async function inboundCount(db: Db, orgId: string): Promise<number> {
  const rows = await queryAll<{ id: string }>(db, 'SELECT id FROM inbound_messages WHERE org_id = ?', orgId);
  return rows.length;
}

async function auditActions(db: Db, orgId: string, action: string): Promise<number> {
  const rows = await queryAll<{ id: string }>(db, 'SELECT id FROM audit_log WHERE org_id = ? AND action = ?', orgId, action);
  return rows.length;
}

describe('Fase A: webhook de WhatsApp', () => {
  it('verificación GET: responde el challenge solo con el token correcto', async () => {
    const { app } = await newServer();
    const ok = await app.inject({
      method: 'GET',
      url: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=reto-123`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('reto-123');
    const wrong = await app.inject({
      method: 'GET',
      url: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=reto-123`,
    });
    expect(wrong.statusCode).toBe(403);
    const noMode = await app.inject({
      method: 'GET',
      url: `/api/webhooks/whatsapp?hub.verify_token=${VERIFY_TOKEN}&hub.challenge=reto-123`,
    });
    expect(noMode.statusCode).toBe(403);
  });

  it('verificación GET sin secretos configurados responde cerrado', async () => {
    const { app } = await newServer(null);
    const res = await app.inject({
      method: 'GET',
      url: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=reto-123`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST sin secretos configurados descarta todo con 200 vacío', async () => {
    const { app, db } = await newServer(null);
    const { token, orgId } = await registerAdmin(app);
    void token;
    const body = JSON.stringify(metaPayload());
    const res = await postWebhook(app, body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
    expect(await inboundCount(db, orgId)).toBe(0);
  });

  it('POST válido guarda el mensaje y emite message.received con coincidencia', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const body = JSON.stringify(metaPayload());
    const res = await postWebhook(app, body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
    const rows = await queryAll<{ opportunity_id: string | null; from_phone: string; body: string }>(
      db,
      'SELECT opportunity_id, from_phone, body FROM inbound_messages WHERE org_id = ?',
      orgId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].opportunity_id).toBe(oppId);
    expect(rows[0].from_phone).toBe('+5491112345678');
    expect(rows[0].body).toBe('Hola, me interesa la propuesta');
    expect(await auditActions(db, orgId, 'message.received')).toBe(1);
    const timeline = await app.inject({
      method: 'GET',
      url: `/api/audit?opportunityId=${oppId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(timeline.json().audit.some((e: { action: string }) => e.action === 'message.received')).toBe(true);
  });

  it('POST con formato real de Meta (from sin +) asocia igual a la oportunidad', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    // Meta envía `from` solo con dígitos, sin +; el contacto guardado
    // lleva +54... La asociación debe igualar ambos formatos.
    const payload = metaPayload() as unknown as {
      entry: Array<{ changes: Array<{ value: { messages: Array<{ from: string }> } }> }>;
    };
    payload.entry[0].changes[0].value.messages[0].from = '5491112345678';
    const body = JSON.stringify(payload);
    const res = await postWebhook(app, body, sign(body));
    expect(res.statusCode).toBe(200);
    const rows = await queryAll<{ opportunity_id: string | null; from_phone: string }>(
      db,
      'SELECT opportunity_id, from_phone FROM inbound_messages WHERE org_id = ?',
      orgId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].opportunity_id).toBe(oppId);
    expect(rows[0].from_phone).toBe('+5491112345678');
  });

  it('reintento con el mismo wamid no duplica registro ni evento', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const body = JSON.stringify(metaPayload());
    const sig = sign(body);
    expect((await postWebhook(app, body, sig)).statusCode).toBe(200);
    expect((await postWebhook(app, body, sig)).statusCode).toBe(200);
    expect(await inboundCount(db, orgId)).toBe(1);
    expect(await auditActions(db, orgId, 'message.received')).toBe(1);
  });

  it('firma inválida o ausente descarta sin guardar, siempre con 200', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const body = JSON.stringify(metaPayload());
    expect((await postWebhook(app, body, sign(body, 'otro-secreto'))).statusCode).toBe(200);
    expect((await postWebhook(app, body)).statusCode).toBe(200);
    expect(await inboundCount(db, orgId)).toBe(0);
    expect(await auditActions(db, orgId, 'message.received')).toBe(0);
  });

  it('org desconocida (phone_number_id sin conexión) responde 200 sin guardar', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app);
    // Sin conexión de WhatsApp en ninguna org: no hay enrutado.
    const payload = metaPayload();
    const res = await postWebhook(app, payload, sign(JSON.stringify(payload)));
    expect(res.statusCode).toBe(200);
    expect(await inboundCount(db, orgId)).toBe(0);
  });

  it('varias oportunidades con el mismo teléfono: gana la de envío de WhatsApp más reciente', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppA = await createOpportunity(token, app, { contactEmail: 'a@empresa.com' });
    const oppB = await createOpportunity(token, app, { contactEmail: 'b@empresa.com' });
    await connectWhatsApp(db, orgId);
    // Entregas simuladas: A más vieja, B más reciente.
    const drafts = await app.inject({ method: 'GET', url: '/api/drafts', headers: { authorization: `Bearer ${token}` } });
    const draftA = drafts.json().drafts.find((d: { opportunity_id: string }) => d.opportunity_id === oppA);
    const draftB = drafts.json().drafts.find((d: { opportunity_id: string }) => d.opportunity_id === oppB);
    await exec(
      db,
      "INSERT INTO message_deliveries (id, org_id, draft_id, opportunity_id, channel, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, 'whatsapp', 'sent', 1, ?, ?)",
      newId(), orgId, draftA.id, oppA, '2026-10-28T10:00:00.000Z', '2026-10-28T10:00:00.000Z',
    );
    await exec(
      db,
      "INSERT INTO message_deliveries (id, org_id, draft_id, opportunity_id, channel, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, 'whatsapp', 'sent', 1, ?, ?)",
      newId(), orgId, draftB.id, oppB, '2026-10-28T11:00:00.000Z', '2026-10-28T11:00:00.000Z',
    );
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const rows = await queryAll<{ opportunity_id: string }>(db, 'SELECT opportunity_id FROM inbound_messages WHERE org_id = ?', orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].opportunity_id).toBe(oppB);
  });

  it('sin envíos previos, varias con el mismo teléfono: gana la creada más recientemente', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app, { contactEmail: 'a@empresa.com' });
    const oppB = await createOpportunity(token, app, { contactEmail: 'b@empresa.com' });
    await connectWhatsApp(db, orgId);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const rows = await queryAll<{ opportunity_id: string }>(db, 'SELECT opportunity_id FROM inbound_messages WHERE org_id = ?', orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].opportunity_id).toBe(oppB);
  });

  it('sin coincidencia: se guarda con opportunity_id NULL, no crea nada y aparece en revisión', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app, { contactPhone: '+54 9 11 0000-0000' });
    await connectWhatsApp(db, orgId);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const rows = await queryAll<{ opportunity_id: string | null }>(db, 'SELECT opportunity_id FROM inbound_messages WHERE org_id = ?', orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].opportunity_id).toBeNull();
    const opps = await queryAll<{ id: string }>(db, 'SELECT id FROM opportunities WHERE org_id = ?', orgId);
    expect(opps.map((o) => o.id)).toEqual([oppId]);
    const unmatched = await app.inject({
      method: 'GET',
      url: '/api/inbound-messages/unmatched',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(unmatched.statusCode).toBe(200);
    expect(unmatched.json().responses).toHaveLength(1);
    expect(unmatched.json().responses[0].from_phone).toBe('+5491112345678');
  });

  it('no-texto (imagen) y recibos de estado se ignoran con 200', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const imagePayload = metaPayload();
    (imagePayload.entry[0].changes[0].value as Record<string, unknown>).messages = [
      { from: '+54 9 11 1234-5678', id: 'wamid.img', timestamp: '1761660000', type: 'image', image: { id: 'img-1' } },
    ];
    const statusPayload = metaPayload();
    (statusPayload.entry[0].changes[0].value as Record<string, unknown>).messages = [];
    (statusPayload.entry[0].changes[0].value as Record<string, unknown>).statuses = [
      { id: 'wamid.1', status: 'read', timestamp: '1761660000' },
    ];
    expect((await postWebhook(app, imagePayload, sign(JSON.stringify(imagePayload)))).statusCode).toBe(200);
    expect((await postWebhook(app, statusPayload, sign(JSON.stringify(statusPayload)))).statusCode).toBe(200);
    expect(await inboundCount(db, orgId)).toBe(0);
  });

  it('una respuesta entrante no cambia el estado de la oportunidad ni las entregas', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const before = await queryOne<{ status: string }>(db, 'SELECT status FROM opportunities WHERE id = ?', oppId);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const after = await queryOne<{ status: string }>(db, 'SELECT status FROM opportunities WHERE id = ?', oppId);
    expect(after.status).toBe(before.status);
    const deliveries = await queryAll<{ id: string }>(db, 'SELECT id FROM message_deliveries WHERE org_id = ?', orgId);
    expect(deliveries).toHaveLength(0);
  });

  it('endpoint de respuestas: cuerpo completo para la org dueña, 404 para otra org', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const res = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}/responses`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().responses).toHaveLength(1);
    expect(res.json().responses[0].body).toBe('Hola, me interesa la propuesta');
    const other = await registerAdmin(app, 'ana2@test.com', 'Agencia Test 2');
    void orgId;
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}/responses`,
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(forbidden.statusCode).toBe(404);
  });

  it('ventana derivada: abierta tras una respuesta reciente, cerrada sin teléfono o sin respuestas', async () => {
    const { app, db } = await newServer();
    const { token } = await registerAdmin(app);
    const oppId = await createOpportunity(token, app);
    const oppNoPhone = await createOpportunity(token, app, { contactEmail: 'sin@empresa.com', contactPhone: '' });
    // Ventana cerrada antes de cualquier respuesta.
    const closed = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}/whatsapp-window`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(closed.json().windowOpen).toBe(false);
    expect(closed.json().lastInboundAt).toBeNull();
    // Sin teléfono: siempre cerrada.
    const noPhone = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppNoPhone}/whatsapp-window`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(noPhone.json().windowOpen).toBe(false);
    // Tras una respuesta reciente: abierta.
    const admin = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${token}` } });
    const myOrg = (admin.json().org as { id: string }).id;
    await connectWhatsApp(db, myOrg);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const open = await app.inject({
      method: 'GET',
      url: `/api/opportunities/${oppId}/whatsapp-window`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(open.json().windowOpen).toBe(true);
    expect(typeof open.json().lastInboundAt).toBe('string');
  });

  it('el evento message.received guarda recipient y message para la máscara de Actividad', async () => {
    const { app, db } = await newServer();
    const { token, orgId } = await registerAdmin(app);
    await createOpportunity(token, app);
    await connectWhatsApp(db, orgId);
    const payload = metaPayload();
    await postWebhook(app, payload, sign(JSON.stringify(payload)));
    const row = await queryOne<{ detail_json: string }>(
      db,
      "SELECT detail_json FROM audit_log WHERE org_id = ? AND action = 'message.received'",
      orgId,
    );
    const detail = JSON.parse(row.detail_json) as Record<string, unknown>;
    expect(detail.channel).toBe('whatsapp');
    expect(detail.recipient).toBe('+5491112345678');
    expect(detail.message).toBe('Hola, me interesa la propuesta');
  });
});
