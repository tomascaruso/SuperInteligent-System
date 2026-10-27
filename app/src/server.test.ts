import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

// C8: el alta es por invitación (ya no hay registro público). Crea la
// invitación como operador y la canjea; devuelve la respuesta del canje.
async function registerViaInvitation(
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
  return res;
}

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
    // F3-DEMO: el canal ya no es un texto fijo, sale del source de la
    // oportunidad (Alta manual / Entrada externa, resto No disponible).
    expect(res.body).toContain('Canal:</strong>');
    expect(res.body).toContain('Alta manual');
    expect(res.body).toContain('Entrada externa');
    expect(res.body).toContain('Borrador aprobado. La oportunidad pasó a seguimiento; no se envió ningún mensaje.');
    expect(res.body).toContain('dialog-reason');
    await app.close();
  });

  it('GET /app.js excluye los campos ocultos de la trampa de foco del diálogo', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    // La trampa listaba también el textarea oculto (motivo, solo visible
    // al rechazar): al envolver desde Cancelar, el foco caía en un
    // elemento sin renderizar y el contorno quedaba fijo en Cancelar.
    // El filtro debe excluir elementos no visibles (offsetParent null).
    expect(js.body).toContain('offsetParent');
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
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
    const reg = await registerViaInvitation(app);
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

  // F3-DEMO: recorrido guiado dentro de la demo (panel de pasos).
  it('GET / sirve el botón y el panel del recorrido; GET /app.js trae sus pasos', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('id="btn-tour"');
    expect(page.body).toContain('Recorrido guiado');
    expect(page.body).toContain('id="tour-panel"');
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Así funciona, en 2 minutos');
    expect(js.body).toContain('¿Querés esto para tu empresa?');
    await app.close();
  });

  // F3-DEMO: detalles finales (categoría legible, actividad sin logins).
  it('GET /app.js traduce general y filtra logins de la actividad reciente', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Consulta general');
    expect(js.body).toContain('Sin actividad comercial todavía');
    await app.close();
  });

  // F3-DEMO: sección visible de agentes (vista nueva, no solo etiqueta).
  it('GET / sirve la vista Agentes y GET /app.js la describe en negocio', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('data-view="agentes"');
    expect(page.body).toContain('id="view-agentes"');
    expect(page.body).toContain('Ninguno envía mensajes solo');
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).toContain('Qué hace cada agente');
    expect(js.body).toContain('tareas abiertas');
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
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
    const reg = await registerViaInvitation(app);
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

describe('endurecimiento (C7)', () => {
  it('todas las respuestas traen cabeceras de seguridad', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['content-security-policy']).toBe("default-src 'self'");
    await app.close();
  });

  it('el login pone cookie httpOnly, la cookie autentica y el logout la borra', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
    const reg = await registerViaInvitation(app);
    expect(reg.statusCode).toBe(201);
    const setCookie = [reg.headers['set-cookie']].flat().join('; ');
    expect(setCookie).toContain('HttpOnly');
    const cookie = setCookie.split(';')[0];
    expect(cookie.startsWith('token=')).toBe(true);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);
    expect([logout.headers['set-cookie']].flat().join('; ')).toContain('Max-Age=0');
    const anon = await app.inject({ method: 'GET', url: '/api/me' });
    expect(anon.statusCode).toBe(401);
    await app.close();
  });

  it('el login limita intentos fallidos por IP: 20 → 401 y el 21 → 429', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nadie@test.com', password: 'incorrecta' },
      });
      expect(res.statusCode).toBe(401);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nadie@test.com', password: 'incorrecta' },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toBe('rate_limited');
    await app.close();
  });

  it('assertProductionSecret exige secreto real solo en producción', async () => {
    const { assertProductionSecret } = await import('./config.js');
    const base = {
      host: '127.0.0.1',
      port: 3000,
      databasePath: ':memory:',
      jwtSecret: 'dev-jwt-secret',
      maxOpportunitiesPerDay: 100,
    };
    expect(() => assertProductionSecret({ ...base, jwtSecretIsDefault: true }, 'production')).toThrow('JWT_SECRET');
    expect(() => assertProductionSecret({ ...base, jwtSecretIsDefault: true }, undefined)).not.toThrow();
    expect(() => assertProductionSecret({ ...base, jwtSecretIsDefault: false, jwtSecret: 'real' }, 'production')).not.toThrow();
  });

  it('GET /app.js ya no usa localStorage y llama a logout', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.body).not.toContain('localStorage');
    expect(js.body).toContain('/api/auth/logout');
    await app.close();
  });
});

describe('alta por invitación (C8)', () => {
  it('el registro público está cerrado', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { orgName: 'Agencia Test', name: 'Ana', email: 'ana@test.com', password: 'Secreto123' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('crear invitación exige el secreto del operador', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
    const sinHeader = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      payload: { orgName: 'Nueva Empresa', email: 'nueva@empresa.com' },
    });
    expect(sinHeader.statusCode).toBe(403);
    expect(sinHeader.json().error).toBe('operator_forbidden');
    const malSecreto = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { 'x-operator-token': 'incorrecto' },
      payload: { orgName: 'Nueva Empresa', email: 'nueva@empresa.com' },
    });
    expect(malSecreto.statusCode).toBe(403);
    await app.close();
    const sinConfig = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await sinConfig.app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { 'x-operator-token': 'test-operator' },
      payload: { orgName: 'Nueva Empresa', email: 'nueva@empresa.com' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('operator_not_configured');
    await sinConfig.app.close();
  });

  it('el ciclo completo: invitación → canje → org con admin; reuso, vencida, desconocida y duplicada se rechazan', async () => {
    const { app, db } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100, operatorToken: 'test-operator' });
    const inv = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { 'x-operator-token': 'test-operator' },
      payload: { orgName: 'Nueva Empresa', email: 'nueva@empresa.com' },
    });
    expect(inv.statusCode).toBe(201);
    expect(inv.json().token as string).toMatch(/^[0-9a-f]{64}$/);
    expect(inv.json().invitation.org_name).toBe('Nueva Empresa');
    const token = inv.json().token as string;
    const accept = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invitation',
      payload: { token, name: 'Nora', password: 'Secreto123' },
    });
    expect(accept.statusCode).toBe(201);
    expect(accept.json().org.name).toBe('Nueva Empresa');
    expect(accept.json().user.email).toBe('nueva@empresa.com');
    expect(accept.json().user.role).toBe('admin');
    expect([accept.headers['set-cookie']].flat().join('; ')).toContain('HttpOnly');
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invitation',
      payload: { token, name: 'Nora', password: 'Secreto123' },
    });
    expect(reuse.statusCode).toBe(410);
    expect(reuse.json().error).toBe('invitation_accepted');
    const inv2 = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { 'x-operator-token': 'test-operator' },
      payload: { orgName: 'Otra Empresa', email: 'otra@empresa.com' },
    });
    const past = new Date(Date.now() - 1000).toISOString();
    await db.exec('UPDATE invitations SET expires_at = ? WHERE id = ?', past, inv2.json().invitation.id as string);
    const expired = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invitation',
      payload: { token: inv2.json().token as string, name: 'Omar', password: 'Secreto123' },
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json().error).toBe('invitation_expired');
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invitation',
      payload: { token: '0'.repeat(64), name: 'Nadie', password: 'Secreto123' },
    });
    expect(unknown.statusCode).toBe(404);
    const dup = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { 'x-operator-token': 'test-operator' },
      payload: { orgName: 'Duplicada', email: 'nueva@empresa.com' },
    });
    const dupAccept = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invitation',
      payload: { token: dup.json().token as string, name: 'Nora', password: 'Secreto123' },
    });
    expect(dupAccept.statusCode).toBe(409);
    await app.close();
  });

  it('la UI ya no ofrece registro público y sí aceptación de invitación', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.body).toContain('Tengo una invitación');
    expect(index.body).not.toContain('btn-register');
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.body).not.toContain('/api/auth/register');
    expect(js.body).toContain('/api/auth/accept-invitation');
    await app.close();
  });
});

describe('Fase 6 — QA y cierre', () => {
  it('la pantalla de acceso anuncia errores y los mensajes de sección son en vivo', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.body).toContain('id="error" class="alert alert-error" role="alert"');
    for (const id of ['opp-feedback', 'task-feedback', 'draft-feedback', 'activity-feedback']) {
      expect(index.body).toContain(`id="${id}" class="alert" aria-live="polite"`);
    }
    await app.close();
  });

  it('la UI maneja sesión expirada, fallo de red y dobles envíos', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.body).toContain('La sesión expiró. Volvé a entrar.');
    expect(js.body).toContain('No se pudo contactar al servidor.');
    expect(js.body).toContain("withLoading($('btn-login')");
    expect(js.body).toContain("withLoading($('btn-accept')");
    expect(js.body).toContain("withLoading($('btn-refresh')");
    expect(js.body).toContain("inv-token').focus()");
    await app.close();
  });

  it('los tokens de texto pasan WCAG AA en blanco y en canvas', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const css = await app.inject({ method: 'GET', url: '/styles/tokens.css' });
    expect(css.body).toContain('--color-text-secondary: #5a6a80');
    expect(css.body).toContain('--color-text-muted: #63738c');
    await app.close();
  });
});

describe('paso 1 composición (referencia visual)', () => {
  it('GET / sirve el chip de usuario y el indicador de sistema', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('id="user-chip"');
    expect(res.body).toContain('id="system-status"');
    // Estado inicial honesto: todavía no se comprobó la API.
    expect(res.body).toContain('Conectando…');
    await app.close();
  });

  it('GET /app.js refleja el estado real de la última actualización', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.body).toContain('Sistema operativo');
    expect(js.body).toContain('Sin conexión');
    expect(js.body).toContain('Hola, ');
    await app.close();
  });

  it('GET /styles/components.css sirve el chip y la píldora de estado', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/styles/components.css' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('.user-chip');
    expect(res.body).toContain('.status-pill');
    await app.close();
  });
});

describe('pantalla de acceso (diagnóstico login)', () => {
  it('GET / sirve los dos paneles, la vista ilustrativa y el formulario real', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('login-layout');
    expect(res.body).toContain('login-brand');
    expect(res.body).toContain('login-preview');
    expect(res.body).not.toContain('Vista ilustrativa');
    expect(res.body).toContain('Bienvenido');
    expect(res.body).toContain('Iniciar sesión');
    expect(res.body).toContain('btn-toggle-password');
    expect(res.body).toContain('btn-show-contact');
    // Se preservan: invitación, cuenta demo y contacto existente.
    expect(res.body).toContain('Tengo una invitación');
    expect(res.body).toContain('Cuenta de demostración');
    expect(res.body).toContain('Quiero una demo para mi empresa');
    await app.close();
  });

  it('GET /app.js sirve el toggle de contraseña y el enlace de contacto', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const js = await app.inject({ method: 'GET', url: '/app.js' });
    expect(js.body).toContain('btn-toggle-password');
    expect(js.body).toContain('Ocultar contraseña');
    expect(js.body).toContain('btn-show-contact');
    expect(js.body).toContain('contact-link-wrap');
    await app.close();
  });

  it('GET /styles sirve el layout y los estilos de acceso', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const layout = await app.inject({ method: 'GET', url: '/styles/layout.css' });
    expect(layout.statusCode).toBe(200);
    expect(layout.body).toContain('.login-layout');
    const components = await app.inject({ method: 'GET', url: '/styles/components.css' });
    expect(components.statusCode).toBe(200);
    expect(components.body).toContain('.login-preview');
    await app.close();
  });
});

describe('cliente react /v2/ (fase 2)', () => {
  // El build del cliente lo genera el pretest (npm run build:client);
  // el test lee el HTML construido para no hardcodear hashes.
  function clientAsset(ext: string): string {
    const html = readFileSync(new URL('../client/dist/index.html', import.meta.url), 'utf8');
    const match = html.match(new RegExp(`/v2/assets/[^"']+\\.${ext}`));
    if (!match) throw new Error(`sin asset .${ext} en el build del cliente`);
    return match[0];
  }

  it('GET /v2/ sirve el HTML del cliente React con base /v2/', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/v2/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root"');
    expect(res.body).toContain('/v2/assets/');
    await app.close();
  });

  it('GET /v2/assets sirve el JS y el CSS del build', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    for (const ext of ['js', 'css']) {
      const res = await app.inject({ method: 'GET', url: clientAsset(ext) });
      expect(res.statusCode).toBe(200);
    }
    await app.close();
  });

  it('GET /v2/* rechaza extensiones no permitidas y traversal', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    for (const url of ['/v2/notas.txt', '/v2/../secret', '/v2/assets/../../x.js']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
    }
    await app.close();
  });
});

describe('cliente react /v2/ (fase 3)', () => {
  it('GET /v2 redirige (302) a /v2/', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/v2' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/v2/');
    await app.close();
  });

  it('GET /v2/ sigue sirviendo el HTML del cliente React', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/v2/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root"');
    expect(res.body).toContain('/v2/assets/');
    await app.close();
  });

  it('el JS del cliente referencia las 6 rutas de sección de la Fase 3', async () => {
    // Las rutas viven en el bundle (HashRouter), no en el HTML: se
    // verifica que el JS construido las contenga como literales.
    const html = readFileSync(new URL('../client/dist/index.html', import.meta.url), 'utf8');
    const match = html.match(/\/v2\/assets\/[^"']+\.js/);
    if (!match) throw new Error('sin asset JS en el build del cliente');
    const js = readFileSync(new URL(`../client/dist/${match[0].replace('/v2/', '')}`, import.meta.url), 'utf8');
    for (const path of ['/inicio', '/oportunidades', '/tareas', '/aprobaciones', '/actividad', '/agentes']) {
      expect(js).toContain(path);
    }
  });
});

describe('cliente react /v2/ (fase 4: inicio)', () => {
  function clientJs(): string {
    // El build del cliente lo genera el pretest; se lee el JS
    // construido para no hardcodear hashes.
    const html = readFileSync(new URL('../client/dist/index.html', import.meta.url), 'utf8');
    const match = html.match(/\/v2\/assets\/[^"']+\.js/);
    if (!match) throw new Error('sin asset JS en el build del cliente');
    return readFileSync(new URL(`../client/dist/${match[0].replace('/v2/', '')}`, import.meta.url), 'utf8');
  }

  it('el JS del cliente referencia las APIs que alimenta la vista Inicio', async () => {
    const js = clientJs();
    for (const path of ['/api/stats', '/api/tasks?status=open', '/api/drafts', '/api/executions', '/api/opportunities', '/api/audit']) {
      expect(js).toContain(path);
    }
  });

  it('el JS del cliente contiene los textos reales de la vista Inicio', async () => {
    const js = clientJs();
    for (const text of ['Centro de operaciones', 'Acciones prioritarias', 'Actividad reciente', 'Sin acciones urgentes', 'Sin actividad comercial todavía']) {
      expect(js).toContain(text);
    }
  });

  it('GET /v2/ sigue sirviendo el HTML del cliente React', async () => {
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: '/v2/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root"');
    expect(res.body).toContain('/v2/assets/');
    await app.close();
  });
});

describe('cliente react /v2/ (r1: oportunidades + logo)', () => {
  function clientJs(): string {
    // Igual que el bloque de la Fase 4: el build del cliente lo
    // genera el pretest; se lee el JS construido para no
    // hardcodear hashes.
    const html = readFileSync(new URL('../client/dist/index.html', import.meta.url), 'utf8');
    const match = html.match(/\/v2\/assets\/[^"']+\.js/);
    if (!match) throw new Error('sin asset JS en el build del cliente');
    return readFileSync(new URL(`../client/dist/${match[0].replace('/v2/', '')}`, import.meta.url), 'utf8');
  }

  it('el JS del cliente referencia los assets del logo', () => {
    const js = clientJs();
    for (const part of ['sis-logo-', 'sis-mark-', '.png']) {
      expect(js).toContain(part);
    }
  });

  it('el JS del cliente contiene los textos reales de la vista Oportunidades', () => {
    const js = clientJs();
    for (const text of [
      // R1b: el subtítulo cambió al de la referencia («Centraliza,
      // clasifica y supervisa las oportunidades comerciales») y se
      // agregan los textos nuevos de R1b («Más filtros» y
      // «Atención humana requerida»); el resto no cambia.
      // R1d: «Más filtros» se ELIMINA (la Categoría pasa a ser
      // un select siempre visible en la fila única de filtros), así
      // que ese marcador se reemplaza por la etiqueta «Categoría»
      // del select, presente en el JS construido. Ningún otro
      // test cambia.
      'Centraliza, clasifica y supervisa las oportunidades comerciales',
      'Nueva oportunidad (alta manual)',
      'Crear oportunidad',
      'Próximo paso',
      'Aún no hay oportunidades',
      'Mostrando',
      'Categoría',
      'Atención humana requerida',
    ]) {
      expect(js).toContain(text);
    }
  });

  it('GET /v2/assets sirve el PNG del logo', async () => {
    const assets = readdirSync(new URL('../client/dist/assets', import.meta.url));
    const logo = assets.find((f) => f.startsWith('sis-logo-') && f.endsWith('.png'));
    if (!logo) throw new Error('sin asset sis-logo en el build del cliente');
    const { app } = await buildServer({ dbPath: ':memory:', jwtSecret: 'test-secret', maxOpportunitiesPerDay: 100 });
    const res = await app.inject({ method: 'GET', url: `/v2/assets/${logo}` });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
