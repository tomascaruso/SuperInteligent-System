// Interfaz mínima de la demo. Sin frameworks; el token vive en localStorage
// (demo local; en producción usar cookie httpOnly + HTTPS).
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

function showApp(user, org) {
  $('auth-section').classList.add('hidden');
  $('app-section').classList.remove('hidden');
  $('who').textContent = `— ${esc(user.name)} (${esc(org.name || '')}, ${esc(user.role)})`;
}

async function refresh() {
  err.textContent = '';
  try {
    const me = await api('/api/me');
    showApp(me.user, me.org);
    const stats = await api('/api/stats');
    $('stats').textContent =
      `Oportunidades: ${stats.opportunities} · Tareas abiertas: ${stats.openTasks} · ` +
      `Borradores pendientes: ${stats.pendingDrafts} · Ejecuciones fallidas: ${stats.failedExecutions} · ` +
      `Creadas hoy: ${stats.createdToday}/${stats.maxPerDay}`;
    const { opportunities } = await api('/api/opportunities');
    $('opps').innerHTML = opportunities.map((o) =>
      `<tr><td>${esc(o.contact_name)}</td><td>${esc(o.company)}</td><td>${esc(o.category)}</td><td>${esc(o.priority)}</td><td>${esc(o.status)}</td></tr>`,
    ).join('') || '<tr><td colspan="5">Sin oportunidades todavía.</td></tr>';
    const { tasks } = await api('/api/tasks?status=open');
    $('tasks').innerHTML = tasks.map((t) =>
      `<li>${esc(t.title)} — vence ${esc(t.due_at.slice(0, 10))} ` +
      `<button data-done="${t.id}">Marcar hecha</button></li>`,
    ).join('') || '<li>Sin tareas abiertas.</li>';
    document.querySelectorAll('[data-done]').forEach((b) => {
      b.onclick = async () => {
        await api(`/api/tasks/${b.dataset.done}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        await refresh();
      };
    });
    const { drafts } = await api('/api/drafts');
    const pending = drafts.filter((d) => d.status === 'pending_approval');
    $('drafts').innerHTML = pending.map((d) =>
      `<pre>${esc(d.body)}</pre>` +
      `<button data-approve="${d.id}">Aprobar</button> ` +
      `<button data-reject="${d.id}">Rechazar</button>`,
    ).join('') || '<p>Sin borradores pendientes.</p>';
    document.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = async () => { await api(`/api/drafts/${b.dataset.approve}/approve`, { method: 'POST', body: '{}' }); await refresh(); };
    });
    document.querySelectorAll('[data-reject]').forEach((b) => {
      b.onclick = async () => { await api(`/api/drafts/${b.dataset.reject}/reject`, { method: 'POST', body: JSON.stringify({ note: 'Rechazado desde la demo' }) }); await refresh(); };
    });
    const { audit } = await api('/api/audit');
    $('audit').innerHTML = audit.slice(0, 20).map((a) =>
      `<li>${esc(a.created_at.slice(0, 19))} — ${esc(a.actor)}: ${esc(a.action)} (${esc(a.entity)})</li>`,
    ).join('') || '<li>Sin registros.</li>';
    const { executions } = await api('/api/executions');
    $('executions').innerHTML = executions.slice(0, 20).map((e) =>
      `<li>${esc(e.created_at.slice(0, 19))} — ${esc(e.workflow)} v${esc(e.workflow_version)}: ${esc(e.status)}` +
      (e.status === 'failed' ? ` <button data-retry="${e.id}">Reintentar</button> — ${esc(e.error || '')}` : '') + '</li>',
    ).join('') || '<li>Sin ejecuciones.</li>';
    document.querySelectorAll('[data-retry]').forEach((b) => {
      b.onclick = async () => { await api(`/api/executions/${b.dataset.retry}/retry`, { method: 'POST', body: '{}' }); await refresh(); };
    });
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
  err.textContent = '';
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
    await refresh();
  } catch (e) {
    err.textContent = e.message;
  }
};

if (token()) refresh();
