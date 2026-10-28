import type { ContactConfig } from './contact.js';

export interface AppConfig {
  host: string;
  port: number;
  databaseUrl?: string;
  databasePath: string;
  jwtSecret: string;
  jwtSecretIsDefault: boolean;
  maxOpportunitiesPerDay: number;
  // C8: secreto del operador de PENSIA (crea invitaciones). Opcional: sin
  // él, la creación de invitaciones está cerrada.
  operatorToken?: string;
  // F3-DEMO: envío del formulario de contacto por relay HTTPS (Apps
  // Script). Opcional: sin relay completo, el contacto está cerrado y
  // el formulario no se muestra. La URL y el token viven solo acá
  // (variables de entorno), nunca en el código, la página ni el repo.
  contact?: ContactConfig;
  // F1: clave de cifrado de credenciales de conexión (operador).
  // Opcional: sin ella, el módulo de envío queda cerrado (fail-closed).
  connectionEncryptionKey?: string;
  // F1: credenciales OAuth de Google del operador (cliente de la app).
  // Opcionales: sin ellas, el inicio de OAuth responde 503.
  googleOAuth?: { clientId: string; clientSecret: string; redirectUri: string };
}

function requiredInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`La variable ${name} debe ser un número entero, recibí: ${raw}`);
  }
  return n;
}

// C7: en producción, arrancar sin secreto real es un error, no una
// advertencia (antes solo se avisaba por consola y se seguía con el secreto
// de desarrollo, que cualquiera conoce). Testeable sin levantar el server.
export function assertProductionSecret(config: AppConfig, nodeEnv: string | undefined): void {
  if (nodeEnv === 'production' && config.jwtSecretIsDefault) {
    throw new Error('JWT_SECRET es obligatorio en producción: definilo antes de arrancar el servidor.');
  }
}

// Secretos: nunca se imprimen en logs ni se commitean. Los valores por
// defecto son SOLO para desarrollo local y deben reemplazarse en cualquier
// entorno compartido (ver SECURITY.md y OPERATIONS.md).
export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET;
  // F3-DEMO: el contacto solo queda configurado si están las 2 piezas
  // del relay (URL y token). Si falta alguna, el formulario no se
  // muestra y el endpoint responde 503: nunca se acepta un mensaje que
  // no se puede enviar.
  const relayUrl = process.env.CONTACT_RELAY_URL || '';
  const relayToken = process.env.CONTACT_RELAY_TOKEN || '';
  const contact: ContactConfig | undefined =
    relayUrl !== '' && relayToken !== '' ? { relayUrl, relayToken } : undefined;
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const googleRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
  const googleOAuth =
    googleClientId !== '' && googleClientSecret !== '' && googleRedirectUri !== ''
      ? { clientId: googleClientId, clientSecret: googleClientSecret, redirectUri: googleRedirectUri }
      : undefined;
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: requiredInt('PORT', 3000),
    // Si está definida, Postgres (p. ej. Neon en Render); si no, SQLite.
    databaseUrl: process.env.DATABASE_URL || undefined,
    databasePath: process.env.DATABASE_PATH ?? './data/superinteligent.db',
    jwtSecret: jwtSecret ?? 'dev-jwt-secret',
    jwtSecretIsDefault: jwtSecret === undefined || jwtSecret === '',
    maxOpportunitiesPerDay: requiredInt('MAX_OPPORTUNITIES_PER_DAY', 100),
    operatorToken: process.env.OPERATOR_TOKEN || undefined,
    contact,
    connectionEncryptionKey: process.env.CONNECTION_ENCRYPTION_KEY || undefined,
    googleOAuth,
  };
}
