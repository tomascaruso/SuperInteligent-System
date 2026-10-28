// Máscara de presentación para la vista de Actividad (extraída de
// ActivityView, sin cambios de comportamiento salvo las claves
// nuevas de F0/F1). Solo se enmascaran los valores de los campos
// personales. El servidor guarda el texto completo; la máscara vive
// solo en la presentación, nunca en la base.
//
// Claves enmascaradas:
// - contactEmail, recipient (si parece correo): primera letra + ***@dominio.
// - contactName, company: inicial de cada palabra + ***.
// - message: primeros 15 caracteres + «… (enmascarado)».
// - contactPhone, recipient (si parece teléfono): código de país y
//   últimos 4 dígitos visibles, resto * (F0/F1). Si no se agrega una
//   clave nueva con datos personales, su valor se filtraría en el
//   bloque técnico plegado: ese fue el punto de verificación
//   obligatorio de F1.

export function maskName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.slice(0, 1)}***`)
    .join(' ');
}

export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  const last4 = digits.slice(-4);
  const country = value.trim().startsWith('+') ? `+${digits.slice(0, digits.length - 4).slice(0, 3)}` : '';
  return `${country}***${last4}`;
}

export function maskMessage(value: string): string {
  return value.length > 15 ? `${value.slice(0, 15)}… (enmascarado)` : '*** (enmascarado)';
}

function maskRecipient(value: string): string {
  return value.includes('@') ? maskEmail(value) : maskPhone(value);
}

export function maskJsonValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => maskJsonValue(key, v));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = maskJsonValue(k, v);
    return out;
  }
  if (typeof value !== 'string') return value;
  if (key === 'contactEmail') return maskEmail(value);
  if (key === 'contactName' || key === 'company') return maskName(value);
  if (key === 'message') return maskMessage(value);
  if (key === 'contactPhone') return maskPhone(value);
  if (key === 'recipient') return maskRecipient(value);
  return value;
}
