import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isContactConfigured,
  sendContactViaRelay,
  type ContactConfig,
  type RelayFetch,
} from './contact.js';
import { buildServer } from './server.js';

const FULL_CONTACT: ContactConfig = {
  relayUrl: 'https://relay.test/exec',
  relayToken: 'token-secreto',
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

function relayResponse(body: unknown, status = 200, location: string | null = null) {
  return {
    status,
    headers: { get: (name: string) => (name === 'location' ? location : null) },
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contacto: configuración y relay', () => {
  it('isContactConfigured exige URL y token', () => {
    expect(isContactConfigured(undefined)).toBe(false);
    expect(isContactConfigured({ relayUrl: '', relayToken: 't' })).toBe(false);
    expect(isContactConfigured({ relayUrl: 'https://r.test', relayToken: '' })).toBe(false);
    expect(isContactConfigured(FULL_CONTACT)).toBe(true);
  });

  it('sendContactViaRelay acepta { ok: true } y manda el token en el cuerpo', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const fetchStub: RelayFetch = async (url, init) => {
      seen.push({ url, body: init.body });
      return relayResponse({ ok: true });
    };
    await sendContactViaRelay(FULL_CONTACT, VALID, fetchStub);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://relay.test/exec');
    const sent = JSON.parse(seen[0].body) as Record<string, string>;
    expect(sent.token).toBe('token-secreto');
    expect(sent.name).toBe('Martina');
    expect(sent.email).toBe('martina@empresa.com');
  });

  it('sendContactViaRelay sigue la redirección reenviando el POST', async () => {
    const urls: string[] = [];
    const fetchStub: RelayFetch = async (url) => {
      urls.push(url);
      if (urls.length === 1) {
        return relayResponse({}, 302, 'https://contenido.test/exec');
      }
      return relayResponse({ ok: true });
    };
    await sendContactViaRelay(FULL_CONTACT, VALID, fetchStub);
    expect(urls).toEqual(['https://relay.test/exec', 'https://contenido.test/exec']);
  });

  it('sendContactViaRelay rechaza { ok: false } y un fallo de red', async () => {
    const refused: RelayFetch = async () => relayResponse({ ok: false });
    await expect(sendContactViaRelay(FULL_CONTACT, VALID, refused)).rejects.toThrow('relay_failed');
    const broken: RelayFetch = async () => {
      throw new Error('boom');
    };
    await expect(sendContactViaRelay(FULL_CONTACT, VALID, broken)).rejects.toThrow('boom');
  });
});

describe('contacto: endpoints', () => {
  it('GET /api/contact/status dice enabled=false sin relay', async () => {
    const { app } = await build();
    const res = await app.inject({ method: 'GET', url: '/api/contact/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
    await app.close();
  });

  it('GET /api/contact/status dice enabled=true con relay completo', async () => {
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

  it('POST /api/contact válido sin relay responde 503', async () => {
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

  it('POST /api/contact con relay que responde ok:true devuelve ok', async () => {
    vi.stubGlobal('fetch', async () => relayResponse({ ok: true }));
    const { app } = await build({ contact: FULL_CONTACT });
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it('POST /api/contact con relay que falla responde 502', async () => {
    vi.stubGlobal('fetch', async () => relayResponse({ ok: false }));
    const { app } = await build({ contact: FULL_CONTACT });
    const res = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('send_failed');
    await app.close();
  });

  it('ninguna respuesta de contacto expone la URL ni el token del relay', async () => {
    const { app } = await build({ contact: FULL_CONTACT });
    const status = await app.inject({ method: 'GET', url: '/api/contact/status' });
    expect(status.body).not.toContain('relay.test');
    expect(status.body).not.toContain('token-secreto');
    vi.stubGlobal('fetch', async () => relayResponse({ ok: false }));
    const failed = await app.inject({ method: 'POST', url: '/api/contact', payload: VALID });
    expect(failed.body).not.toContain('relay.test');
    expect(failed.body).not.toContain('token-secreto');
    await app.close();
  });
});
