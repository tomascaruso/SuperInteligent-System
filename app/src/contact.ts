// Contacto de la demo (F3-DEMO): un visitante pide una demo y el mensaje
// llega por correo al operador de PENSIA. El correo de destino vive SOLO
// en variables de entorno del servidor: nunca aparece en el código, en la
// página ni en el repo, y ningún endpoint lo devuelve.
//
// Diseño:
// - Sin SMTP configurado, el envío está cerrado (fail-closed) y el
//   formulario ni siquiera se muestra (GET /api/contact/status).
// - El mensaje no se guarda en la base: solo se envía. No hay datos de
//   prospectos persistidos en la demo.
// - Límite por IP y campo honeypot contra spam (ver routes.ts).
import nodemailer, { type Transporter } from 'nodemailer';
import { z } from 'zod';

export interface ContactConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  to: string;
  from: string;
}

// Límites pensados para un mensaje humano, no para abuso: nombre y empresa
// cortos, correo válido, mensaje de hasta 2000 caracteres. `website` es el
// honeypot: un humano no lo ve ni lo completa; un bot que lo llena queda
// descartado (ver routes.ts).
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(100).optional().default(''),
  message: z.string().trim().min(1).max(2000),
  website: z.string().trim().max(200).optional().default(''),
});

export type ContactInput = z.infer<typeof contactSchema>;

export function isContactConfigured(contact: ContactConfig | undefined): contact is ContactConfig {
  return (
    contact !== undefined &&
    contact.smtpHost !== '' &&
    contact.smtpUser !== '' &&
    contact.smtpPass !== '' &&
    contact.to !== ''
  );
}

// El asunto es fijo: el nombre va en el cuerpo, no en la cabecera, para no
// inyectar texto del visitante en headers del correo.
export function buildContactMail(input: ContactInput, from: string, to: string): { from: string; to: string; subject: string; text: string } {
  const lines = [
    'Nuevo contacto desde la demo de SuperInteligent System.',
    '',
    `Nombre: ${input.name}`,
    `Correo: ${input.email}`,
    `Empresa: ${input.company || '—'}`,
    '',
    'Mensaje:',
    input.message,
  ];
  return {
    from,
    to,
    subject: 'Nuevo contacto desde la demo de SuperInteligent System',
    text: lines.join('\n'),
  };
}

export function createContactTransporter(contact: ContactConfig): Transporter {
  // Timeouts explícitos y cortos: sin ellos, una conexión SMTP trabada
  // deja el envío colgado minutos (los defaults de nodemailer son
  // largos) y el visitante ve el botón deshabilitado para siempre, sin
  // confirmación ni error. Con estos límites, una traba se convierte en
  // un 502 visible en segundos (ver routes.ts).
  return nodemailer.createTransport({
    host: contact.smtpHost,
    port: contact.smtpPort,
    secure: contact.smtpPort === 465,
    auth: { user: contact.smtpUser, pass: contact.smtpPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}
