/**
 * Verificacion completa de integraciones de Hirely.
 * Ejecutar: npx tsx src/lib/tests/verify-integrations.ts
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

interface CheckResult {
  module: string;
  check: string;
  status: 'OK' | 'FAIL' | 'WARN';
  detail: string;
}

const results: CheckResult[] = [];
function log(r: CheckResult) {
  const icon = r.status === 'OK' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} [${r.module}] ${r.check}: ${r.detail}`);
  results.push(r);
}

async function verify() {
  console.log('\n🔌 VERIFICACION DE INTEGRACIONES HIRELY\n');
  console.log('═'.repeat(60));

  // ══════════════════════════════════════════
  // 1. CLAUDE API
  // ══════════════════════════════════════════
  console.log('\n🧠 CLAUDE API\n');

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  log({
    module: 'Claude', check: 'ANTHROPIC_API_KEY',
    status: anthropicKey ? 'OK' : 'FAIL',
    detail: anthropicKey ? `Configurada (${anthropicKey.substring(0, 12)}...)` : 'NO configurada',
  });

  if (anthropicKey) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Di "OK"' }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text?.trim() || '';
        log({ module: 'Claude', check: 'Conexion API', status: 'OK', detail: `Respuesta: "${text}"` });
      } else {
        const error = await resp.text();
        log({ module: 'Claude', check: 'Conexion API', status: 'FAIL', detail: `HTTP ${resp.status}: ${error.substring(0, 100)}` });
      }
    } catch (e: any) {
      log({ module: 'Claude', check: 'Conexion API', status: 'FAIL', detail: e.message });
    }
  }

  // ══════════════════════════════════════════
  // 2. DAPTA
  // ══════════════════════════════════════════
  console.log('\n📞 DAPTA\n');

  const daptaUrl = process.env.DAPTA_FLOW_WEBHOOK_URL || process.env.DAPTA_API_URL;
  const daptaKey = process.env.DAPTA_API_KEY;
  const daptaFrom = process.env.DAPTA_FROM_NUMBER;

  log({
    module: 'Dapta', check: 'DAPTA_FLOW_WEBHOOK_URL',
    status: daptaUrl ? 'OK' : 'FAIL',
    detail: daptaUrl ? `${daptaUrl.substring(0, 50)}...` : 'NO configurada',
  });
  log({
    module: 'Dapta', check: 'DAPTA_API_KEY',
    status: daptaKey ? 'OK' : 'WARN',
    detail: daptaKey ? '***configurada***' : 'NO configurada',
  });
  log({
    module: 'Dapta', check: 'DAPTA_FROM_NUMBER',
    status: daptaFrom ? 'OK' : 'WARN',
    detail: daptaFrom || 'No configurado (usara default de Dapta)',
  });

  if (daptaUrl) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (daptaKey) headers['X-Api-Key'] = daptaKey;

      const resp = await fetch(daptaUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ test: true, to_number: '+0000000000' }),
      });
      log({
        module: 'Dapta', check: 'Conectividad',
        status: resp.ok || resp.status === 400 || resp.status === 422 ? 'OK' : 'WARN',
        detail: `HTTP ${resp.status}`,
      });
    } catch (e: any) {
      log({ module: 'Dapta', check: 'Conectividad', status: 'FAIL', detail: e.message });
    }
  }

  // ══════════════════════════════════════════
  // 3. BASE DE DATOS
  // ══════════════════════════════════════════
  console.log('\n🗄️ BASE DE DATOS\n');

  log({
    module: 'DB', check: 'DATABASE_URL',
    status: process.env.DATABASE_URL ? 'OK' : 'FAIL',
    detail: process.env.DATABASE_URL ? 'Configurada' : 'NO configurada',
  });

  try {
    const vacantes = await pool.query('SELECT COUNT(*) as n FROM vacantes');
    const candidatos = await pool.query('SELECT COUNT(*) as n FROM candidatos');
    const aplicaciones = await pool.query('SELECT COUNT(*) as n FROM aplicaciones');
    log({
      module: 'DB', check: 'Conexion y datos',
      status: 'OK',
      detail: `${vacantes.rows[0].n} vacantes, ${candidatos.rows[0].n} candidatos, ${aplicaciones.rows[0].n} aplicaciones`,
    });
  } catch (e: any) {
    log({ module: 'DB', check: 'Conexion', status: 'FAIL', detail: e.message });
  }

  // Verificar que hay vacantes publicadas para test de portal
  try {
    const publicadas = await pool.query("SELECT COUNT(*) as n FROM vacantes WHERE is_published = true AND slug IS NOT NULL AND estado = 'publicada'");
    log({
      module: 'DB', check: 'Vacantes publicadas con slug',
      status: parseInt(publicadas.rows[0].n) > 0 ? 'OK' : 'WARN',
      detail: `${publicadas.rows[0].n} vacantes publicadas`,
    });
  } catch (e: any) {
    log({ module: 'DB', check: 'Vacantes publicadas', status: 'FAIL', detail: e.message });
  }

  // ══════════════════════════════════════════
  // 4. WEBHOOK LOCAL
  // ══════════════════════════════════════════
  console.log('\n🔗 WEBHOOK LOCAL\n');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3500';
  const webhookUrl = `${baseUrl}/api/webhooks/dapta`;

  try {
    const resp = await fetch(webhookUrl, { method: 'GET' });
    log({
      module: 'Webhook', check: 'Dapta webhook endpoint',
      status: resp.status === 405 || resp.status === 200 ? 'OK' : 'WARN',
      detail: `${webhookUrl} → HTTP ${resp.status}${resp.status === 405 ? ' (405 = endpoint existe, solo acepta POST)' : ''}`,
    });
  } catch {
    log({ module: 'Webhook', check: 'Dapta webhook endpoint', status: 'WARN', detail: 'Servidor no disponible (inicie con npm run dev)' });
  }

  // ══════════════════════════════════════════
  // 5. SERVICIOS OPCIONALES
  // ══════════════════════════════════════════
  console.log('\n📧 OTROS SERVICIOS\n');

  log({
    module: 'Email', check: 'SENDGRID_API_KEY',
    status: process.env.SENDGRID_API_KEY ? 'OK' : 'WARN',
    detail: process.env.SENDGRID_API_KEY ? 'Configurada' : 'Dev mode (logs en console)',
  });

  log({
    module: 'LinkedIn', check: 'UNIPILE_API_KEY',
    status: process.env.UNIPILE_API_KEY ? 'OK' : 'WARN',
    detail: process.env.UNIPILE_API_KEY ? 'Configurada' : 'Sincronizacion LinkedIn deshabilitada',
  });

  // ══════════════════════════════════════════
  // REPORTE FINAL
  // ══════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('📊 REPORTE FINAL\n');

  const ok = results.filter(r => r.status === 'OK').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;

  console.log(`  ✅ OK:   ${ok}`);
  console.log(`  ❌ FAIL: ${fail}`);
  console.log(`  ⚠️  WARN: ${warn}`);
  console.log(`  📋 TOTAL: ${results.length}`);

  if (fail > 0) {
    console.log('\n❌ ACCIONES REQUERIDAS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - [${r.module}] ${r.check}: ${r.detail}`);
    });
  }

  if (warn > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  - [${r.module}] ${r.check}: ${r.detail}`);
    });
  }

  // Summary
  console.log('\n');
  if (fail === 0) {
    console.log('✅ Todas las integraciones criticas estan conectadas.\n');
  } else {
    console.log('❌ Hay integraciones criticas sin configurar. Revisa .env.local.\n');
  }
  console.log('═'.repeat(60));
}

verify()
  .then(() => { pool.end(); process.exit(0); })
  .catch(e => { console.error('Fatal:', e); pool.end(); process.exit(1); });
