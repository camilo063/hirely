/**
 * Test automatizado de todas las API routes.
 * Ejecuta HTTP requests contra el servidor local y verifica respuestas.
 *
 * PREREQUISITO: Servidor corriendo en localhost:3500
 * Ejecutar: npx tsx src/lib/db/test-apis.ts
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

const BASE = process.env.NEXTAUTH_URL || 'http://localhost:3500';

interface ApiTest {
  name: string;
  method: string;
  url: string;
  body?: any;
  expectedStatus: number[];
  headers?: Record<string, string>;
}

const API_TESTS: ApiTest[] = [
  // ═══ Portal público (sin auth) ═══
  { name: 'GET /empleo (listado público)', method: 'GET', url: '/empleo', expectedStatus: [200] },
  { name: 'GET /empleo/{slug} (vacante pública)', method: 'GET', url: '/empleo/desarrollador-full-stack-senior-nivelics-test01', expectedStatus: [200] },
  { name: 'GET /empleo/slug-inexistente (404)', method: 'GET', url: '/empleo/no-existe-xyz-999', expectedStatus: [404] },

  // ═══ API portal aplicación (sin auth) ═══
  { name: 'POST /api/portal/aplicar (sin CV → 400)', method: 'POST', url: '/api/portal/aplicar/desarrollador-full-stack-senior-nivelics-test01',
    expectedStatus: [400], headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'nombre=Test&email=test@test.com&telefono=123' },
  { name: 'POST /api/portal/aplicar (slug inválido)', method: 'POST', url: '/api/portal/aplicar/no-existe-xyz',
    expectedStatus: [400], headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'nombre=Test&email=t@t.com&telefono=123' },

  // ═══ APIs protegidas (sin auth → redirect o 401) ═══
  { name: 'GET /api/vacantes (sin auth → redirect)', method: 'GET', url: '/api/vacantes', expectedStatus: [307, 401, 302] },
  { name: 'GET /api/candidatos (sin auth → redirect)', method: 'GET', url: '/api/candidatos', expectedStatus: [307, 401, 302] },
  { name: 'GET /api/contratos (sin auth → redirect)', method: 'GET', url: '/api/contratos', expectedStatus: [307, 401, 302] },
  { name: 'GET /api/onboarding (sin auth → redirect)', method: 'GET', url: '/api/onboarding', expectedStatus: [307, 401, 302] },
  { name: 'GET /api/dashboard (sin auth → redirect)', method: 'GET', url: '/api/dashboard', expectedStatus: [307, 401, 302] },

  // ═══ Páginas públicas ═══
  { name: 'GET / (landing)', method: 'GET', url: '/', expectedStatus: [200] },
  { name: 'GET /login', method: 'GET', url: '/login', expectedStatus: [200] },

  // ═══ API auth ═══
  { name: 'GET /api/auth/csrf', method: 'GET', url: '/api/auth/csrf', expectedStatus: [200] },
  { name: 'GET /api/auth/session', method: 'GET', url: '/api/auth/session', expectedStatus: [200] },
  { name: 'GET /api/auth/providers', method: 'GET', url: '/api/auth/providers', expectedStatus: [200] },

  // ═══ Webhook endpoints ═══
  { name: 'GET /api/webhooks/dapta (method check)', method: 'GET', url: '/api/webhooks/dapta', expectedStatus: [200, 405, 404] },
];

async function testApis() {
  console.log('\n🔌 TEST DE APIs DE HIRELY\n');
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of API_TESTS) {
    try {
      const resp = await fetch(`${BASE}${test.url}`, {
        method: test.method,
        headers: test.headers || (test.body && typeof test.body === 'object' ? { 'Content-Type': 'application/json' } : {}),
        body: test.body ? (typeof test.body === 'string' ? test.body : JSON.stringify(test.body)) : undefined,
        redirect: 'manual',
      });

      const ok = test.expectedStatus.includes(resp.status);
      const icon = ok ? '✅' : '❌';
      console.log(`  ${icon} ${test.name} → HTTP ${resp.status} ${ok ? '' : `(esperado: ${test.expectedStatus.join('|')})`}`);

      if (ok) passed++; else failed++;
    } catch (error: any) {
      console.log(`  ⚠️ ${test.name} → Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Resultado: ${passed} passed, ${failed} failed de ${API_TESTS.length} tests`);
  console.log('═'.repeat(60));
}

testApis().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
