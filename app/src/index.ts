import { buildServer } from './server.js';
import { assertProductionSecret, loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  // C7: en producción, sin secreto real no se arranca.
  assertProductionSecret(config, process.env.NODE_ENV);
  if (config.jwtSecretIsDefault) {
    console.warn(
      'ADVERTENCIA: usando JWT_SECRET de desarrollo. Definí JWT_SECRET antes de exponer este servidor.',
    );
  }
  const { app } = await buildServer({
    databaseUrl: config.databaseUrl,
    dbPath: config.databasePath,
    jwtSecret: config.jwtSecret,
    maxOpportunitiesPerDay: config.maxOpportunitiesPerDay,
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Cerrando servidor');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
