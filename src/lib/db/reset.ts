/**
 * PELIGROSO: Limpia TODOS los datos y re-ejecuta el seed.
 * Solo para desarrollo.
 *
 * Ejecutar: npm run db:reset
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0 && !process.env[t.substring(0, i)]) process.env[t.substring(0, i)] = t.substring(i + 1); }
  }
} catch { /* */ }

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
import { execSync } from 'child_process';

async function reset() {
  console.log('🔴 RESETEANDO BASE DE DATOS...\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tables = [
      'contrato_versiones',
      'contratos',
      'plantillas_contrato',
      'documentos_onboarding',
      'onboarding',
      'portal_tokens',
      'documentos_candidato',
      'entrevistas_humanas',
      'entrevistas_ia',
      'activity_log',
      'aplicaciones',
      'candidatos',
      'vacantes',
      'org_settings',
      'users',
      'organizations',
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`  🗑️ ${table} — ${result.rowCount} rows eliminadas`);
      } catch (e: any) {
        console.log(`  ⚠️ ${table} — ${e.message}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Base de datos limpia.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  // Ejecutar seed
  console.log('🌱 Ejecutando seed...\n');
  execSync('npx tsx src/lib/db/seed.ts', { stdio: 'inherit' });
}

reset().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
