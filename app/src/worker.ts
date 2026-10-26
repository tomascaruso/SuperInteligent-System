// Worker asíncrono (C7): procesa jobs de ingesta encolados y reconcilia
// huérfanos de caídas. No atiende HTTP ni necesita JWT: solo abre la base
// y corre el pipeline. Uso: `npm run worker` (bucle) o con `--once` (una
// pasada y salir, útil para pruebas y smoke). El despliegue como servicio
// separado en Render queda pendiente de decisión (plan gratis); el alta
// manual y el webhook siguen sincrónicos, así que la demo funciona con o
// sin worker en marcha.
import { openDatabase } from './db.js';
import { processPendingJobs, reconcileOrphans } from './engine.js';

function requiredInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`La variable ${name} debe ser un número entero, recibí: ${raw}`);
  }
  return n;
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  const intervalMs = requiredInt('WORKER_INTERVAL_MS', 5000);
  const db = await openDatabase({
    databaseUrl: process.env.DATABASE_URL || undefined,
    databasePath: process.env.DATABASE_PATH ?? './data/superinteligent.db',
  });
  const maxOpportunitiesPerDay = requiredInt('MAX_OPPORTUNITIES_PER_DAY', 100);

  const tick = async (): Promise<void> => {
    const reconciled = await reconcileOrphans(db);
    const result = await processPendingJobs(db, {
      actor: 'worker',
      maxOpportunitiesPerDay,
    });
    if (reconciled.executionsFailed > 0 || reconciled.runsSynced > 0 || result.processed > 0) {
      console.log(
        `worker: reconciliados ${reconciled.executionsFailed} ejecuciones y ${reconciled.runsSynced} corridas; ` +
          `procesados ${result.processed} jobs (${result.done} ok, ${result.failed} fallidos)`,
      );
    }
  };

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`worker: cerrando (${signal})`);
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    if (once) {
      await tick();
      await db.close();
      return;
    }
    await tick();
    setInterval(() => void tick().catch((err: unknown) => console.error('worker: error en pasada', err)), intervalMs);
  } catch (err) {
    await db.close();
    throw err;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
