import { Pool } from 'pg';

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // En prod pegamos al endpoint pooled de Neon (PgBouncer), que ya multiplexa
  // conexiones. Cada instancia serverless (Fluid Compute) abre su propio pool,
  // asi que un `max` bajo evita agotar el limite de conexiones de Neon cuando
  // escalan muchas instancias. 10 cubre la concurrencia intra-request
  // (p.ej. Promise.all de ~5 queries) con holgura. Ajustable si hace falta.
  max: isProduction ? 10 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Explicit SSL config avoids pg warning about sslmode string interpretation
  // and handles Vercel cold-start handshake time reliably
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Un error en un cliente idle NO debe tumbar el proceso: en serverless eso
// mataria una instancia que puede estar sirviendo otros requests (Fluid Compute
// reusa instancias entre requests). El pool descarta el cliente roto y sigue.
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export { pool };

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }
  return result;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}
