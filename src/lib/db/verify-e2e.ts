/**
 * Script de verificación end-to-end.
 * Ejecuta queries contra la BD y llamadas HTTP a las APIs.
 *
 * Ejecutar: npx tsx src/lib/db/verify-e2e.ts
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

interface TestResult {
  modulo: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: TestResult[] = [];
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3500';

function log(result: TestResult) {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${result.modulo}] ${result.test}: ${result.message}`);
  results.push(result);
}

async function verify() {
  console.log('\n🧪 VERIFICACIÓN INTEGRAL DE HIRELY\n');
  console.log('═'.repeat(60));

  // ══════════════════════════════════════════
  // MÓDULO 1: VACANTES
  // ══════════════════════════════════════════
  console.log('\n📦 MÓDULO 1: Vacantes\n');

  const vacantes = await pool.query('SELECT * FROM vacantes');
  log({
    modulo: 'Vacantes', test: 'Vacantes existen',
    status: vacantes.rows.length >= 3 ? 'PASS' : 'FAIL',
    message: `${vacantes.rows.length} vacantes encontradas`,
  });

  const publicadas = await pool.query(
    "SELECT * FROM vacantes WHERE is_published = true AND slug IS NOT NULL"
  );
  log({
    modulo: 'Vacantes', test: 'Vacantes publicadas con slug',
    status: publicadas.rows.length > 0 ? 'PASS' : 'FAIL',
    message: `${publicadas.rows.length} vacantes publicadas con slug`,
  });

  const conCriterios = await pool.query(
    "SELECT * FROM vacantes WHERE criterios_evaluacion IS NOT NULL AND criterios_evaluacion::text != '{}' AND criterios_evaluacion::text != 'null'"
  );
  log({
    modulo: 'Vacantes', test: 'Criterios de evaluación configurados',
    status: conCriterios.rows.length > 0 ? 'PASS' : 'WARN',
    message: `${conCriterios.rows.length} vacantes con criterios`,
  });

  // ══════════════════════════════════════════
  // PORTAL PÚBLICO
  // ══════════════════════════════════════════
  console.log('\n🌐 PORTAL PÚBLICO\n');

  for (const v of publicadas.rows.slice(0, 5)) {
    try {
      const resp = await fetch(`${BASE_URL}/empleo/${v.slug}`);
      log({
        modulo: 'Portal', test: `Página /empleo/${v.slug}`,
        status: resp.ok ? 'PASS' : 'FAIL',
        message: `HTTP ${resp.status}`,
      });
    } catch (error: any) {
      log({
        modulo: 'Portal', test: `Página /empleo/${v.slug}`,
        status: 'WARN', message: `Servidor no disponible: ${error.message}`,
      });
    }
  }

  // Listado público
  try {
    const resp = await fetch(`${BASE_URL}/empleo`);
    log({
      modulo: 'Portal', test: 'Listado /empleo',
      status: resp.ok ? 'PASS' : 'FAIL',
      message: `HTTP ${resp.status}`,
    });
  } catch {
    log({ modulo: 'Portal', test: 'Listado /empleo', status: 'WARN', message: 'Servidor no disponible' });
  }

  // ══════════════════════════════════════════
  // MÓDULO 2: CANDIDATOS + PIPELINE
  // ══════════════════════════════════════════
  console.log('\n🧑‍💼 MÓDULO 2: Candidatos\n');

  const candidatos = await pool.query('SELECT * FROM candidatos');
  log({
    modulo: 'Candidatos', test: 'Candidatos existen',
    status: candidatos.rows.length >= 8 ? 'PASS' : 'FAIL',
    message: `${candidatos.rows.length} candidatos`,
  });

  const conCvParsed = await pool.query(
    "SELECT * FROM candidatos WHERE cv_parsed IS NOT NULL AND cv_parsed::text != '{}' AND cv_parsed->>'parsed_at' IS NOT NULL"
  );
  log({
    modulo: 'Candidatos', test: 'CVs parseados',
    status: conCvParsed.rows.length >= 5 ? 'PASS' : 'WARN',
    message: `${conCvParsed.rows.length} candidatos con CV parseado`,
  });

  const aplicaciones = await pool.query('SELECT estado, COUNT(*) as cnt FROM aplicaciones GROUP BY estado');
  const estadosMap = Object.fromEntries(aplicaciones.rows.map((r: any) => [r.estado, parseInt(r.cnt)]));
  log({
    modulo: 'Pipeline', test: 'Distribución de estados',
    status: Object.keys(estadosMap).length >= 4 ? 'PASS' : 'WARN',
    message: JSON.stringify(estadosMap),
  });

  // ══════════════════════════════════════════
  // MÓDULO 3: SCORING ATS
  // ══════════════════════════════════════════
  console.log('\n📊 MÓDULO 3: Scoring ATS\n');

  const conScore = await pool.query('SELECT * FROM aplicaciones WHERE score_ats IS NOT NULL');
  log({
    modulo: 'Scoring', test: 'Aplicaciones con score ATS',
    status: conScore.rows.length >= 6 ? 'PASS' : 'WARN',
    message: `${conScore.rows.length} aplicaciones scoreadas`,
  });

  const scoresInvalidos = await pool.query(
    'SELECT * FROM aplicaciones WHERE score_ats < 0 OR score_ats > 100'
  );
  log({
    modulo: 'Scoring', test: 'Scores en rango 0-100',
    status: scoresInvalidos.rows.length === 0 ? 'PASS' : 'FAIL',
    message: `${scoresInvalidos.rows.length} scores fuera de rango`,
  });

  // ══════════════════════════════════════════
  // MÓDULO 4: ENTREVISTA IA
  // ══════════════════════════════════════════
  console.log('\n🤖 MÓDULO 4: Entrevista IA\n');

  const entrevistasIa = await pool.query('SELECT * FROM entrevistas_ia');
  log({
    modulo: 'Entrevista IA', test: 'Tabla entrevistas_ia existe',
    status: 'PASS', message: `${entrevistasIa.rows.length} registros`,
  });

  try {
    const resp = await fetch(`${BASE_URL}/api/webhooks/dapta`, { method: 'GET' });
    log({
      modulo: 'Entrevista IA', test: 'Webhook Dapta endpoint',
      status: [200, 405].includes(resp.status) ? 'PASS' : 'WARN',
      message: `HTTP ${resp.status}`,
    });
  } catch {
    log({ modulo: 'Entrevista IA', test: 'Webhook endpoint', status: 'WARN', message: 'Servidor no disponible' });
  }

  // ══════════════════════════════════════════
  // MÓDULO 5+6: ENTREVISTA HUMANA + SCORING DUAL
  // ══════════════════════════════════════════
  console.log('\n👤 MÓDULO 5-6: Entrevista Humana + Scoring Dual\n');

  const entrevistasH = await pool.query('SELECT * FROM entrevistas_humanas');
  log({
    modulo: 'Entrevista Humana', test: 'Tabla entrevistas_humanas existe',
    status: 'PASS', message: `${entrevistasH.rows.length} registros`,
  });

  const conDualScore = await pool.query(
    'SELECT * FROM aplicaciones WHERE score_ia IS NOT NULL AND score_humano IS NOT NULL AND score_final IS NOT NULL'
  );
  log({
    modulo: 'Scoring Dual', test: 'Candidatos con score dual completo',
    status: conDualScore.rows.length >= 1 ? 'PASS' : 'WARN',
    message: `${conDualScore.rows.length} candidatos con score dual`,
  });

  // ══════════════════════════════════════════
  // MÓDULO 7: SELECCIÓN + DOCUMENTOS
  // ══════════════════════════════════════════
  console.log('\n📄 MÓDULO 7: Selección + Documentos\n');

  const seleccionados = await pool.query("SELECT * FROM aplicaciones WHERE estado = 'seleccionado'");
  log({
    modulo: 'Selección', test: 'Candidatos seleccionados',
    status: seleccionados.rows.length >= 1 ? 'PASS' : 'WARN',
    message: `${seleccionados.rows.length} seleccionados`,
  });

  const portalTokens = await pool.query('SELECT * FROM portal_tokens');
  log({ modulo: 'Documentos', test: 'Tabla portal_tokens', status: 'PASS', message: `${portalTokens.rows.length} tokens` });

  const documentos = await pool.query('SELECT * FROM documentos_candidato');
  log({ modulo: 'Documentos', test: 'Documentos de candidatos', status: 'PASS', message: `${documentos.rows.length} registros` });

  // ══════════════════════════════════════════
  // MÓDULO 8: ONBOARDING
  // ══════════════════════════════════════════
  console.log('\n🎉 MÓDULO 8: Onboarding\n');

  const onboarding = await pool.query('SELECT * FROM onboarding');
  log({ modulo: 'Onboarding', test: 'Tabla onboarding', status: 'PASS', message: `${onboarding.rows.length} registros` });

  // ══════════════════════════════════════════
  // MÓDULO 9: CONTRATOS
  // ══════════════════════════════════════════
  console.log('\n📝 MÓDULO 9: Contratos\n');

  const contratos = await pool.query('SELECT * FROM contratos');
  log({ modulo: 'Contratos', test: 'Tabla contratos', status: 'PASS', message: `${contratos.rows.length} registros` });

  const plantillas = await pool.query('SELECT * FROM plantillas_contrato');
  log({
    modulo: 'Contratos', test: 'Plantillas de contrato',
    status: plantillas.rows.length >= 1 ? 'PASS' : 'WARN',
    message: `${plantillas.rows.length} plantillas`,
  });

  // ══════════════════════════════════════════
  // BD: INTEGRIDAD GENERAL
  // ══════════════════════════════════════════
  console.log('\n🗄️ INTEGRIDAD DE BD\n');

  const huerfanas = await pool.query(`
    SELECT a.id FROM aplicaciones a
    LEFT JOIN vacantes v ON v.id = a.vacante_id
    LEFT JOIN candidatos c ON c.id = a.candidato_id
    WHERE v.id IS NULL OR c.id IS NULL
  `);
  log({
    modulo: 'BD', test: 'Sin aplicaciones huérfanas',
    status: huerfanas.rows.length === 0 ? 'PASS' : 'FAIL',
    message: `${huerfanas.rows.length} aplicaciones sin vacante o candidato`,
  });

  const tablas = [
    'organizations', 'users', 'vacantes', 'candidatos', 'aplicaciones',
    'entrevistas_ia', 'entrevistas_humanas', 'documentos_candidato',
    'portal_tokens', 'onboarding', 'documentos_onboarding',
    'contratos', 'contrato_versiones', 'plantillas_contrato',
    'org_settings', 'activity_log',
  ];

  for (const tabla of tablas) {
    try {
      await pool.query(`SELECT 1 FROM ${tabla} LIMIT 1`);
      log({ modulo: 'BD', test: `Tabla ${tabla}`, status: 'PASS', message: 'Existe' });
    } catch {
      log({ modulo: 'BD', test: `Tabla ${tabla}`, status: 'FAIL', message: 'NO EXISTE' });
    }
  }

  // ══════════════════════════════════════════
  // REPORTE FINAL
  // ══════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('📊 REPORTE FINAL\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`  ✅ PASS: ${passed}`);
  console.log(`  ❌ FAIL: ${failed}`);
  console.log(`  ⚠️  WARN: ${warned}`);
  console.log(`  📋 TOTAL: ${results.length}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ FALLOS DETECTADOS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - [${r.modulo}] ${r.test}: ${r.message}`);
    });
  }

  if (warned > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  - [${r.modulo}] ${r.test}: ${r.message}`);
    });
  }

  console.log('\n' + '═'.repeat(60));
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
