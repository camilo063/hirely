/**
 * Test de conexion con Dapta (solo verifica conectividad, NO dispara llamada real).
 * Ejecutar: npx tsx src/lib/tests/test-dapta.ts
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

async function testDapta() {
  console.log('\n📞 PRUEBA DE CONEXION CON DAPTA\n');
  console.log('═'.repeat(50));

  const webhookUrl = process.env.DAPTA_FLOW_WEBHOOK_URL || process.env.DAPTA_API_URL;
  const apiKey = process.env.DAPTA_API_KEY;
  const fromNumber = process.env.DAPTA_FROM_NUMBER;

  console.log(`\n  DAPTA_FLOW_WEBHOOK_URL: ${webhookUrl ? `✅ ${webhookUrl.substring(0, 60)}...` : '❌ NO configurada'}`);
  console.log(`  DAPTA_API_KEY: ${apiKey ? '✅ ***configurada***' : '❌ NO configurada'}`);
  console.log(`  DAPTA_FROM_NUMBER: ${fromNumber || '⚠️  No configurado (opcional)'}`);
  console.log(`  DAPTA_WEBHOOK_SECRET: ${process.env.DAPTA_WEBHOOK_SECRET ? '✅ configurado' : '⚠️  No configurado (opcional)'}`);

  if (!webhookUrl) {
    console.error('\n❌ Configura DAPTA_FLOW_WEBHOOK_URL en .env.local');
    process.exit(1);
  }

  // Test 1: Verificar conectividad con POST de prueba (numero invalido para no disparar llamada)
  console.log('\n📡 Test 1: Verificar conectividad con Dapta API\n');
  try {
    // Dapta uses API key as query param, NOT header
    const separator = webhookUrl.includes('?') ? '&' : '?';
    const urlWithKey = apiKey ? `${webhookUrl}${separator}x-api-key=${apiKey}` : webhookUrl;

    console.log(`  URL: ${webhookUrl}`);
    console.log(`  Auth: x-api-key query param ${apiKey ? '✅' : '❌ missing'}`);

    const response = await fetch(urlWithKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefono: '+0000000000', // Numero invalido a proposito
        nombre: 'TEST - NO LLAMAR',
      }),
    });

    const statusText = `HTTP ${response.status} ${response.statusText}`;
    const body = await response.text();

    if (response.ok) {
      console.log(`  ✅ Dapta respondio correctamente: ${statusText}`);
      console.log(`  📦 Response: ${body.substring(0, 300)}`);
    } else if (response.status === 400 || response.status === 422) {
      console.log(`  ⚠️  Dapta rechazo el payload (esperado con numero invalido): ${statusText}`);
      console.log(`  📦 Response: ${body.substring(0, 300)}`);
      console.log(`  ✅ Conectividad confirmada — Dapta recibe requests correctamente`);
    } else if (response.status === 401 || response.status === 403) {
      console.log(`  ❌ Error de autenticacion: ${statusText}`);
      console.log(`  💡 Verifica DAPTA_API_KEY`);
      console.log(`  📦 Response: ${body.substring(0, 200)}`);
    } else {
      console.log(`  ⚠️  Respuesta inesperada: ${statusText}`);
      console.log(`  📦 Response: ${body.substring(0, 300)}`);
    }
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.log(`  ❌ Conexion rechazada — verifica la URL de Dapta`);
    } else {
      console.log(`  ❌ Error de conexion: ${error.message}`);
    }
  }

  // Test 2: Verificar OPTIONS (CORS)
  console.log('\n📡 Test 2: Verificar endpoint (OPTIONS/HEAD)\n');
  try {
    const response = await fetch(webhookUrl, { method: 'OPTIONS' });
    console.log(`  OPTIONS: HTTP ${response.status} ${response.ok ? '✅' : '⚠️'}`);
  } catch (error: any) {
    console.log(`  OPTIONS: ❌ ${error.message}`);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📞 Para probar una llamada REAL:');
  console.log('   npx tsx src/lib/tests/test-dapta-call.ts +573001234567');
  console.log('   ⚠️  Esto genera una llamada real con costo\n');
}

testDapta().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(1); });
