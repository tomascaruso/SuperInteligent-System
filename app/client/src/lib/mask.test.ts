import { describe, expect, it } from 'vitest';
import { maskEmail, maskJsonValue, maskName, maskPhone } from './mask';

describe('máscara de Actividad (F0/F1)', () => {
  it('enmascara correo, nombre y mensaje como antes', () => {
    expect(maskEmail('lucia@empresa.com')).toBe('l***@empresa.com');
    expect(maskName('Lucía Fernández')).toBe('L*** F***');
    expect(maskJsonValue('contactEmail', 'lucia@empresa.com')).toBe('l***@empresa.com');
    expect(maskJsonValue('company', 'Empresa')).toBe('E***');
  });

  it('enmascara el teléfono conservando código de país y últimos 4', () => {
    expect(maskPhone('+5491112345678')).toBe('+549***5678');
    expect(maskJsonValue('contactPhone', '+5491112345678')).toBe('+549***5678');
  });

  it('enmascara recipient según parezca correo o teléfono', () => {
    expect(maskJsonValue('recipient', 'lucia@empresa.com')).toBe('l***@empresa.com');
    expect(maskJsonValue('recipient', '+5491112345678')).toBe('+549***5678');
  });

  it('no toca claves sin datos personales', () => {
    expect(maskJsonValue('channel', 'gmail')).toBe('gmail');
    expect(maskJsonValue('status', 'sent')).toBe('sent');
  });
});
