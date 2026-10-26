// Interfaz de la demo (UI/UX System OS v1.1, Fase 3: Oportunidades y tareas). Sin frameworks;
// el token vive en localStorage (demo; en producción usar cookie httpOnly + HTTPS).
const $ = (id) => document.getElementById(id);
const err = $('error');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function token() {
  return localStorage.getItem('sis_token') || '';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token() ? { authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

// Badges de presentación. El texto acompaña siempre al color; los valores no
// mapeados caen a neutral y se muestran tal cual. Prioridad: high/medium/low.
// Estado de oportunidad: proposal_draft, in_follow_up, new (según routes.ts).
// Las etiquetas son solo de presentación: no cambian el valor que guarda el servidor.
function priorityBadge(p) {
  return { high: 'badge-danger', medium: 'badge-warning', low: 'badge-neutral' }[p] || 'badge-neutral';
}

function priorityLabel(p) {
  return { high: 'Alta', medium: 'Media', low: 'Baja' }[p] || p;
}

function statusBadge(s) {
  return { proposal_draft: 'badge-info', in_follow_up: 'badge-success', new: 'badge-neutral' }[s] || 'badge-neutral';
}

function statusLabel(s) {
  return { proposal_draft: 'Borrador de propuesta', in_follow_up: 'En seguimiento', new: 'Nueva' }[s] || s;
}

// Feedback por sección (Fase 3): el alert vacío se oculta solo vía :empty.
// No lo borra refresh(): el mensaje describe la última operación de la sección.
function setFeedback(id, kind, message) {
  const el = $(id);
  el.className = message ? `alert alert-${kind}` : 'alert';
  el.textContent = message || '';
}

// Estado de envío (Fase 3): deshabilita el botón y aplica .is-loading mientras
// la operación está en curso; evita dobles envíos y muestra que algo pasa.
async function withLoading(btn, fn) {
  btn.classList.add('is-loading');
  btn.disabled = true;
  try {
    return await fn();
  } finally {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}

// ---------- Navegación (Fase 2) ----------
// Sin Configuración en la navegación: todavía no existen opciones funcionales.
// Los contadores provienen de /api/stats y se ocultan cuando son cero.
const VIEWS = {
  inicio: { title: 'Centro de operaciones', subtitle: 'Qué requiere atención y qué está pasando.' },
  oportunidades: { title: 'Oportunidades', subtitle: 'Oportunidades comerciales y alta manual.' },
  tareas: { title: 'Tareas y seguimientos', subtitle: 'Qué hay que hacer y qué está pendiente.' },
  aprobaciones: { title: 'Aprobaciones', subtitle: 'Revisá cada borrador antes de decidir. Aprobar actualiza el estado y audita; no envía mensajes.' },
  actividad: { title: 'Actividad y ejecuciones', subtitle: 'Trazabilidad de las operaciones del sistema.' },
};

let currentRole = '';

function showView(name) {
  const key = VIEWS[name] ? name : 'inicio';
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $(`view-${key}`).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach((a) => {
    const active = a.dataset.view === key;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('view-title').textContent = VIEWS[key].title;
  $('view-subtitle').textContent = VIEWS[key].subtitle;
}

window.addEventListener('hashchange', () => {
  if (token()) showView(location.hash.replace('#', ''));
});

function setCount(id, n) {
  const el = $(id);
  el.textContent = n;
  el.classList.toggle('hidden', !n);
}

function showApp(user, org) {
  $('auth-section').classList.add('hidden');
  $('app-section').classList.remove('hidden');
  currentRole = user.role || '';
  $('who').textContent = `— ${esc(user.name)} (${esc(org.name || '')}, ${esc(user.role)})`;
  showView(location.hash.replace('#', '') || 'inicio');
}

async function refresh() {
  err.textContent = '';
  try {
    const me = await api('/api/me');
    showApp(me.user, me.org);
    const stats = await api('/api/stats');
    $('stat-opps').textContent = stats.opportunities;
    $('stat-tasks').textContent = stats.openTasks;
    $('stat-drafts').textContent = stats.pendingDrafts;
    $('stat-failed').textContent = stats.failedExecutions;
    setCount('count-opps', stats.opportunities);
    setCount('count-tasks', stats.openTasks);
    setCount('count-drafts', stats.pendingDrafts);
    const { opportunities } = await api('/api/opportunities');
    $('opps').innerHTML = opportunities.map((o) =>
      `<tr><td data-label="Contacto">${esc(o.contact_name)}</td><td data-label="Empresa">${esc(o.company)}</td>` +
      `<td data-label="Categoría">${esc(o.category)}</td>` +
      `<td data-label="Prioridad"><span class="badge ${priorityBadge(o.priority)}">${esc(priorityLabel(o.priority))}</span></td>` +
      `<td data-label="Estado"><span class="badge ${statusBadge(o.status)}">${esc(statusLabel(o.status))}</span></td></tr>`,
    ).join('') || '<tr><td colspan="5"><div class="empty-state">Aún no hay oportunidades. Creá la primera con el formulario de alta manual.</div></td></tr>';
    const { tasks } = await api('/api/tasks?status=open');
    $('tasks').innerHTML = tasks.map((t) =>
      `<li>${esc(t.title)} — vence ${esc(t.due_at.slice(0, 10))} ` +
      `<button class="btn btn-secondary btn-sm" data-done="${t.id}">Marcar hecha</button></li>`,
    ).join('') || '<li class="empty-state">Sin tareas abiertas. Cuando llegue una oportunidad, sus seguimientos aparecerán acá.</li>';
    document.querySelectorAll('[data-done]').forEach((b) => {
      b.onclick = async () => {
        await withLoading(b, async () => {
          try {
            await api(`/api/tasks/${b.dataset.done}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
            setFeedback('task-feedback', 'success', 'Tarea marcada como hecha.');
            await refresh();
          } catch (e) {
            // Sin refresh: la tarea sigue abierta y se puede reintentar.
            setFeedback('task-feedback', 'error', e.message);
          }
        });
      };
    });
    const { drafts } = await api('/api/drafts');
    const pending = drafts.filter((d) => d.status === 'pending_approval');
    // Solo admin ve aprobar/rechazar (el servidor lo exige); el resto solo lee.
    const roleNote = pending.length && currentRole !== 'admin'
      ? '<p class="text-muted">Tu rol no permite aprobar ni rechazar borradores.</p>'
      : '';
    $('drafts').innerHTML = roleNote + pending.map((d) =>
      `<div class="card"><pre class="draft-body">${esc(d.body)}</pre>` +
      (currentRole === 'admin'
        ? `<button class="btn btn-primary btn-sm" data-approve="${d.id}">Aprobar</button> ` +
          `<button class="btn btn-danger btn-sm" data-reject="${d.id}">Rechazar</button>`
        : '') +
      `</div>`,
    ).join('') || '<p>Sin borradores pendientes.</p>';
    document.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = async () => { await api(`/api/drafts/${b.dataset.approve}/approve`, { method: 'POST', body: '{}' }); await refresh(); };
    });
    document.querySelectorAll('[data-reject]').forEach((b) => {
      b.onclick = async () => { await api(`/api/drafts/${b.dataset.reject}/reject`, { method: 'POST', body: JSON.stringify({ note: 'Rechazado desde la demo' }) }); await refresh(); };
    });
    const { audit } = await api('/api/audit');
    const auditItems = (a) => `<li>${esc(a.created_at.slice(0, 19))} — ${esc(a.actor)}: ${esc(a.action)} (${esc(a.entity)})</li>`;
    $('audit').innerHTML = audit.slice(0, 20).map(auditItems).join('') || '<li>Sin registros.</li>';
    $('activity').innerHTML = audit.slice(0, 5).map(auditItems).join('') || '<li>Sin registros.</li>';
    const { executions } = await api('/api/executions');
    $('executions').innerHTML = executions.slice(0, 20).map((e) =>
      `<li>${esc(e.created_at.slice(0, 19))} — ${esc(e.workflow)} v${esc(e.workflow_version)}: ${esc(e.status)}` +
      (e.status === 'failed' ? ` <button class="btn btn-secondary btn-sm" data-retry="${e.id}">Reintentar</button> — ${esc(e.error || '')}` : '') + '</li>',
    ).join('') || '<li>Sin ejecuciones.</li>';
    document.querySelectorAll('[data-retry]').forEach((b) => {
      b.onclick = async () => { await api(`/api/executions/${b.dataset.retry}/retry`, { method: 'POST', body: '{}' }); await refresh(); };
    });
    // Acciones prioritarias de Inicio, calculadas con los datos ya cargados.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const items = [];
    tasks.filter((t) => t.due_at.slice(0, 10) < today).forEach((t) => {
      items.push(`<li>${esc(t.title)} — venció ${esc(t.due_at.slice(0, 10))} <a href="#tareas">Ver tareas</a></li>`);
    });
    if (pending.length) items.push(`<li>${pending.length} borrador(es) pendiente(s) de aprobación — <a href="#aprobaciones">Revisar</a></li>`);
    const failed = executions.filter((e) => e.status === 'failed');
    if (failed.length) items.push(`<li>${failed.length} ejecución(es) fallida(s) — <a href="#actividad">Ver actividad</a></li>`);
    $('priority').innerHTML = items.join('') || '<li>Sin acciones urgentes.</li>';
  } catch (e) {
    err.textContent = e.message;
  }
}

$('btn-register').onclick = async () => {
  err.textContent = '';
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        orgName: $('orgName').value,
        name: $('name').value,
        email: $('email').value,
        password: $('password').value,
      }),
    });
    localStorage.setItem('sis_token', data.token);
    await refresh();
  } catch (e) {
    err.textContent = e.message;
  }
};

$('btn-login').onclick = async () => {
  err.textContent = '';
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    localStorage.setItem('sis_token', data.token);
    await refresh();
  } catch (e) {
    err.textContent = e.message;
  }
};

$('btn-logout').onclick = () => {
  localStorage.removeItem('sis_token');
  $('app-section').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
};

$('btn-refresh').onclick = refresh;

$('btn-create-opp').onclick = async () => {
  await withLoading($('btn-create-opp'), async () => {
    try {
      await api('/api/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          contactName: $('opp-name').value,
          contactEmail: $('opp-email').value,
          company: $('opp-company').value,
          message: $('opp-message').value,
        }),
      });
      $('opp-name').value = '';
      $('opp-email').value = '';
      $('opp-company').value = '';
      $('opp-message').value = '';
      setFeedback('opp-feedback', 'success', 'Oportunidad creada.');
      await refresh();
    } catch (e) {
      setFeedback('opp-feedback', 'error', e.message);
    }
  });
};

if (token()) refresh();
