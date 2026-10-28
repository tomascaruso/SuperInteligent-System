// Etiquetas y formatos de presentación, copiados del vanilla
// (app/public/app.js): son solo presentación, no cambian los
// valores que guarda el servidor. El servidor guarda UTC (ISO
// con Z); las fechas se muestran en la zona del navegador.

export function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

// Fecha local (AAAA-MM-DD) de un ISO, para vencimientos: se
// compara y se muestra en la zona del navegador, no en UTC.
export function localDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(s: string): string {
  const l = localDate(s);
  const parts = l.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : l;
}

export function formatDateTime(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 19).replace('T', ' ');
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Solo presentación: el clasificador guarda 'general' cuando
// ningún tema coincide; en pantalla se lee 'Consulta general'.
export function categoryLabel(c: string): string {
  return c === 'general' ? 'Consulta general' : c;
}

export function priorityLabel(p: string): string {
  return { high: 'Alta', medium: 'Media', low: 'Baja' }[p] ?? p;
}

// Etiquetas copiadas del vanilla (app/public/app.js): estado de
// oportunidad, canal de entrada y estado de borrador.
export function statusLabel(s: string): string {
  return { proposal_draft: 'Borrador de propuesta', in_follow_up: 'En seguimiento', new: 'Nueva' }[s] ?? s;
}

export function channelLabel(s: string): string {
  return { manual: 'Alta manual', webhook: 'Entrada externa' }[s] ?? 'No disponible';
}

export function draftStatusLabel(s: string): string {
  return { pending_approval: 'Pendiente de aprobación', approved: 'Aprobada', rejected: 'Rechazada' }[s] ?? s;
}

export function auditActionLabel(a: string): string {
  return (
    {
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
      // R3b: edición humana del borrador.
      'draft.edited': 'Borrador editado',
      'execution.retried': 'Ejecución reintentada',
      // H1: pausa de agentes.
      'agent.paused': 'Agente pausado',
      'agent.resumed': 'Agente reanudado',
      // F1: envío por el agente tras aprobar.
      'message.sent': 'Mensaje enviado',
      'message.failed': 'Envío fallido',
      // Fase A: respuesta entrante por webhook (sin respuesta automática).
      'message.received': 'Respuesta recibida',
    }[a] ?? a
  );
}

export function auditEntityLabel(e: string): string {
  return (
    {
      user: 'usuario',
      org: 'organización',
      organization: 'organización',
      opportunity: 'oportunidad',
      task: 'tarea',
      draft: 'borrador',
      execution: 'ejecución',
      agent: 'agente',
      delivery: 'entrega',
    }[e] ?? e
  );
}

// H1: etiquetas de Inicio (procesos, etapas, agentes). Solo
// presentación: los valores que guarda el servidor no cambian.
export function processStatusLabel(s: string): string {
  return { running: 'En curso', done: 'Completada', failed: 'Fallida' }[s] ?? s;
}

export function stageStatusLabel(s: string): string {
  return (
    { pending: 'Pendiente', done: 'Hecha', failed: 'Fallida', rejected: 'Rechazada', paused: 'Pausada' }[s] ?? s
  );
}

export function agentStatusLabel(s: string): string {
  return { paused: 'En pausa', busy: 'Ocupado', available: 'Disponible' }[s] ?? s;
}

// H1: tiempo relativo para "Última actualización" de Procesos.
// Si la fecha es inválida, devuelve la fecha absoluta recortada.
export function formatRelative(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return formatDateTime(s);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  if (hours < 48) return 'Ayer';
  return formatDate(s);
}
