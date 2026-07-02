/**
 * Backfill: re-evalua el corte ATS de aplicaciones existentes contra el
 * umbral EFECTIVO (vacante.score_minimo > org.umbral_preseleccion > 70).
 *
 * Contexto: antes el corte se resolvia con un 70 hardcodeado, ignorando el
 * "Umbral de preseleccion ATS" configurado por el admin. Este script corrige
 * el estado de las aplicaciones que fueron decididas automaticamente con el
 * umbral viejo, SIN re-ejecutar la IA (los score_ats ya guardados no cambian).
 *
 * Alcance (decidido con el usuario): SOLO aplicaciones en estados decididos
 * automaticamente por el pipeline de scoring:  nuevo | en_revision | descartado.
 * NO toca candidatos que un humano ya avanzo (preseleccionado, entrevista, etc.).
 *
 * Efecto:
 *   - score_ats >= umbral  y estado='descartado'            -> en_revision (revive)
 *   - score_ats <  umbral  y estado IN ('nuevo','en_revision') -> descartado
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 * Uso:
 *   npx tsx scripts/backfill-umbral-ats.ts            # DRY RUN (solo reporta, no escribe)
 *   npx tsx scripts/backfill-umbral-ats.ts --apply    # aplica los cambios
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar .env.local si existe (mismo patron que src/lib/db/reset.ts)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.substring(0, i)]) {
        process.env[t.substring(0, i)] = t.substring(i + 1);
      }
    }
  }
} catch {
  /* sin .env.local: se usan las env vars del entorno (prod) */
}

import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Subconsulta: aplicaciones auto-decididas con su umbral efectivo y si deberian pasar
const SELECT_TARGETS = `
  SELECT a.id,
         a.estado,
         a.score_ats,
         v.titulo AS vacante_titulo,
         COALESCE(v.score_minimo, os.umbral_preseleccion, 70) AS umbral,
         (a.score_ats >= COALESCE(v.score_minimo, os.umbral_preseleccion, 70)) AS pasa,
         CASE WHEN a.score_ats >= COALESCE(v.score_minimo, os.umbral_preseleccion, 70)
              THEN 'en_revision' ELSE 'descartado' END AS estado_objetivo
  FROM aplicaciones a
  JOIN vacantes v ON v.id = a.vacante_id
  LEFT JOIN org_settings os ON os.organization_id = v.organization_id
  WHERE a.score_ats IS NOT NULL
    AND a.estado IN ('nuevo', 'en_revision', 'descartado')
`;

async function main() {
  console.log(`\n=== Backfill umbral ATS ${APPLY ? '(APLICANDO CAMBIOS)' : '(DRY RUN — no escribe)'} ===\n`);

  const client = await pool.connect();
  try {
    // 1. Diagnostico: cuantas cambiarian y a que estado
    const targets = await client.query(
      `${SELECT_TARGETS} AND a.estado <> CASE WHEN a.score_ats >= COALESCE(v.score_minimo, os.umbral_preseleccion, 70)
                                              THEN 'en_revision' ELSE 'descartado' END
       ORDER BY vacante_titulo, a.score_ats DESC`
    );

    const revividos = targets.rows.filter((r) => r.estado_objetivo === 'en_revision');
    const descartados = targets.rows.filter((r) => r.estado_objetivo === 'descartado');

    console.log(`Aplicaciones a corregir: ${targets.rows.length}`);
    console.log(`  - descartado -> en_revision (ahora pasan): ${revividos.length}`);
    console.log(`  - nuevo/en_revision -> descartado (ya no pasan): ${descartados.length}\n`);

    if (targets.rows.length > 0) {
      console.log('Detalle (primeras 40):');
      for (const r of targets.rows.slice(0, 40)) {
        console.log(
          `  [${r.vacante_titulo}] score=${r.score_ats} umbral=${r.umbral}  ${r.estado} -> ${r.estado_objetivo}`
        );
      }
      if (targets.rows.length > 40) console.log(`  ...y ${targets.rows.length - 40} mas`);
    }

    if (!APPLY) {
      console.log('\nDRY RUN: no se escribio nada. Corre con --apply para aplicar.\n');
      return;
    }

    if (targets.rows.length === 0) {
      console.log('\nNada que aplicar. Todo consistente con el umbral efectivo.\n');
      return;
    }

    // 2. Aplicar dentro de una transaccion
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE aplicaciones a
       SET estado = t.estado_objetivo,
           motivo_descarte = CASE
             WHEN t.estado_objetivo = 'descartado'
               THEN 'Score ATS ' || t.score_ats || ' < umbral ' || t.umbral || ' (backfill umbral org)'
             ELSE NULL
           END,
           notas = CASE
             WHEN a.notas IS NULL OR a.notas = ''
               THEN 'Corte recalculado por umbral org (backfill): score ' || t.score_ats || ' vs umbral ' || t.umbral || ' -> ' || t.estado_objetivo
             ELSE a.notas || E'\n' || 'Corte recalculado por umbral org (backfill): score ' || t.score_ats || ' vs umbral ' || t.umbral || ' -> ' || t.estado_objetivo
           END,
           updated_at = NOW()
       FROM ( ${SELECT_TARGETS} ) t
       WHERE a.id = t.id
         AND a.estado <> t.estado_objetivo
       RETURNING a.id`
    );
    await client.query('COMMIT');

    console.log(`\n✅ Aplicado. Aplicaciones actualizadas: ${result.rowCount}\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\n❌ Error en backfill:', err);
    pool.end();
    process.exit(1);
  });
