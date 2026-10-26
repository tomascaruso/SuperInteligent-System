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

describe('centro de aprobaciones (Fase 4)', () => {
  it('GET / sirve el panel de aprobaciones y el diálogo de confirmación', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('draft-feedback');
    expect(res.body).toContain('Borradores decididos');
    expect(res.body).toContain('dialog-overlay');
    expect(res.body).toContain('dialog-title');
    await app.close();
  });

  it('GET /app.js sirve estados, contexto y confirmación con efecto real', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Pendiente de aprobación');
    expect(res.body).toContain('Canal:</strong> No disponible');
    expect(res.body).toContain('Borrador aprobado. La oportunidad pasó a seguimiento; no se envió ningún mensaje.');
    expect(res.body).toContain('dialog-reason');
    await app.close();
  });

  it('GET /styles/components.css sirve los estilos del diálogo', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/components.css' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('.dialog-overlay');
    expect(res.body).toContain('.dialog');
    await app.close();
  });
});

describe('actividad y ejecuciones (Fase 5)', () => {
  it('GET / sirve la zona de feedback y los estados de carga de actividad', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('activity-feedback');
    expect(res.body).toContain('Cargando actividad');
    expect(res.body).toContain('Cargando ejecuciones');
    await app.close();
  });

  it('GET /app.js sirve etiquetas de ejecución y auditoría y confirmación de reintento', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Completada');
    expect(res.body).toContain('Fallida');
    expect(res.body).toContain('Inicio de sesión');
    expect(res.body).toContain('Reintentar ejecución');
    expect(res.body).toContain('Ejecución reintentada.');
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

describe('trazabilidad (C2)', () => {
  it('GET /app.js sirve el botón y la lista de pasos de ejecución', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Ver pasos');
    expect(res.body).toContain('data-steps');
    expect(res.body).toContain('/steps');
    expect(res.body).toContain('Sin pasos registrados.');
    expect(res.body).toContain('Cargando pasos…');
    await app.close();
  });
});

describe('procesos (C3)', () => {
  it('GET / sirve la tarjeta de procesos y /app.js sirve su lista', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const html = await app.inject({ method: 'GET', url: '/' });
    expect(html.statusCode).toBe(200);
    expect(html.body).toContain('<h3>Procesos</h3>');
    expect(html.body).toContain('Cargando procesos…');
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('/api/processes');
    expect(js.body).toContain('Sin procesos todavía.');
    expect(js.body).toContain('En curso');
    await app.close();
  });
});

describe('agentes (C4)', () => {
  it('GET /api/agents sirve los 5 agentes deterministas en orden, con sus pasos reales', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Agencia Test', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    const token = reg.json().token as string;
    const res = await app.inject({ method: 'GET', url: '/api/agents', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().agents.map((a: { id: string }) => a.id)).toEqual([
      'intake',
      'qualification',
      'response_proposal',
      'follow_up',
      'qa_policy',
    ]);
    // C6 corrige C4: upsert quedaba sin agente; pertenece a Captación.
    expect(res.json().agents[0].steps).toEqual(['normalize', 'dedup', 'upsert']);
    expect(res.json().agents[3].steps).toEqual(['next_action']);
    // QA y políticas no tiene paso propio: lista vacía, no inventada.
    expect(res.json().agents[4].steps).toEqual([]);
    const anon = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it('GET /app.js sirve el agente en la lista de tareas', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Agente:');
    await app.close();
  });
});

describe('aprobaciones con expiración (C5)', () => {
  it('GET /app.js sirve las marcas de vencido y desactualizado', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Vencido');
    expect(js.body).toContain('Desactualizado');
    await app.close();
  });
});

describe('políticas y herramientas (C6)', () => {
  async function authed() {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Agencia Test', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    return { app, token: reg.json().token as string };
  }

  it('GET /api/policies sirve las 4 políticas y exige auth', async () => {
    const { app, token } = await authed();
    const res = await app.inject({ method: 'GET', url: '/api/policies', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().policies.map((p: { key: string }) => p.key).sort()).toEqual([
      'draft.approval.admin_only',
      'draft.expiry_days',
      'retry.admin_only',
      'retry.max_attempts',
    ]);
    expect(res.json().policies.find((p: { key: string }) => p.key === 'retry.max_attempts').value).toBe('3');
    const anon = await app.inject({ method: 'GET', url: '/api/policies' });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it('GET /api/tools sirve los 6 pasos con su agente dueño', async () => {
    const { app, token } = await authed();
    const res = await app.inject({ method: 'GET', url: '/api/tools', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().tools).toHaveLength(6);
    expect(res.json().tools.map((t: { step: string }) => t.step).sort()).toEqual([
      'classify',
      'dedup',
      'draft',
      'next_action',
      'normalize',
      'upsert',
    ]);
    expect(res.json().tools.find((t: { step: string }) => t.step === 'draft').agent_id).toBe('response_proposal');
    expect(res.json().tools.find((t: { step: string }) => t.step === 'next_action').agent_id).toBe('follow_up');
    expect(res.json().tools.find((t: { step: string }) => t.step === 'upsert').agent_id).toBe('intake');
    expect(res.json().tools.some((t: { agent_id: string }) => t.agent_id === 'qa_policy')).toBe(false);
    await app.close();
  });

  it('GET /app.js sirve la nota de reintento solo-admin', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Solo un admin puede reintentar');
    await app.close();
  });
});
