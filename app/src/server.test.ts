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

describe('estilos del sistema (Fase 1)', () => {
  it('GET /styles/tokens.css sirve los tokens', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/tokens.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(res.body).toContain('--color-primary: #4f46e5');
    expect(res.body).not.toMatch(/dev-jwt-secret/);
    await app.close();
  });

  it('GET /styles/components.css sirve los componentes', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/components.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(res.body).toContain('.btn-primary');
    await app.close();
  });

  it('GET /styles/ con un nombre fuera de la lista blanca da 404', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/noexiste.css' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('oportunidades y tareas (Fase 3)', () => {
  it('GET / sirve las zonas de feedback por sección', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('opp-feedback');
    expect(res.body).toContain('task-feedback');
    await app.close();
  });

  it('GET /app.js sirve etiquetas, data-label, loading y estados vacíos', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Borrador de propuesta');
    expect(res.body).toContain('data-label');
    expect(res.body).toContain('is-loading');
    expect(res.body).toContain('empty-state');
    expect(res.body).toContain('Tarea marcada como hecha.');
    await app.close();
  });

  it('GET /styles/layout.css sirve la tabla responsive', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/layout.css' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('attr(data-label)');
    await app.close();
  });

  it('GET /styles/components.css sirve estados vacíos y lista de tareas', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/components.css' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('.empty-state');
    expect(res.body).toContain('.task-list');
    await app.close();
  });
});

describe('navegación (Fase 2)', () => {
  it('GET / sirve la navegación y el enlace a layout.css', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('/styles/layout.css');
    expect(res.body).toContain('Aprobaciones');
    expect(res.body).toContain('Actividad y ejecuciones');
    expect(res.body).not.toContain('Configuración');
    await app.close();
  });

  it('GET /styles/layout.css sirve el layout', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/layout.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(res.body).toContain('.nav-link');
    await app.close();
  });
});
