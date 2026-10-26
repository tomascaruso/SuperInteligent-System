import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

describe('health y raíz', () => {
  it('GET /health responde ok', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'superinteligent-system', version: '0.1.0' });
    await app.close();
  });

  it('GET / sirve la interfaz sin exponer secretos', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('SuperInteligent');
    expect(res.body).not.toMatch(/dev-jwt-secret/);
    await app.close();
  });
});
