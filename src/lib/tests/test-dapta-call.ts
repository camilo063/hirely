/**
 * Dispara una llamada REAL de Dapta a un numero de telefono.
 *
 * USO: npx tsx src/lib/tests/test-dapta-call.ts +573001234567
 *
 * ⚠️ ESTO GENERA UNA LLAMADA REAL Y TIENE COSTO
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

async function testCall() {
  const phone = process.argv[2];
  if (!phone || !phone.startsWith('+')) {
    console.error('Uso: npx tsx src/lib/tests/test-dapta-call.ts +573001234567');
    console.error('El numero debe incluir codigo de pais (+57, +1, etc.)');
    process.exit(1);
  }

  const webhookUrl = process.env.DAPTA_FLOW_WEBHOOK_URL || process.env.DAPTA_API_URL;
  const apiKey = process.env.DAPTA_API_KEY;
  const fromNumber = process.env.DAPTA_FROM_NUMBER;
  const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3500'}/api/webhooks/dapta`;

  if (!webhookUrl) {
    console.error('❌ DAPTA_FLOW_WEBHOOK_URL no configurada en .env.local');
    process.exit(1);
  }

  console.log(`\n📞 DISPARANDO LLAMADA REAL DE DAPTA\n`);
  console.log('═'.repeat(50));
  console.log(`  Numero destino: ${phone}`);
  console.log(`  Numero origen: ${fromNumber || '(default de Dapta)'}`);
  console.log(`  Webhook URL: ${webhookUrl.substring(0, 60)}...`);
  console.log(`  Callback URL: ${callbackUrl}`);
  console.log('═'.repeat(50));

  // Dapta uses API key as query param, NOT header
  const separator = webhookUrl.includes('?') ? '&' : '?';
  const urlWithKey = apiKey ? `${webhookUrl}${separator}x-api-key=${apiKey}` : webhookUrl;

  // Dapta hacer_llamada expects { telefono, nombre } as core params
  const payload = {
    telefono: phone,
    nombre: 'Candidato de Prueba',
    // Additional params the flow may use
    vacante: 'Desarrollador Full Stack',
    empresa: 'Nivelics',
    entrevista_id: `test-${Date.now()}`,
    aplicacion_id: `test-${Date.now()}`,
    callback_url: callbackUrl,
  };

  console.log('\n📤 URL:', urlWithKey.replace(apiKey || '', '***'));
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(urlWithKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    console.log(`\n📬 Response: HTTP ${response.status}`);
    console.log(`📦 Body: ${body}`);

    if (response.ok) {
      let data;
      try { data = JSON.parse(body); } catch { data = {}; }
      const responseUrl = data.response || '';
      // Extract call ID from CloudFront URL: .../{call_id}:response.json
      let callId = 'unknown';
      if (responseUrl) {
        const parts = responseUrl.split('/');
        const last = parts[parts.length - 1];
        callId = last.includes(':') ? last.split(':')[0] : last;
      }
      console.log(`\n✅ Llamada disparada exitosamente`);
      console.log(`📋 Call ID: ${callId}`);
      if (responseUrl) console.log(`🔗 Response URL: ${responseUrl}`);
      console.log('\n📞 El candidato deberia recibir la llamada en los proximos segundos.');
      console.log(`🔗 Webhook callback: ${callbackUrl}`);
      console.log('\nCuando la llamada termine, Dapta enviara la transcripcion al webhook.');
      console.log('Verifica los logs del servidor Next.js para ver el procesamiento.\n');
    } else {
      console.error(`\n❌ Error al disparar la llamada: HTTP ${response.status}`);
      console.log('Verifica la configuracion de Dapta.\n');
    }
  } catch (error: any) {
    console.error(`\n❌ Error de conexion: ${error.message}\n`);
  }
}

testCall().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(1); });
