import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------- Envío por agente (F0/F1/F2, diseño de Gmail + WhatsApp) ----------
//
// El envío saliente vive acá, separado de las rutas: los adaptadores de
// proveedor no conocen la base de datos y las rutas no conocen HTTP de
// terceros. En tests se inyecta un proveedor simulado (ver
// RouteOptions.mailProvider y RouteOptions.whatsappProvider); en
// producción se usan los adaptadores reales de Gmail y WhatsApp.
// NUNCA se hacen envíos reales en tests ni en smokes: los
// proveedores reales solo corren con credenciales de operador
// configuradas y cuentas de prueba autorizadas expresamente por Tomás.

export const SEND_TIMEOUT_MS = 15000;

export type SendErrorCode =
  | 'connection_error'
  | 'provider_error'
  | 'timeout'
  | 'not_supported'
  // F2: Meta rechazó el texto libre porque pasaron más de 24 horas
  // desde la última respuesta del interesado (error 131047 de la
  // Graph API). No se reintenta con otro canal: UNIQUE(draft_id)
  // impide un segundo envío para el mismo borrador (ver reporte F2).
  | 'window_closed';

export class ProviderError extends Error {
  code: SendErrorCode;
  constructor(code: SendErrorCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

export class ConnectionKeyMissingError extends Error {
  constructor() {
    super('Falta la clave de cifrado de conexiones (CONNECTION_ENCRYPTION_KEY)');
    this.name = 'ConnectionKeyMissingError';
  }
}

export interface MailCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface MailSendResult {
  providerMessageId: string;
  refreshedCredentials?: MailCredentials;
}

export interface MailProvider {
  send(input: {
    to: string;
    subject: string;
    body: string;
    credentials: MailCredentials;
  }): Promise<MailSendResult>;
  // Verificación real contra el proveedor (perfil de la cuenta).
  // Opcional: un proveedor sin verificación no puede conectar.
  verifyProfile?(credentials: MailCredentials): Promise<{ email: string; credentials: MailCredentials }>;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function toTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(SEND_TIMEOUT_MS);
}

function mapFetchError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return new ProviderError('timeout', 'El proveedor tardó demasiado en responder');
  }
  return new ProviderError('provider_error', err instanceof Error ? err.message : String(err));
}

// Adaptador real de Gmail (API REST, sin dependencias nuevas: fetch de
// Node 24). Alcance mínimo: solo gmail.send. El remitente es la cuenta
// conectada ("me"): nunca se suplanta otra dirección.
export class GmailMailProvider implements MailProvider {
  constructor(
    private oauth?: { clientId: string; clientSecret: string; redirectUri: string },
  ) {}

  private async refresh(credentials: MailCredentials): Promise<MailCredentials> {
    if (!this.oauth || !credentials.refresh_token) {
      throw new ProviderError('connection_error', 'El token de Gmail venció y no se puede renovar');
    }
    let res: Response;
    try {
      res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.oauth.clientId,
          client_secret: this.oauth.clientSecret,
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        }),
        signal: toTimeoutSignal(),
      });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (!res.ok) {
      throw new ProviderError('connection_error', `La renovación del token de Gmail falló (${res.status})`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new ProviderError('connection_error', 'La renovación del token de Gmail no devolvió un token');
    }
    return {
      access_token: data.access_token,
      refresh_token: credentials.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  }

  async send(input: {
    to: string;
    subject: string;
    body: string;
    credentials: MailCredentials;
  }): Promise<MailSendResult> {
    let credentials = input.credentials;
    let refreshed: MailCredentials | undefined;
    if (credentials.expires_at && Date.now() >= credentials.expires_at - 60_000) {
      credentials = await this.refresh(credentials);
      refreshed = credentials;
    }
    const raw = base64url(
      `From: me\r\nTo: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${input.body}`,
    );
    let res: Response;
    try {
      res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
        signal: toTimeoutSignal(),
      });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('connection_error', `Gmail rechazó la credencial (${res.status})`);
    }
    if (!res.ok) {
      throw new ProviderError('provider_error', `Gmail respondió ${res.status}`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      throw new ProviderError('provider_error', 'Gmail no devolvió un identificador de mensaje');
    }
    return { providerMessageId: data.id, refreshedCredentials: refreshed };
  }

  async verifyProfile(credentials: MailCredentials): Promise<{ email: string; credentials: MailCredentials }> {
    let creds = credentials;
    let refreshed: MailCredentials | undefined;
    if (creds.expires_at && Date.now() >= creds.expires_at - 60_000) {
      creds = await this.refresh(creds);
      refreshed = creds;
    }
    let res: Response;
    try {
      res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${creds.access_token}` },
        signal: toTimeoutSignal(),
      });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('connection_error', `Gmail rechazó la credencial (${res.status})`);
    }
    if (!res.ok) {
      throw new ProviderError('provider_error', `Gmail respondió ${res.status}`);
    }
    const data = (await res.json()) as { emailAddress?: string };
    if (!data.emailAddress) {
      throw new ProviderError('provider_error', 'Gmail no devolvió la cuenta del perfil');
    }
    return { email: data.emailAddress, credentials: refreshed ?? creds };
  }
}

// ---------- WhatsApp Business (F2) ----------
//
// Adaptador real de la Cloud API de Meta (Graph API, sin
// dependencias nuevas: fetch de Node 24). El remitente es un número
// de WhatsApp Business de la organización; el token es de sistema
// por cuenta y vive cifrado en org_connections (nunca en variables
// globales: las variables son globales, las credenciales son por
// org). Solo se envía texto libre: fuera de la ventana de 24 horas
// Meta lo rechaza con el error 131047 y eso se mapea a
// 'window_closed' (las plantillas aprobadas son fase posterior, no
// se diseñan acá). La versión de la Graph API es una constante para
// poder subirla sin tocar cada llamada.

export const WHATSAPP_GRAPH_API_VERSION = 'v26.0';

export interface WhatsAppCredentials {
  phone_number_id: string;
  token: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string;
}

export interface WhatsAppProvider {
  // Verificación real contra el proveedor (lectura del número en la
  // Graph API). Sin verificación no hay 'connected': fail-closed,
  // igual que el perfil de Gmail en F1.
  verify(credentials: WhatsAppCredentials): Promise<{ displayPhoneNumber: string }>;
  send(input: {
    to: string;
    phoneNumberId: string;
    body: string;
    credentials: WhatsAppCredentials;
  }): Promise<WhatsAppSendResult>;
}

// Error de Meta con su código numérico: 131047 es la ventana de 24 h
// cerrada; el resto se clasifica como error del proveedor (salvo
// 401/403, que son credencial rechazada).
function mapMetaError(status: number, data: unknown): ProviderError {
  const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
  if (status === 401 || status === 403) {
    return new ProviderError('connection_error', `Meta rechazó la credencial de WhatsApp (${status})`);
  }
  if (code === 131047) {
    return new ProviderError(
      'window_closed',
      'La ventana de 24 horas de WhatsApp está cerrada: fuera de ella solo se aceptan plantillas aprobadas',
    );
  }
  return new ProviderError('provider_error', `Meta respondió ${status}`);
}

export class WhatsAppCloudProvider implements WhatsAppProvider {
  private base(phoneNumberId: string): string {
    return `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}`;
  }

  async verify(credentials: WhatsAppCredentials): Promise<{ displayPhoneNumber: string }> {
    let res: Response;
    try {
      res = await fetch(`${this.base(credentials.phone_number_id)}?fields=display_phone_number`, {
        headers: { Authorization: `Bearer ${credentials.token}` },
        signal: toTimeoutSignal(),
      });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (!res.ok) {
      throw mapMetaError(res.status, await res.json().catch(() => null));
    }
    const data = (await res.json()) as { display_phone_number?: string };
    if (!data.display_phone_number) {
      throw new ProviderError('provider_error', 'Meta no devolvió el número verificado');
    }
    return { displayPhoneNumber: data.display_phone_number };
  }

  async send(input: {
    to: string;
    phoneNumberId: string;
    body: string;
    credentials: WhatsAppCredentials;
  }): Promise<WhatsAppSendResult> {
    let res: Response;
    try {
      res = await fetch(`${this.base(input.phoneNumberId)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to,
          type: 'text',
          text: { preview_url: false, body: input.body },
        }),
        signal: toTimeoutSignal(),
      });
    } catch (err) {
      throw mapFetchError(err);
    }
    if (!res.ok) {
      throw mapMetaError(res.status, await res.json().catch(() => null));
    }
    const data = (await res.json()) as { messages?: Array<{ id?: string }> };
    const id = data.messages?.[0]?.id;
    if (!id) {
      throw new ProviderError('provider_error', 'Meta no devolvió un identificador de mensaje');
    }
    return { providerMessageId: id };
  }
}

// ---------- Cifrado de credenciales en reposo (AES-256-GCM) ----------
//
// La clave global la gestiona el operador (variable de entorno,
// sync:false en render.yaml, nunca en el repo). Se deriva a 32 bytes
// con SHA-256 de la frase que el operador cargue, así no exige un
// formato exacto. Sin clave, todo el módulo queda cerrado
// (fail-closed): no se descifra ni se envía nada.
function deriveKey(passphrase: string): Buffer {
  return createHash('sha256').update(passphrase, 'utf8').digest();
}

export function encryptCredentials(plaintext: string, passphrase: string | undefined): string {
  if (!passphrase) throw new ConnectionKeyMissingError();
  const key = deriveKey(passphrase);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${data.toString('hex')}`;
}

export function decryptCredentials(ciphertext: string, passphrase: string | undefined): string {
  if (!passphrase) throw new ConnectionKeyMissingError();
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new ProviderError('connection_error', 'La credencial guardada tiene un formato desconocido');
  }
  const key = deriveKey(passphrase);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'hex'));
  decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'hex')), decipher.final()]).toString('utf8');
  } catch {
    throw new ProviderError('connection_error', 'No se pudo descifrar la credencial (clave incorrecta o corrupta)');
  }
}

// ---------- OAuth de Google: state anti-CSRF sin estado en servidor ----------
//
// El state va firmado con HMAC (JWT_SECRET) y ata org, correo del admin
// y vencimiento (10 minutos). El callback lo verifica sin guardar nada:
// un state robado no sirve para otra org ni vencido.
export function signOAuthState(secret: string, orgId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ orgId, email, exp: Date.now() + 600_000 }), 'utf8').toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOAuthState(
  secret: string,
  state: string,
): { orgId: string; email: string } | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      orgId?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.orgId !== 'string' || typeof parsed.email !== 'string') return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    return { orgId: parsed.orgId, email: parsed.email };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(oauth: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent',
    state: oauth.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
