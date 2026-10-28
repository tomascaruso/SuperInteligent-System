import Fastify, { type FastifyInstance } from 'fastify';
import type { ContactConfig } from './contact.js';
import { openDatabase, type Db } from './db.js';
import { reconcileOrphans } from './engine.js';
import { registerRoutes } from './routes.js';
import type { MailProvider, WhatsAppProvider } from './sending.js';

export const SERVICE_VERSION = '0.1.0';

export interface ServerOptions {
  databaseUrl?: string;
  dbPath: string;
  jwtSecret: string;
  maxOpportunitiesPerDay: number;
  operatorToken?: string;
  contact?: ContactConfig;
  // F1: proveedor de correo inyectable (tests) y clave de cifrado de
  // conexiones. Sin mailProvider explícito se usa el adaptador real
  // de Gmail (que solo actúa con credenciales de operador).
  mailProvider?: MailProvider;
  // F2: proveedor de WhatsApp inyectable (tests). Sin él se usa el
  // adaptador real de la Cloud API de Meta.
  whatsappProvider?: WhatsAppProvider;
  connectionEncryptionKey?: string;
  googleOAuth?: { clientId: string; clientSecret: string; redirectUri: string };
}

export interface BuiltServer {
  app: FastifyInstance;
  db: Db;
}

export async function buildServer(opts: ServerOptions): Promise<BuiltServer> {
  const db = await openDatabase({ databaseUrl: opts.databaseUrl, databasePath: opts.dbPath });
  // C7: reconciliar huérfanos de caídas en cada arranque (en bases frescas
  // no toca nada). El worker hace lo mismo en cada pasada.
  await reconcileOrphans(db);
  const app = Fastify({ logger: true });
  // C7: cabeceras de seguridad en todas las respuestas. La app solo sirve
  // recursos del mismo origen (sin scripts, estilos ni imágenes externas,
  // sin inline), así que default-src 'self' no rompe nada.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Content-Security-Policy', "default-src 'self'");
    return payload;
  });
  app.addHook('onClose', async () => {
    await db.close();
  });
  registerRoutes(app, db, {
    jwtSecret: opts.jwtSecret,
    maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
    operatorToken: opts.operatorToken,
    contact: opts.contact,
    mailProvider: opts.mailProvider,
    whatsappProvider: opts.whatsappProvider,
    connectionEncryptionKey: opts.connectionEncryptionKey,
    googleOAuth: opts.googleOAuth,
  });
  return { app, db };
}
