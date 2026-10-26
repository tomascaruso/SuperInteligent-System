// Siembra la demo con datos ficticios (la agencia de Martín).
// Uso: npm run seed
// Idempotente: si la organización demo ya existe, no vuelve a sembrar.
import { exec, newId, nowIso, openDatabase, queryOne } from './db.js';
import { generateWebhookSecret, hashPassword } from './auth.js';
import { runIntake } from './engine.js';

// Con DATABASE_URL usa Postgres; sin ella, SQLite local (DATABASE_PATH).
const db = await openDatabase({
  databaseUrl: process.env.DATABASE_URL,
  databasePath: process.env.DATABASE_PATH ?? './data/superinteligent.db',
});

const existing = await queryOne<{ id: string }>(
  db,
  'SELECT id FROM organizations WHERE name = ?',
  'Agencia Martín (demo)',
);
if (existing) {
  console.log('La demo ya existe, no se vuelve a sembrar.');
  process.exit(0);
}

const orgId = newId();
const secret = generateWebhookSecret();
await exec(
  db,
  'INSERT INTO organizations (id, name, webhook_secret, created_at) VALUES (?, ?, ?, ?)',
  orgId,
  'Agencia Martín (demo)',
  secret,
  nowIso(),
);
await exec(
  db,
  'INSERT INTO users (id, org_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  newId(),
  orgId,
  'Martín Demo',
  'demo@agenciamartin.demo',
  hashPassword('Demo1234!'),
  'admin',
  nowIso(),
);

const samples = [
  {
    contactName: 'Lucía Fernández',
    contactEmail: 'lucia@empresaejemplo.com',
    company: 'Empresa Ejemplo',
    message:
      'Necesitamos automatizar nuestro seguimiento comercial urgente, esta semana. Tenemos presupuesto aprobado y queremos un sistema con agentes.',
    source: 'webhook',
  },
  {
    contactName: 'Pedro Gómez',
    contactEmail: 'pedro@negocio.com',
    company: 'Negocio SRL',
    message: 'Buscamos apoyo en marketing para nuestras redes y contenido.',
    source: 'manual',
  },
  {
    contactName: 'Ana Ruiz',
    contactEmail: 'ana@gmail.com',
    company: '',
    message: 'Me interesa saber más sobre sus servicios.',
    source: 'manual',
  },
];

for (const s of samples) {
  const r = await runIntake(db, orgId, s, { actor: 'seed', maxOpportunitiesPerDay: 100 });
  console.log(
    `- ${s.contactName}: ${r.opportunity.category} / ${r.opportunity.priority} (tarea: ${r.task?.title})`,
  );
}

console.log('\nOrganización: Agencia Martín (demo)');
console.log('Admin demo: demo@agenciamartin.demo / Demo1234!');
console.log(`Webhook secret (demo): ${secret}`);
console.log(`Webhook: POST /api/ingest/${orgId} con header x-signature = sha256=HMAC(secret, cuerpo)`);
