import Fastify, { type FastifyInstance } from 'fastify';
import { openDatabase, type Db } from './db.js';
import { registerRoutes } from './routes.js';

export const SERVICE_VERSION = '0.1.0';

export interface ServerOptions {
  databaseUrl?: string;
  dbPath: string;
  jwtSecret: string;
  maxOpportunitiesPerDay: number;
}

export interface BuiltServer {
  app: FastifyInstance;
  db: Db;
}

export async function buildServer(opts: ServerOptions): Promise<BuiltServer> {
  const db = await openDatabase({ databaseUrl: opts.databaseUrl, databasePath: opts.dbPath });
  const app = Fastify({ logger: true });
  app.addHook('onClose', async () => {
    await db.close();
  });
  registerRoutes(app, db, {
    jwtSecret: opts.jwtSecret,
    maxOpportunitiesPerDay: opts.maxOpportunitiesPerDay,
  });
  return { app, db };
}
