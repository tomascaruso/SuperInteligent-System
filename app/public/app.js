// Interfaz de la demo (UI/UX System OS v1.1, Fase 5: Actividad y ejecuciones). Sin frameworks;
// C7: la sesión viaja en cookie httpOnly (el servidor la pone al entrar y
// el navegador la manda sola en cada llamada; ningún script la puede leer).
const $ = (id) => document.getElementById(id);
const err = $('error');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Fase 6: el estado viaja con el error para que refresh() distinga
    // una sesión expirada (401) de cualquier otro fallo.
    const error = new Error(data.message || data.error || `Error ${res.status}`);
    error.status = res.status;
    throw error;
  }
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

// Solo presentación: el clasificador guarda 'general' cuando ningún tema
// coincide; en pantalla se lee 'Consulta general', que dice lo mismo sin
// el token técnico. El valor guardado no cambia (las reglas de
// clasificación son otro tema, no un texto).
function categoryLabel(c) {
  return { general: 'Consulta general' }[c] || c;
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

// Solo presentación. El servidor guarda UTC (ISO con Z): se muestra en la
// zona horaria del navegador, no en UTC crudo (la revisión F3-DEMO encontró
// horas 3 h por delante del reloj local sin advertencia). Si el valor no
// parsea, se muestra tal cual como antes.
function formatDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 19).replace('T', ' ');
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Fecha local (AAAA-MM-DD) de un ISO, para vencimientos: se compara y se
// muestra en la zona del navegador, no en UTC.
function localDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(s) {
  const l = localDate(s);
  const parts = l.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : l;
}

// Pluralización real, no "(es)": 1 borrador pendiente, 2 borradores pendientes.
function plural(n, singular, pluralForm) {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

// Solo presentación: los pasos y el proceso se guardan con nombre técnico;
// se muestran en lenguaje de negocio. Los no mapeados se muestran tal cual.
function stepLabel(s) {
  return {
    normalize: 'Recibe y ordena el contacto',
    dedup: 'Revisa si ya existe',
    classify: 'Lo clasifica y le pone prioridad',
    upsert: 'Registra la oportunidad',
    next_action: 'Crea la tarea con vencimiento',
    draft: 'Redacta el borrador de respuesta',
  }[s] || s;
}

function workflowLabel(w) {
  return { 'opportunity.intake': 'Captación de oportunidades' }[w] || w;
}

// Canal de entrada de la oportunidad: 'manual' es el alta manual del
// formulario, 'webhook' es una entrada externa por integración.
function channelLabel(s) {
  return { manual: 'Alta manual', webhook: 'Entrada externa' }[s] || 'No disponible';
}

// ---------- Etiquetas de actividad y ejecuciones (Fase 5) ----------
// Solo presentación: los códigos sin mapear se muestran tal cual. Estados
// reales de ejecución: done y failed (no existen pendiente, en ejecución ni
// reintentando en el backend, así que no se muestran).
function executionStatusBadge(s) {
  return { done: 'badge-success', failed: 'badge-danger' }[s] || 'badge-neutral';
}

function executionStatusLabel(s) {
  return { done: 'Completada', failed: 'Fallida' }[s] || s;
}

function auditActionLabel(a) {
  return {
    'user.login': 'Inicio de sesión',
    'user.created': 'Usuario creado',
    'org.created': 'Organización creada',
    'opportunity.created': 'Oportunidad creada',
    'opportunity.updated': 'Oportunidad actualizada',
    'task.created': 'Tarea creada',
    'task.updated': 'Tarea actualizada',
    'draft.created': 'Borrador creado',
    'draft.approved': 'Borrador aprobado',
    'draft.rejected': 'Borrador rechazado',
    'execution.retried': 'Ejecución reintentada',
  }[a] || a;
}

function auditEntityLabel(e) {
  return {
    user: 'usuario',
    org: 'organización',
    organization: 'organización',
    opportunity: 'oportunidad',
    task: 'tarea',
    draft: 'borrador',
    execution: 'ejecución',
  }[e] || e;
}

function parseJson(s) {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

let dialogOpener = null;
let dialogAction = null;

function openDialog(kind, item, opener) {
  if (!item) return;
  dialogOpener = opener || null;
  dialogAction = { kind, id: item.id };
  const confirmBtn = $('dialog-confirm');
  if (kind === 'approve' || kind === 'reject') {
    const who = `${item.contact_name}${item.company ? ` (${item.company})` : ''}`;
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
  } else if (kind === 'retry') {
    // Reintento (Fase 5, 4.5): qué ejecución se repetirá y que el resultado
    // puede depender del estado actual del sistema. El servidor solo permite
    // reintentar ejecuciones fallidas (409 en otro caso).
    $('dialog-title').textContent = 'Reintentar ejecución';
    $('dialog-text').textContent = `Vas a repetir la ejecución «${item.workflow} v${item.workflow_version}» (fallida). El resultado puede depender del estado actual del sistema: se volverá a procesar la oportunidad original y quedará registrada una nueva ejecución. Solo un admin puede reintentar, con un máximo por ejecución según las políticas.`;
    $('dialog-reason-wrap').classList.add('hidden');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = 'Reintentar';
  } else {
    return;
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
    // Solo elementos visibles: el textarea del motivo está oculto
    // (display:none) al aprobar, y si entraba en la lista el foco
    // envolvía hacia un elemento sin renderizar y quedaba fijo
    // en Cancelar. offsetParent es null para display:none.
    const focusables = [...document.querySelectorAll('#dialog-overlay button, #dialog-overlay textarea')].filter((el) => !el.disabled && el.offsetParent !== null);
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
  const feedbackId = dialogAction.kind === 'retry' ? 'activity-feedback' : 'draft-feedback';
  await withLoading($('dialog-confirm'), async () => {
    try {
      if (dialogAction.kind === 'approve') {
        await api(`/api/drafts/${dialogAction.id}/approve`, { method: 'POST', body: '{}' });
        setFeedback(feedbackId, 'success', 'Borrador aprobado. La oportunidad pasó a seguimiento; no se envió ningún mensaje.');
      } else if (dialogAction.kind === 'reject') {
        await api(`/api/drafts/${dialogAction.id}/reject`, { method: 'POST', body: JSON.stringify({ note: $('dialog-reason').value }) });
        setFeedback(feedbackId, 'success', 'Borrador rechazado. La oportunidad volvió a nueva.');
      } else {
        await api(`/api/executions/${dialogAction.id}/retry`, { method: 'POST', body: '{}' });
        setFeedback(feedbackId, 'success', 'Ejecución reintentada. Se creó una nueva ejecución; revisá la lista.');
      }
      closeDialog();
      await refresh();
    } catch (e) {
      // Conflicto (409) u otro error: se cierra el diálogo, se informa en la
      // sección y se recarga para mostrar el estado real. Sin éxito falso.
      closeDialog();
      setFeedback(feedbackId, 'error', e.message);
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
  agentes: { title: 'Agentes', subtitle: 'Qué hace cada agente y qué tareas abiertas tiene a cargo.' },
};

// Solo presentación: qué hace cada agente, en lenguaje de negocio. Los
// roles son los reales del catálogo; si aparece un agente no mapeado, se
// muestra su descripción guardada.
function agentBusinessDescription(a) {
  return {
    intake: 'Recibe cada contacto que entra, lo ordena, revisa que no esté duplicado y lo registra como oportunidad.',
    qualification: 'Lee el mensaje y lo clasifica por tema y urgencia con reglas fijas, para que lo importante se atienda primero.',
    response_proposal: 'Redacta el borrador de respuesta con plantillas, para que una persona lo revise antes de decidir.',
    follow_up: 'Crea la tarea de seguimiento con su vencimiento, para que ningún contacto quede sin atender.',
    qa_policy: 'Revisa que todo cumpla las reglas antes de la aprobación. No aprueba solo: la decisión final siempre es de una persona.',
  }[a.id] || a.description || '';
}

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
  if (!$('app-section').classList.contains('hidden')) showView(location.hash.replace('#', ''));
});

// ---------- Recorrido guiado (F3-DEMO) ----------
// Solo presentación: no cambia ningún estado, solo navega por las vistas
// y explica el flujo en lenguaje de negocio. Se abre a mano (nunca
// automático), se cierra con Cerrar, Terminar, Escape o al salir. Los
// textos son genéricos a propósito: describen el flujo, no los datos de
// la demo, para que el recorrido siga valiendo si los datos cambian.
const TOUR_STEPS = [
  { view: 'inicio', title: 'Así funciona, en 2 minutos', text: 'Entra un contacto, el sistema lo clasifica, crea la tarea con su vencimiento y redacta el borrador. Una persona aprueba antes de que pase nada: el sistema no envía mensajes solo. Empecemos por donde se ve qué requiere atención.' },
  { view: 'inicio', title: 'Qué requiere atención', text: 'En Inicio ves los números (oportunidades, tareas, aprobaciones) y las acciones prioritarias: lo vencido y lo pendiente de aprobación, con enlaces a cada sección.' },
  { view: 'oportunidades', title: 'Las oportunidades', text: 'Cada contacto que entra queda registrado con su empresa, categoría y prioridad. Desde acá también se puede cargar una oportunidad a mano, sin esperar a que entre por otro canal.' },
  { view: 'tareas', title: 'Las tareas', text: 'Cada oportunidad genera su tarea con vencimiento. La lista dice a quién corresponde y qué agente la tiene a cargo, para que ningún seguimiento quede sin hacer.' },
  { view: 'aprobaciones', title: 'Aprobar, con control humano', text: 'Antes de decidir, se revisa el borrador completo: a quién va dirigido, por qué canal entró y qué cambia la decisión. Aprobar actualiza el estado y deja registro; no envía ningún mensaje.' },
  { view: 'agentes', title: 'Quién hace cada parte', text: 'Cinco agentes con reglas fijas se reparten el trabajo: uno recibe, otro clasifica, otro redacta, otro programa el seguimiento y otro revisa que se cumplan las reglas. Ninguno decide solo.' },
  { view: 'actividad', title: 'Todo queda registrado', text: 'Cada operación deja rastro: quién hizo qué y cuándo, qué proceso corrió y qué pasos dio, en lenguaje de negocio. Así se puede auditar todo después.' },
  { view: 'inicio', title: '¿Querés esto para tu empresa?', text: 'Este es el recorrido completo. Si querés un sistema así para tu empresa, salí y completá "Quiero una demo para mi empresa" en la pantalla de acceso: PENSIA te responde.' },
];

let tourStep = 0;

function showTourStep(i) {
  tourStep = Math.max(0, Math.min(TOUR_STEPS.length - 1, i));
  const s = TOUR_STEPS[tourStep];
  // Hash + vista directa: si el paso repite la vista actual, el hash no
  // cambia y no dispara hashchange, así que la vista se fuerza igual.
  location.hash = s.view;
  showView(s.view);
  $('tour-step-label').textContent = `Paso ${tourStep + 1} de ${TOUR_STEPS.length}`;
  $('tour-title').textContent = s.title;
  $('tour-text').textContent = s.text;
  $('tour-prev').disabled = tourStep === 0;
  $('tour-next').textContent = tourStep === TOUR_STEPS.length - 1 ? 'Terminar' : 'Siguiente';
  $('tour-panel').classList.remove('hidden');
  $('tour-next').focus();
}

function closeTour() {
  $('tour-panel').classList.add('hidden');
}

$('btn-tour').onclick = () => showTourStep(0);
$('tour-prev').onclick = () => showTourStep(tourStep - 1);
$('tour-next').onclick = () => {
  if (tourStep === TOUR_STEPS.length - 1) closeTour();
  else showTourStep(tourStep + 1);
};
$('tour-close').onclick = closeTour;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('tour-panel').classList.contains('hidden')) closeTour();
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
  // Paso 1 (referencia visual): bienvenida y chip de usuario con los
  // datos reales de /api/me. textContent no necesita escape: el
  // navegador no interpreta el texto como HTML.
  $('who').textContent = `Hola, ${user.name}${org.name ? ` — ${org.name}` : ''} (${user.role})`;
  $('user-chip').textContent = `${user.name} · ${user.role}`;
  showView(location.hash.replace('#', '') || 'inicio');
}

// Paso 1 (referencia visual): el indicador refleja la última
// actualización: solo dice "Sistema operativo" si la carga de la API
// tuvo éxito; si falló, dice "Sin conexión". Nunca se afirma un estado
// que no se acaba de comprobar.
function setSystemStatus(ok) {
  const pill = $('system-status');
  $('system-status-text').textContent = ok ? 'Sistema operativo' : 'Sin conexión';
  pill.classList.toggle('status-ok', ok);
  pill.classList.toggle('status-down', !ok);
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
      `<td data-label="Categoría">${esc(categoryLabel(o.category))}</td>` +
      `<td data-label="Prioridad"><span class="badge ${priorityBadge(o.priority)}">${esc(priorityLabel(o.priority))}</span></td>` +
      `<td data-label="Estado"><span class="badge ${statusBadge(o.status)}">${esc(statusLabel(o.status))}</span></td></tr>`,
    ).join('') || '<tr><td colspan="5"><div class="empty-state">Aún no hay oportunidades. Creá la primera con el formulario de alta manual.</div></td></tr>';
    const { tasks } = await api('/api/tasks?status=open');
    $('tasks').innerHTML = tasks.map((t) => {
      const who = t.contact_name ? ` — Para: ${esc(t.contact_name)}${t.company ? ` (${esc(t.company)})` : ''}` : '';
      return `<li>${esc(t.title)}${who} — Agente: ${esc(t.agent_name || t.assigned_to)} — vence ${esc(formatDate(t.due_at))} ` +
        `<button class="btn btn-secondary btn-sm" data-done="${t.id}">Marcar hecha</button></li>`;
    }).join('') || '<li class="empty-state">Sin tareas abiertas. Cuando llegue una oportunidad, sus seguimientos aparecerán acá.</li>';
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
    // F3-DEMO: sección de agentes con datos reales: el catálogo de
    // /api/agents y las tareas abiertas ya cargadas, contadas por agente.
    // Sin tareas, el conteo es cero, no se inventa trabajo.
    const { agents } = await api('/api/agents');
    const openByAgent = new Map();
    tasks.forEach((t) => {
      if (t.agent_id) openByAgent.set(t.agent_id, (openByAgent.get(t.agent_id) || 0) + 1);
    });
    $('agents').innerHTML = agents.map((a) => {
      const open = openByAgent.get(a.id) || 0;
      const steps = a.steps && a.steps.length
        ? `<p><strong>Hace:</strong> ${a.steps.map((s) => esc(stepLabel(s))).join(' · ')}</p>`
        : '<p><strong>Hace:</strong> Sin pasos propios en el proceso actual: revisa, no ejecuta.</p>';
      return `<div class="card"><p><strong>${esc(a.name)}</strong></p>` +
        `<p>${esc(agentBusinessDescription(a))}</p>${steps}` +
        `<p>${plural(open, 'tarea abierta', 'tareas abiertas')} a cargo.</p></div>`;
    }).join('') || '<p>Aún no hay agentes registrados.</p>';
    const { drafts } = await api('/api/drafts');
    const pending = drafts.filter((d) => d.status === 'pending_approval');
    const decided = drafts.filter((d) => d.status !== 'pending_approval');
    // Contexto real: el join de /api/drafts trae contacto, empresa y canal
    // (source de la oportunidad); la categoría sale de la lista de
    // oportunidades ya cargada.
    const oppById = new Map(opportunities.map((o) => [o.id, o]));
    const oppContext = (d) => {
      const o = oppById.get(d.opportunity_id);
      const company = d.company ? ` (${esc(d.company)})` : '';
      const category = o ? ` · ${esc(categoryLabel(o.category))}` : '';
      return `${esc(d.contact_name)}${company}${category}`;
    };
    // Solo admin ve aprobar/rechazar (el servidor lo exige); el resto solo lee.
    const roleNote = pending.length && currentRole !== 'admin'
      ? '<p class="text-muted">Tu rol no permite aprobar ni rechazar borradores.</p>'
      : '';
    $('drafts').innerHTML = roleNote + pending.map((d) => {
      // C5: un borrador vencido o desactualizado no se puede aprobar (el
      // servidor lo rechaza con 409); rechazarlo sigue permitido y es la
      // forma de descartarlo para generar uno nuevo.
      const blocked = d.expired ? 'Vencido' : (d.stale ? 'Desactualizado' : '');
      const blockedNote = d.expired
        ? 'Este borrador venció: pasaron más de 7 días desde que se creó y ya no se puede aprobar. Podés rechazarlo y generar uno nuevo.'
        : (d.stale
          ? 'Este borrador quedó desactualizado: el mensaje de la oportunidad cambió desde que se creó y ya no se puede aprobar. Podés rechazarlo y generar uno nuevo.'
          : '');
      return `<div class="card"><p><span class="badge badge-warning">Pendiente de aprobación</span>` +
        (blocked ? ` <span class="badge badge-danger">${blocked}</span>` : '') + `</p>` +
        `<p><strong>Oportunidad relacionada:</strong> ${oppContext(d)}</p>` +
        `<p><strong>Canal:</strong> ${esc(channelLabel(d.opportunity_source))}</p>` +
        `<p><strong>Alcance de la decisión:</strong> actualiza el estado de la oportunidad y registra la decisión en la auditoría. No envía ningún mensaje.</p>` +
        (blockedNote ? `<p class="text-muted">${blockedNote}</p>` : '') +
        `<pre class="draft-body">${esc(d.body)}</pre>` +
        (currentRole === 'admin'
          ? `<button class="btn btn-primary btn-sm" data-approve="${d.id}"${blocked ? ' disabled title="Este borrador ya no se puede aprobar"' : ''}>Aprobar</button> ` +
            `<button class="btn btn-danger btn-sm" data-reject="${d.id}">Rechazar</button>`
          : '') +
        `</div>`;
    }).join('') || '<p>Sin borradores pendientes.</p>';
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
    // Detalle legible del evento, solo con datos reales del servidor: si el
    // detalle cita una oportunidad, se resuelve a su contacto; si trae
    // categoría/prioridad, se muestran con etiquetas. El resto se ignora.
    const auditDetail = (a) => {
      const d = parseJson(a.detail_json);
      if (d.opportunityId) {
        const o = oppById.get(d.opportunityId);
        return o ? ` · oportunidad: ${esc(o.contact_name)}${o.company ? ` (${esc(o.company)})` : ''}` : '';
      }
      const parts = [];
      if (d.category) parts.push(`categoría ${esc(categoryLabel(d.category))}`);
      if (d.priority) parts.push(`prioridad ${esc(priorityLabel(d.priority))}`);
      return parts.length ? ` · ${parts.join(' · ')}` : '';
    };
    const auditItems = (a) => `<li>${esc(formatDateTime(a.created_at))} — ${esc(a.actor)}: ${esc(auditActionLabel(a.action))} (${esc(auditEntityLabel(a.entity))})${auditDetail(a)}</li>`;
    $('audit').innerHTML = audit.slice(0, 20).map(auditItems).join('') || '<li class="empty-state">Sin registros de actividad todavía.</li>';
    // F3-DEMO: el resumen de Inicio muestra qué está pasando en el negocio,
    // no los inicios de sesión (que tapaban todo tras cada verificación).
    // La auditoría completa, con los inicios de sesión, sigue en Actividad.
    const businessAudit = audit.filter((a) => a.action !== 'user.login');
    $('activity').innerHTML = businessAudit.slice(0, 5).map(auditItems).join('') || '<li class="empty-state">Sin actividad comercial todavía.</li>';
    const { executions } = await api('/api/executions');
    // C3 (alineación PENSIA): corridas de proceso, una por ejecución en
    // este flujo. 'En curso' es un estado real guardado (una corrida puede
    // quedar así si el servidor cae a mitad del intake), no un estado
    // inventado para la UI.
    const processStatusLabel = (s) => ({ running: 'En curso', done: 'Completada', failed: 'Fallida' }[s] || s);
    const { processes } = await api('/api/processes');
    $('processes').innerHTML = processes.slice(0, 20).map((p) => {
      const ex = p.execution ? ` · ejecución <span class="text-muted" title="${esc(p.execution.id)}">(${esc(p.execution.id.slice(0, 8))})</span>` : '';
      return `<li><span class="badge ${executionStatusBadge(p.status)}">${esc(processStatusLabel(p.status))}</span> ` +
        `${esc(workflowLabel(p.workflow))} v${esc(p.workflow_version)} · ${esc(formatDateTime(p.created_at))}${ex}</li>`;
    }).join('') || '<li class="empty-state">Sin procesos todavía.</li>';
    // C2 (alineación PENSIA): los pasos ya se persistían y ahora se exponen
    // por /api/executions/:id/steps. El detalle real es workflow, versión,
    // identificador, inicio/fin, resultado (oportunidad creada) o error, más
    // los pasos reales bajo «Ver pasos». Nada se inventa: sin pasos, el
    // texto lo dice. El botón Reintentar solo aparece en fallidas, como
    // exige el servidor, y abre el diálogo de confirmación (no actúa
    // directo).
    const stepSummary = (s) => {
      const out = parseJson(s.output_json);
      if (out.category && out.priority) return ` · categoría ${esc(categoryLabel(out.category))} · prioridad ${esc(priorityLabel(out.priority))}`;
      if (typeof out.matched === 'boolean') return ` · duplicado: ${out.matched ? 'sí' : 'no'}`;
      return '';
    };
    const stepItems = (s) => `<li><span class="badge ${executionStatusBadge(s.status)}">${esc(executionStatusLabel(s.status))}</span> ` +
      `${esc(stepLabel(s.step))} · ${esc(formatDateTime(s.created_at))}${stepSummary(s)}${s.error ? ` — Error: ${esc(s.error)}` : ''}</li>`;
    $('executions').innerHTML = executions.slice(0, 20).map((e) => {
      const result = parseJson(e.result_json);
      const opp = result.opportunity;
      const detail = e.status === 'failed' && e.error
        ? ` — Error: ${esc(e.error)}`
        : (opp ? ` — Resultado: oportunidad ${esc(opp.contact_name)}${opp.company ? ` (${esc(opp.company)})` : ''}` : '');
      const fin = e.updated_at && e.updated_at.slice(0, 19) !== e.created_at.slice(0, 19)
        ? ` · Fin ${esc(formatDateTime(e.updated_at))}` : '';
      return `<li><span class="badge ${executionStatusBadge(e.status)}">${esc(executionStatusLabel(e.status))}</span> ` +
        `${esc(formatDateTime(e.created_at))} — ${esc(workflowLabel(e.workflow))} v${esc(e.workflow_version)}` +
        ` <span class="text-muted" title="${esc(e.id)}">(${esc(e.id.slice(0, 8))})</span>${fin}${detail}` +
        ` <button class="btn btn-secondary btn-sm" data-steps="${e.id}">Ver pasos</button>` +
        (e.status === 'failed' && currentRole === 'admin' ? ` <button class="btn btn-secondary btn-sm" data-retry="${e.id}">Reintentar</button>` : '') +
        '<ul class="execution-steps hidden"></ul></li>';
    }).join('') || '<li class="empty-state">Sin ejecuciones todavía.</li>';
    const executionsById = new Map(executions.map((e) => [e.id, e]));
    document.querySelectorAll('[data-retry]').forEach((b) => {
      b.onclick = () => openDialog('retry', executionsById.get(b.dataset.retry), b);
    });
    // Pasos bajo demanda: se cargan una vez por ejecución y luego solo se
    // muestran/ocultan. Un fallo de carga queda visible en la propia lista.
    document.querySelectorAll('[data-steps]').forEach((b) => {
      b.onclick = async () => {
        const list = b.parentElement.querySelector('.execution-steps');
        if (!list) return;
        if (list.dataset.loaded === '1') {
          list.classList.toggle('hidden');
          b.textContent = list.classList.contains('hidden') ? 'Ver pasos' : 'Ocultar pasos';
          return;
        }
        list.innerHTML = '<li class="text-muted">Cargando pasos…</li>';
        list.classList.remove('hidden');
        try {
          const { steps } = await api(`/api/executions/${b.dataset.steps}/steps`);
          list.innerHTML = steps.map(stepItems).join('') || '<li class="empty-state">Sin pasos registrados.</li>';
          list.dataset.loaded = '1';
          b.textContent = 'Ocultar pasos';
        } catch (e2) {
          list.innerHTML = '<li class="text-muted">No se pudieron cargar los pasos.</li>';
        }
      };
    });
    // Acciones prioritarias de Inicio, calculadas con los datos ya cargados.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const items = [];
    tasks.filter((t) => localDate(t.due_at) < today).forEach((t) => {
      items.push(`<li>${esc(t.title)} — venció ${esc(formatDate(t.due_at))} <a href="#tareas">Ver tareas</a></li>`);
    });
    if (pending.length) items.push(`<li>${plural(pending.length, 'borrador pendiente', 'borradores pendientes')} de aprobación — <a href="#aprobaciones">Revisar</a></li>`);
    const failed = executions.filter((e) => e.status === 'failed');
    if (failed.length) items.push(`<li>${plural(failed.length, 'ejecución fallida', 'ejecuciones fallidas')} — <a href="#actividad">Ver actividad</a></li>`);
    $('priority').innerHTML = items.join('') || '<li>Sin acciones urgentes.</li>';
    setSystemStatus(true);
  } catch (e) {
    setSystemStatus(false);
    // Fase 6 — recuperación: una sesión expirada vuelve a la pantalla de
    // acceso en vez de dejar la app visible con datos viejos; un fallo de
    // red se explica en español en vez de mostrar el mensaje del navegador.
    if (e.status === 401) {
      $('app-section').classList.add('hidden');
      $('auth-section').classList.remove('hidden');
      err.textContent = 'La sesión expiró. Volvé a entrar.';
    } else if (e.message === 'Failed to fetch') {
      err.textContent = 'No se pudo contactar al servidor. Revisá tu conexión y reintentá.';
    } else {
      err.textContent = e.message;
    }
  }
}

// C8: ya no hay registro público. El alta es por invitación de PENSIA:
$('btn-show-invitation').onclick = () => {
  const section = $('invitation-section');
  section.classList.toggle('hidden');
  // Fase 6: al mostrar el formulario, el foco va al primer campo.
  if (!section.classList.contains('hidden')) $('inv-token').focus();
};

// Fase 6: entrar y aceptar usan withLoading como el resto de las acciones:
// evitan dobles envíos y muestran que algo está pasando.
$('btn-accept').onclick = () => withLoading($('btn-accept'), async () => {
  err.textContent = '';
  try {
    await api('/api/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({
        token: $('inv-token').value,
        name: $('inv-name').value,
        password: $('inv-password').value,
      }),
    });
    await refresh();
  } catch (e) {
    err.textContent = e.message;
  }
});

$('btn-login').onclick = () => withLoading($('btn-login'), async () => {
  err.textContent = '';
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    await refresh();
  } catch (e) {
    err.textContent = e.message;
  }
});

// Contacto (F3-DEMO): el formulario solo se muestra si el servidor tiene
// el envío configurado. El correo de destino vive solo en el servidor
// (variables de entorno) y nunca aparece en esta página. Sin configuración,
// la sección queda oculta y no se ofrece un formulario que no puede enviar.
api('/api/contact/status').then((s) => {
  if (s.enabled) $('contact-section').classList.remove('hidden');
}).catch(() => {});

$('btn-contact').onclick = () => withLoading($('btn-contact'), async () => {
  // Red de seguridad: si el servidor tarda más de 30 s, se corta la
  // espera y se muestra un error en vez de dejar el botón deshabilitado
  // para siempre (eso pasó en la primera prueba de envío, cuando la
  // conexión SMTP se trabó sin responder).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    await api('/api/contact', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        name: $('contact-name').value,
        email: $('contact-email').value,
        company: $('contact-company').value,
        message: $('contact-message').value,
        website: $('contact-website').value,
      }),
    });
    $('contact-name').value = '';
    $('contact-email').value = '';
    $('contact-company').value = '';
    $('contact-message').value = '';
    setFeedback('contact-feedback', 'success', 'Gracias, recibimos tu mensaje. PENSIA te va a contactar.');
  } catch (e) {
    setFeedback('contact-feedback', 'error', e.name === 'AbortError' ? 'El envío tardó demasiado; probá de nuevo más tarde.' : e.message);
  } finally {
    clearTimeout(timer);
  }
});

$('btn-logout').onclick = async () => {
  // C7: cierra la sesión httpOnly en el servidor; la UI se oculta igual
  // aunque la llamada falle (por ejemplo, sesión ya vencida).
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Sin sesión que cerrar: igual se vuelve a la pantalla de acceso.
  }
  closeTour();
  $('app-section').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
};

// Fase 6: actualizar también deshabilita el botón mientras carga, para
// que dos actualizaciones no se pisen entre sí.
$('btn-refresh').onclick = () => withLoading($('btn-refresh'), refresh);

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

// C7: al arrancar, la sesión se detecta por cookie: si /api/me responde,
// hay sesión y se carga la app; si no, queda la pantalla de acceso.
api('/api/me').then(() => refresh()).catch(() => {});
