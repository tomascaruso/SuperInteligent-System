import { describe, expect, it } from 'vitest';
import {
  buildContactMail,
  isContactConfigured,
  type ContactConfig,
} from './contact.js';
import { buildServer } from './server.js';

const FULL_CONTACT: ContactConfig = {
  smtpHost: '127.0.0.1',
  smtpPort: 59999,
  smtpUser: 'remitente@test.com',
  smtpPass: 'secreto',
  to: 'destino@test.com',
  from: 'remitente@test.com',
};

async function build(opts: { contact?: ContactConfig } = {}) {
  return buildServer({
    dbPath: ':memory:',
    jwtSecret: 'test-secret',
    maxOpportunitiesPerDay: 100,
    contact: opts.contact,
  });
}

const VALID = {
  name: 'Martina',
  email: 'martina@empresa.com',
  company: 'Empresa SA',
  message: 'Quiero una demo para mi agencia.',
  website: '',
};

describe('contacto: composición y configuración', () => {
  it('isContactConfigured exige las 4 piezas', () => {
    expect(isContactConfigured(undefined)).toBe(false);
    expect(isContactConfigured({ ...FULL_CONTACT, smtpPass: '' })).toBe(false);
    expect(isContactConfigured({ ...FULL_CONTACT, to: '' })).toBe(false);
    expect(isContactConfigured(FULL_CONTACT)).toBe(true);
  });

  it('buildContactMail pone el nombre en el cuerpo, no en el asunto', () => {
    const mail = buildContactMail(VALID, 'remitente@test.com', 'destino@test.com');
    expect(mail.subject).toBe('Nuevo contacto desde la demo de SuperInteligent System');
    expect(mail.subject).not.toContain('Martina');
    expect(mail.text).toContain('Nombre: Martina');
    expect(mail.text).toContain('Correo: martina@empresa.com');
    expect(mail.text).toContain('Empresa: Empresa SA');
    expect(mail.text).toContain('Quiero una demo para mi agencia.');
    expect(mail.to).toBe('destino@test.com');
  });

  it('buildContactMail marca la empresa ausente con un guion', () => {
    const mail = buildContactMail({ ...VALID, company: '' }, 'r@test.com', 'd@test.com');
    expect(mail.text).toContain('Empresa: —');
  });
});

describe('contacto: endpoints', () => {
  it('GET /api/contact/status dice enabled=false sin SMTP', async () => {
    const { app } = await build();
    const res = await app.inject({ method: 'GET', url: '/api/contact/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
    await app.close();
  });

  it('GET /api/contact/status dice enabled=true con SMTP completo', async () => {
    const { app } = await build({ contact: FULL_CONTACT });
    const res = await app.inject({ method: 'GET', url: '/api/contact/status' });
    expect(res.json()).toEqual({ enabled: true });
    await app.close();
  });

  it('POST /api/contact valida nombre, correo y largo del mensaje', async () => {
    const { app } = await build();
    const badName = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...VALID, name: '' } });
    expect(badName.statusCode).toBe(400);
    const badEmail = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...VALID, email: 'no-es-correo' } });
    expect(badEmail.statusCode).toBe(400);
    const longMessage = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...VALID, message: 'x'.repeat(2001) } });
    expect(longMessage.statusCode).toBe(400);
    await app.close();
  });

  it('POST /api/contact con honeypot lleno finge éxito sin enviar', async () => {
    const { app } = await build();
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...VALID, website: 'http://spam.example' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it('POST /api/contact válido sin SMTP responde 503', async () => {
    const { app } = await build();
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('contact_not_configured');
    await app.close();
  });

  it('POST /api/contact limita a 5 por hora por IP', async () => {
    const { app } = await build();
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
      expect(res.statusCode).toBe(503);
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(blocked.statusCode).toBe(429);
    await app.close();
  });

  it('POST /api/contact con SMTP inalcanzable responde 502', async () => {
    const { app } = await build({ contact: FULL_CONTACT });
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('send_failed');
    await app.close();
  });

  it('ninguna respuesta de contacto expone el correo de destino', async () => {
    const { app } = await build({ contact: FULL_CONTACT });
    const status = await app.inject({ method: 'GET', url: '/api/contact/status' });
    expect(status.body).not.toContain('destino@test.com');
    const failed = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(failed.body).not.toContain('destino@test.com');
    await app.close();
  });
});
