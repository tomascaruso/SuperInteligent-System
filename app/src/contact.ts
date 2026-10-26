// Contacto de la demo (F3-DEMO): un visitante pide una demo y el mensaje
// llega por correo al operador de PENSIA a través de un relay por HTTPS
// (un script propio en Apps Script; ver
// ~/workspace/superinteligent-system-relay/).
//
// Por qué relay y no SMTP: la red gratuita de Render bloquea la salida
// SMTP (probado con los puertos 587 y 465: la conexión ni siquiera se
// establece, CONNECT_TIMEOUT, sin llegar a autenticar). El tráfico HTTPS
// no está bloqueado, así que la app POSTea el mensaje al script y el
// script lo envía con MailApp desde la cuenta del operador.
//
// Diseño:
// - Sin relay configurado, el envío está cerrado (fail-closed) y el
//   formulario ni siquiera se muestra (GET /api/contact/status).
// - El mensaje no se guarda en la base: solo se envía. No hay datos de
//   prospectos persistidos en la demo.
// - El destino NO está en el código, la página ni el repo: el script
//   envía a la cuenta que lo ejecuta. La URL y el token del relay viven
//   solo en variables de entorno del servidor.
// - Límite por IP y campo honeypot contra spam (ver routes.ts).
import { z } from 'zod';

export interface ContactConfig {
  relayUrl: string;
  relayToken: string;
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
  return contact !== undefined && contact.relayUrl !== '' && contact.relayToken !== '';
}

// Envía el mensaje al relay. El `fetchFn` inyectable existe para testear
// sin red (los tests pasan un stub); en producción es el fetch global.
// El token viaja en el cuerpo, nunca en la URL (las URLs quedan en logs).
//
// IMPORTANTE: las redirecciones se dejan en el comportamiento estándar
// del fetch (seguirlas). Apps Script responde al POST con una redirección
// a su dominio de contenido y SIRVE el resultado del doPost en el
// pedido siguiente; reenviar el POST a mano a esa URL devuelve una
// página HTML en vez del JSON (eso fue exactamente el fallo del
// 26-oct-2026: el doPost corrió y terminó, pero la app recibió HTML y
// falló parseando). El flujo estándar es el mismo que usa el formulario
// de captación del ebook, que funciona.
// Apps Script siempre responde 200 con el resultado en el cuerpo
// ({ ok: true/false }); el código de error del relay se conserva en el
// mensaje de la excepción para que el log del servidor diga la causa
// (forbidden = token distinto, invalid = datos inválidos,
// failed = el script falló al enviar).
export type RelayFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export async function sendContactViaRelay(
  contact: ContactConfig,
  input: ContactInput,
  fetchFn: RelayFetch = fetch as unknown as RelayFetch,
): Promise<void> {
  const payload = JSON.stringify({
    name: input.name,
    email: input.email,
    company: input.company,
    message: input.message,
    token: contact.relayToken,
  });
  const res = await fetchFn(contact.relayUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { ok?: unknown; error?: unknown };
  if (res.status >= 200 && res.status < 300 && data.ok === true) {
    return;
  }
  const code = typeof data.error === 'string' ? data.error : 'unknown';
  throw new Error(`relay_failed:${code}`);
}
