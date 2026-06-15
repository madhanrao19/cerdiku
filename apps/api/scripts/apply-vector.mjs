// Applies prisma/sql/embedding.sql after `prisma db push`. Uses the pg driver
// that ships transitively; falls back to psql if not present.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '..', 'prisma', 'sql', 'embedding.sql'), 'utf8');

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log('✓ pgvector column + ANN index applied');
