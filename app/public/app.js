// Interfaz de la demo (UI/UX System OS v1.1, Fase 4: Centro de aprobaciones). Sin frameworks;
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

// ---------- Diálogo de confirmación (Fase 4) ----------
// Requisitos de la especificación (5.7): título descriptivo, efecto real
// (nunca un genérico "¿Estás seguro?"), acciones diferenciadas, foco inicial
// en Cancelar, cierre con Escape, foco restaurado al elemento que abrió el
// diálogo y fondo inerte mientras está abierto (la superposición lo cubre).
// No existe "solicitar revisión" en el backend: no se muestra esa acción.
function draftStatusBadge(s) {
  return { pending_approval: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' }[s] || 'badge-neutral';
}

function draftStatusLabel(s) {
  return { pending_approval: 'Pendiente de aprobación', approved: 'Aprobada', rejected: 'Rechazada' }[s] || s;
}

// Solo presentación: "2026-10-26T13:06:00" → "2026-10-26 13:06:00".
function formatDateTime(s) {
  return s ? String(s).slice(0, 19).replace('T', ' ') : '';
}

let dialogOpener = null;
let dialogAction = null;

function openDialog(kind, draft, opener) {
  if (!draft) return;
  dialogOpener = opener || null;
  dialogAction = { kind, id: draft.id };
  const who = `${draft.contact_name}${draft.company ? ` (${draft.company})` : ''}`;
  const confirmBtn = $('dialog-confirm');
  if (kind === 'approve') {
    $('dialog-title').textContent = 'Aprobar borrador';
    $('dialog-text').textContent = `Vas a aprobar el borrador para ${who}. La oportunidad pasará a seguimiento y la decisión quedará registrada en la auditoría. No se enviará ningún mensaje.`;
    $('dialog-reason-wrap').classList.add('hidden');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = 'Aprobar';
  } else {
    $('dialog-title').textContent = 'Rechazar borrador';
    $('dialog-text').textContent = `Vas a rechazar el borrador para ${who}. La oportunidad volverá a nueva y la decisión quedará registrada en la auditoría. No se enviará ningún mensaje.`;
    $('dialog-reason-wrap').classList.remove('hidden');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = 'Rechazar';
  }
  $('dialog-reason').value = '';
  $('dialog-overlay').classList.remove('hidden');
  $('dialog-cancel').focus();
}

function closeDialog() {
  $('dialog-overlay').classList.add('hidden');
  $('dialog-reason').value = '';
  dialogAction = null;
  if (dialogOpener) {
    dialogOpener.focus();
    dialogOpener = null;
  }
}

$('dialog-cancel').onclick = closeDialog;

$('dialog-overlay').onclick = (e) => {
  if (e.target === $('dialog-overlay')) closeDialog();
};

document.addEventListener('keydown', (e) => {
  if ($('dialog-overlay').classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    closeDialog();
    return;
  }
  if (e.key === 'Tab') {
    const focusables = [...document.querySelectorAll('#dialog-overlay button, #dialog-overlay textarea')].filter((el) => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

$('dialog-confirm').onclick = async () => {
  if (!dialogAction) return;
  await withLoading($('dialog-confirm'), async () => {
    try {
      if (dialogAction.kind === 'approve') {
        await api(`/api/drafts/${dialogAction.id}/approve`, { method: 'POST', body: '{}' });
        setFeedback('draft-feedback', 'success', 'Borrador aprobado. La oportunidad pasó a seguimiento; no se envió ningún mensaje.');
      } else {
        await api(`/api/drafts/${dialogAction.id}/reject`, { method: 'POST', body: JSON.stringify({ note: $('dialog-reason').value }) });
        setFeedback('draft-feedback', 'success', 'Borrador rechazado. La oportunidad volvió a nueva.');
      }
      closeDialog();
      await refresh();
    } catch (e) {
      // Conflicto (409, "ya fue decidido") u otro error: se cierra el diálogo,
      // se informa en la sección y se recarga para mostrar el estado real.
      closeDialog();
      setFeedback('draft-feedback', 'error', e.message);
      await refresh();
    }
  });
};

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
    const decided = drafts.filter((d) => d.status !== 'pending_approval');
    // Contexto real: el join de /api/drafts ya trae contacto y empresa; la
    // categoría sale de la lista de oportunidades ya cargada. No hay campo
    // de canal ni de tipo en el backend: el canal se muestra No disponible.
    const oppById = new Map(opportunities.map((o) => [o.id, o]));
    const oppContext = (d) => {
      const o = oppById.get(d.opportunity_id);
      const company = d.company ? ` (${esc(d.company)})` : '';
      const category = o ? ` · ${esc(o.category)}` : '';
      return `${esc(d.contact_name)}${company}${category}`;
    };
    // Solo admin ve aprobar/rechazar (el servidor lo exige); el resto solo lee.
    const roleNote = pending.length && currentRole !== 'admin'
      ? '<p class="text-muted">Tu rol no permite aprobar ni rechazar borradores.</p>'
      : '';
    $('drafts').innerHTML = roleNote + pending.map((d) =>
      `<div class="card"><p><span class="badge badge-warning">Pendiente de aprobación</span></p>` +
      `<p><strong>Oportunidad relacionada:</strong> ${oppContext(d)}</p>` +
      `<p><strong>Canal:</strong> No disponible</p>` +
      `<p><strong>Alcance de la decisión:</strong> actualiza el estado de la oportunidad y registra la decisión en la auditoría. No envía ningún mensaje.</p>` +
      `<pre class="draft-body">${esc(d.body)}</pre>` +
      (currentRole === 'admin'
        ? `<button class="btn btn-primary btn-sm" data-approve="${d.id}">Aprobar</button> ` +
          `<button class="btn btn-danger btn-sm" data-reject="${d.id}">Rechazar</button>`
        : '') +
      `</div>`,
    ).join('') || '<p>Sin borradores pendientes.</p>';
    $('decided').innerHTML = decided.map((d) =>
      `<div class="card"><p><span class="badge ${draftStatusBadge(d.status)}">${esc(draftStatusLabel(d.status))}</span></p>` +
      `<p><strong>Oportunidad relacionada:</strong> ${oppContext(d)}</p>` +
      `<p>Decidido por ${esc(d.decided_by)} el ${esc(formatDateTime(d.decided_at))}</p>` +
      (d.note ? `<p><strong>Motivo:</strong> ${esc(d.note)}</p>` : '') +
      `<pre class="draft-body">${esc(d.body)}</pre></div>`,
    ).join('') || '<p>Aún no hay borradores decididos.</p>';
    const draftsById = new Map(drafts.map((d) => [d.id, d]));
    document.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = () => openDialog('approve', draftsById.get(b.dataset.approve), b);
    });
    document.querySelectorAll('[data-reject]').forEach((b) => {
      b.onclick = () => openDialog('reject', draftsById.get(b.dataset.reject), b);
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
