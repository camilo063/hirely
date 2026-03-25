/**
 * Verifica que el cliente S3 puede generar presigned URLs validas.
 * Ejecutar: npx tsx src/lib/tests/test-s3-presign.ts
 */
import { getSignedDownloadUrl, extractS3Key, objectExists, isS3Configured, S3_BUCKET } from '../integrations/s3';

async function testS3Presign() {
  console.log('Test S3 Presigned URLs\n');
  console.log(`S3 Configured: ${isS3Configured}`);
  console.log(`Bucket: ${S3_BUCKET || '(not set)'}\n`);

  // Test 1: extractS3Key
  console.log('Test 1: extractS3Key()');
  const cases = [
    { input: `s3://${S3_BUCKET}/454fac6e/documentos/39051196/cedula.jpeg`, expected: '454fac6e/documentos/39051196/cedula.jpeg' },
    { input: '454fac6e/documentos/39051196/file.pdf', expected: '454fac6e/documentos/39051196/file.pdf' },
    { input: `s3://other-bucket/path/to/file.pdf`, expected: 'path/to/file.pdf' },
  ];

  let allPassed = true;
  for (const c of cases) {
    const result = extractS3Key(c.input);
    const ok = result === c.expected;
    if (!ok) allPassed = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: "${c.input.substring(0, 50)}..." => "${result}"`);
    if (!ok) console.log(`  Expected: "${c.expected}"`);
  }
  console.log(`  ${allPassed ? 'All extractS3Key tests passed' : 'Some tests failed'}\n`);

  if (!isS3Configured) {
    console.log('S3 is not configured. Skipping network tests.');
    console.log('Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME to run full tests.');
    return;
  }

  // Test 2: Generate presigned URL
  const testKey = `s3://${S3_BUCKET}/454fac6e-e6f5-441d-991b-6076e7c7efa3/documentos/39051196-1938-429f-a1a1-ab66813d7fc4/cedula.jpeg`;

  console.log('Test 2: getSignedDownloadUrl()');
  try {
    const key = extractS3Key(testKey);
    const url = await getSignedDownloadUrl(key, 300);
    console.log(`  PASS: URL generated: ${url.substring(0, 80)}...`);
    console.log(`  Expires in 5 minutes`);
    console.log(`\n  Test URL in browser:`);
    console.log(`  ${url}\n`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ERROR: ${msg}`);
  }

  // Test 3: Object existence check
  console.log('Test 3: objectExists()');
  try {
    const exists = await objectExists(testKey);
    console.log(`  ${exists ? 'Object found in S3' : 'Object NOT found - verify the key'}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ERROR: ${msg}`);
  }
}

testS3Presign().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
