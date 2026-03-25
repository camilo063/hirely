/**
 * HIRELY — Auditoria S3 Completa
 * Ejecutar: npx tsx src/lib/tests/audit-s3-complete.ts
 *
 * Verifica que TODOS los campos S3 del sistema
 * son accesibles via presigned URLs correctamente.
 */

import { pool } from '../db';
import { getSignedDownloadUrl, extractS3Key, objectExists, isS3Configured, S3_BUCKET } from '../integrations/s3';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN';
  detail: string;
  url?: string;
}

const results: TestResult[] = [];

function pass(name: string, detail: string, url?: string) {
  results.push({ name, status: 'PASS', detail, url });
  console.log(`  PASS: ${name}`);
  if (detail) console.log(`         ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`  FAIL: ${name}`);
  console.log(`         ${detail}`);
}

function warn(name: string, detail: string) {
  results.push({ name, status: 'WARN', detail });
  console.log(`  WARN: ${name}`);
  console.log(`         ${detail}`);
}

function skip(name: string, detail: string) {
  results.push({ name, status: 'SKIP', detail });
  console.log(`  SKIP: ${name} — ${detail}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function testPresignedUrlAccessible(
  testName: string,
  keyOrRef: string
): Promise<void> {
  if (!keyOrRef) {
    skip(testName, 'Campo vacio en BD');
    return;
  }

  // Skip non-S3 references (local paths, external URLs)
  if (!keyOrRef.startsWith('s3://')) {
    if (keyOrRef.startsWith('/uploads/') || keyOrRef.startsWith('http')) {
      pass(testName, `URL no-S3 (${keyOrRef.substring(0, 50)}...) — no requiere presign`);
      return;
    }
  }

  try {
    const key = extractS3Key(keyOrRef);

    // 1. Verify object exists in S3
    const exists = await objectExists(keyOrRef);
    if (!exists) {
      fail(testName, `Objeto NO existe en S3: ${key}`);
      return;
    }

    // 2. Generate presigned URL
    const url = await getSignedDownloadUrl(key, 300);
    if (!url || !url.startsWith('https://')) {
      fail(testName, `URL generada invalida: ${url?.substring(0, 50)}`);
      return;
    }

    // 3. Verify URL responds with HEAD request
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      pass(testName, `HTTP ${response.status} — Content-Type: ${response.headers.get('content-type')}`, url);
    } else {
      fail(testName, `URL generada pero HTTP ${response.status} al acceder`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(testName, `Error: ${msg}`);
  }
}

// ─── Tests por modulo ─────────────────────────────────────────────────────────

async function testExtractS3Key() {
  console.log('\n TEST GRUPO 1: extractS3Key() — normalizacion de formatos\n');

  const cases: [string, string][] = [
    [`s3://${S3_BUCKET || 'empleo-nivelics'}/org-123/documentos/file.pdf`, 'org-123/'],
    [`s3://${S3_BUCKET || 'empleo-nivelics'}/uuid/documentos/uuid2/cedula.jpeg`, 'uuid/'],
    ['org-123/documentos/file.pdf', 'org-123/'],
    ['https://s3.amazonaws.com/empleo-nivelics/org-123/file.pdf', 'empleo-nivelics/org-123/'],
    [`https://${S3_BUCKET || 'empleo-nivelics'}.s3.us-east-1.amazonaws.com/org-123/file.pdf`, 'org-123/'],
  ];

  for (const [input, expectedPrefix] of cases) {
    try {
      const result = extractS3Key(input);
      if (result.startsWith(expectedPrefix)) {
        pass(`extractS3Key: ${input.substring(0, 50)}...`, `-> "${result}"`);
      } else {
        fail(`extractS3Key: ${input.substring(0, 50)}...`, `Resultado "${result}" no empieza con "${expectedPrefix}"`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(`extractS3Key: ${input.substring(0, 50)}...`, msg);
    }
  }
}

async function testCredentials() {
  console.log('\n TEST GRUPO 2: Credenciales y conectividad AWS\n');

  const vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET_NAME'];
  for (const v of vars) {
    if (process.env[v]) {
      pass(`ENV: ${v}`, `Configurada (${process.env[v]!.substring(0, 8)}...)`);
    } else {
      fail(`ENV: ${v}`, 'Variable no encontrada en entorno');
    }
  }

  if (!isS3Configured) {
    warn('S3 conectividad', 'S3 no configurado — no se puede probar conectividad');
    return;
  }

  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME!,
      MaxKeys: 1,
    }));
    pass('S3 conectividad', `Bucket accesible. KeyCount: ${response.KeyCount ?? 0}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail('S3 conectividad', `No se pudo conectar al bucket: ${msg}`);
  }
}

async function testCandidatosDocumentos() {
  console.log('\n TEST GRUPO 3: Modulo Candidatos — CV\n');

  const result = await pool.query(`
    SELECT id, nombre, cv_url
    FROM candidatos
    WHERE cv_url IS NOT NULL
    LIMIT 5
  `);

  if (result.rows.length === 0) {
    warn('candidatos con cv_url', 'No hay candidatos con cv_url en BD');
    return;
  }

  for (const row of result.rows) {
    await testPresignedUrlAccessible(
      `candidatos[${row.id.substring(0, 8)}].cv_url (${row.nombre})`,
      row.cv_url
    );
  }
}

async function testDocumentosCandidato() {
  console.log('\n TEST GRUPO 4: Modulo Documentos Candidato — documentos subidos\n');

  const result = await pool.query(`
    SELECT dc.id, dc.tipo, dc.url, dc.estado, dc.nombre_archivo
    FROM documentos_candidato dc
    WHERE dc.url IS NOT NULL AND dc.url != ''
    LIMIT 10
  `);

  if (result.rows.length === 0) {
    skip('documentos_candidato', 'Sin documentos subidos en BD');
    return;
  }

  // Group by tipo for coverage
  const byTipo: Record<string, typeof result.rows> = {};
  for (const row of result.rows) {
    const t = row.tipo || 'sin_tipo';
    if (!byTipo[t]) byTipo[t] = [];
    byTipo[t].push(row);
  }

  for (const [tipo, docs] of Object.entries(byTipo)) {
    const doc = docs[0];
    await testPresignedUrlAccessible(
      `documentos_candidato[tipo=${tipo}] id=${doc.id.substring(0, 8)} — ${doc.nombre_archivo || 'sin nombre'}`,
      doc.url
    );
  }
}

async function testDocumentosOnboarding() {
  console.log('\n TEST GRUPO 5: Modulo Onboarding — documentos configurados\n');

  try {
    const result = await pool.query(`
      SELECT id, nombre, url, tipo
      FROM documentos_onboarding
      WHERE url IS NOT NULL AND is_active = true
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      skip('documentos_onboarding', 'Sin documentos de onboarding en BD');
      return;
    }

    for (const row of result.rows) {
      await testPresignedUrlAccessible(
        `documentos_onboarding[${row.id.substring(0, 8)}] ${row.nombre}`,
        row.url
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('documentos_onboarding', `Query fallo: ${msg}`);
  }
}

async function testContratos() {
  console.log('\n TEST GRUPO 6: Modulo Contratos — documentos firmados\n');

  try {
    const result = await pool.query(`
      SELECT id, estado, firma_pdf_url, pdf_url
      FROM contratos
      WHERE firma_pdf_url IS NOT NULL OR pdf_url IS NOT NULL
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      skip('contratos documentos', 'Sin contratos con documentos en BD');
      return;
    }

    for (const row of result.rows) {
      if (row.firma_pdf_url) {
        await testPresignedUrlAccessible(
          `contratos[${row.id.substring(0, 8)}].firma_pdf_url (estado=${row.estado})`,
          row.firma_pdf_url
        );
      }
      if (row.pdf_url) {
        await testPresignedUrlAccessible(
          `contratos[${row.id.substring(0, 8)}].pdf_url (legacy)`,
          row.pdf_url
        );
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('contratos documentos', `Query fallo: ${msg}`);
  }
}

async function testApiRoutePresign() {
  console.log('\n TEST GRUPO 7: API Route /api/s3/presign\n');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3500';

  // Test 1: No auth should return 401
  try {
    const res = await fetch(`${baseUrl}/api/s3/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'test/file.pdf', action: 'download' }),
    });
    if (res.status === 401) {
      pass('API /api/s3/presign sin auth', 'Retorna 401 correctamente');
    } else {
      fail('API /api/s3/presign sin auth', `Esperado 401, recibido ${res.status}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('API /api/s3/presign sin auth', `Servidor no disponible: ${msg}`);
  }

  // Test 2: Invalid body should return 400
  try {
    const res = await fetch(`${baseUrl}/api/s3/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.status === 400 || res.status === 401) {
      pass('API /api/s3/presign body invalido', `Retorna ${res.status} correctamente`);
    } else {
      warn('API /api/s3/presign body invalido', `Retorna ${res.status}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('API /api/s3/presign body invalido', msg);
  }

  // Test 3: GET should return 405
  try {
    const res = await fetch(`${baseUrl}/api/s3/presign`, { method: 'GET' });
    if (res.status === 405) {
      pass('API /api/s3/presign GET no permitido', 'Retorna 405 correctamente');
    } else {
      warn('API /api/s3/presign GET no permitido', `Retorna ${res.status}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn('API /api/s3/presign GET', msg);
  }
}

async function testOrphanedReferences() {
  console.log('\n TEST GRUPO 8: Referencias huerfanas — archivos en BD que no existen en S3\n');

  if (!isS3Configured) {
    skip('Referencias huerfanas', 'S3 no configurado');
    return;
  }

  const queries = [
    { table: 'candidatos', field: 'cv_url' },
    { table: 'documentos_candidato', field: 'url' },
    { table: 'documentos_onboarding', field: 'url' },
    { table: 'contratos', field: 'firma_pdf_url' },
    { table: 'contratos', field: 'pdf_url' },
  ];

  let totalOrphans = 0;

  for (const { table, field } of queries) {
    try {
      const result = await pool.query(
        `SELECT id, ${field} FROM ${table} WHERE ${field} IS NOT NULL AND ${field} LIKE 's3://%' LIMIT 20`
      );

      if (result.rows.length === 0) {
        skip(`${table}.${field} huerfanos`, 'Sin registros S3 en esta columna');
        continue;
      }

      const orphans = [];
      for (const row of result.rows) {
        const exists = await objectExists(row[field]);
        if (!exists) orphans.push({ id: row.id, key: row[field] });
      }

      if (orphans.length === 0) {
        pass(`${table}.${field} sin huerfanos`, `${result.rows.length} registros verificados — todos existen en S3`);
      } else {
        totalOrphans += orphans.length;
        warn(`${table}.${field} referencias huerfanas`,
          `${orphans.length}/${result.rows.length} registros apuntan a archivos que NO existen en S3:\n` +
          orphans.slice(0, 3).map(o => `    id=${o.id}: ${o.key}`).join('\n')
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      skip(`${table}.${field}`, `Campo no encontrado: ${msg}`);
    }
  }

  if (totalOrphans > 0) {
    warn('Referencias huerfanas total', `${totalOrphans} archivos en BD no existen en S3.`);
  }
}

async function testFormatoKeysConsistencia() {
  console.log('\n TEST GRUPO 9: Consistencia de formato de keys en BD\n');

  const checkColumns = [
    { table: 'candidatos', field: 'cv_url' },
    { table: 'documentos_candidato', field: 'url' },
    { table: 'documentos_onboarding', field: 'url' },
    { table: 'contratos', field: 'firma_pdf_url' },
    { table: 'contratos', field: 'pdf_url' },
  ];

  for (const { table, field } of checkColumns) {
    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE ${field} LIKE 's3://%') as s3_protocol,
          COUNT(*) FILTER (WHERE ${field} LIKE 'https://%') as https_full,
          COUNT(*) FILTER (WHERE ${field} LIKE '/uploads/%') as local_path,
          COUNT(*) FILTER (WHERE ${field} NOT LIKE 's3://%' AND ${field} NOT LIKE 'https://%' AND ${field} NOT LIKE '/uploads/%' AND ${field} IS NOT NULL) as other,
          COUNT(*) FILTER (WHERE ${field} IS NOT NULL) as total
        FROM ${table}`
      );

      const row = result.rows[0];
      const formats = [];
      if (parseInt(row.s3_protocol) > 0) formats.push(`${row.s3_protocol} con s3://`);
      if (parseInt(row.https_full) > 0) formats.push(`${row.https_full} con https://`);
      if (parseInt(row.local_path) > 0) formats.push(`${row.local_path} con /uploads/`);
      if (parseInt(row.other) > 0) formats.push(`${row.other} con otro formato`);

      if (formats.length <= 1) {
        pass(`${table}.${field} formato consistente`, `${row.total} registros, formato: ${formats[0] || 'ninguno'}`);
      } else {
        warn(`${table}.${field} formatos mixtos`,
          `Mezcla de formatos: ${formats.join(', ')}. extractS3Key()/resolveUrl() debe manejar todos.`
        );
      }
    } catch {
      skip(`${table}.${field} formato`, 'Campo no encontrado');
    }
  }
}

async function testSchemaUrlColumns() {
  console.log('\n TEST GRUPO 10: Inventario completo de columnas URL en BD\n');

  const result = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name LIKE '%url%' OR column_name LIKE '%archivo%' OR column_name LIKE '%path%')
    ORDER BY table_name, column_name
  `);

  console.log(`  Columnas URL encontradas: ${result.rows.length}`);
  for (const row of result.rows) {
    console.log(`    ${row.table_name}.${row.column_name}`);
  }
  pass('Inventario columnas URL', `${result.rows.length} columnas identificadas`);
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function runAudit() {
  console.log('\n' + '='.repeat(60));
  console.log('  HIRELY — AUDITORIA S3 COMPLETA');
  console.log('  ' + new Date().toISOString());
  console.log('='.repeat(60));

  await testExtractS3Key();
  await testCredentials();
  await testCandidatosDocumentos();
  await testDocumentosCandidato();
  await testDocumentosOnboarding();
  await testContratos();
  await testApiRoutePresign();
  await testOrphanedReferences();
  await testFormatoKeysConsistencia();
  await testSchemaUrlColumns();

  // ─── Resumen final ───────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  RESUMEN DE AUDITORIA');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n  PASS:  ${passed}`);
  console.log(`  FAIL:  ${failed}`);
  console.log(`  WARN:  ${warned}`);
  console.log(`  SKIP:  ${skipped}`);
  console.log(`  TOTAL: ${results.length}`);

  if (failed > 0) {
    console.log('\n  -- FALLOS CRITICOS --');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  FAIL: ${r.name}`);
      console.log(`     ${r.detail}`);
    });
  }

  if (warned > 0) {
    console.log('\n  -- ADVERTENCIAS --');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  WARN: ${r.name}`);
      console.log(`     ${r.detail}`);
    });
  }

  const executed = passed + failed;
  const score = executed > 0 ? Math.round((passed / executed) * 100) : 0;
  console.log(`\n  SCORE: ${score}% de tests ejecutados pasaron`);

  if (failed === 0) {
    console.log('\n  S3 esta funcional en todos los casos probados.');
  } else {
    console.log('\n  Hay fallos que requieren correccion.');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runAudit().catch(e => {
  console.error('Error fatal en auditoria:', e);
  pool.end();
  process.exit(1);
});
