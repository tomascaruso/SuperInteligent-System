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
      'execution.retried': 'Ejecución reintentada',
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
    }[e] ?? e
  );
}
