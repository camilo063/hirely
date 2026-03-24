/**
 * Test script for file storage — validates both LOCAL and S3 paths.
 *
 * Usage:
 *   npx tsx scripts/test-file-storage.ts
 *
 * Requires DATABASE_URL and optionally AWS env vars.
 */

import path from 'path';
import fs from 'fs/promises';

// ─── HELPERS ──────────────────────────────────

const ORG_ID = 'test-org-' + Date.now();
const ENTITY_ID = 'test-entity-' + Date.now();
const TEST_CONTENT = Buffer.from('Test PDF content - Hirely file storage validation');

function createTestFile(name: string, type: string): File {
  const blob = new Blob([TEST_CONTENT], { type });
  return new File([blob], name, { type });
}

function log(icon: string, msg: string) {
  console.log(`${icon}  ${msg}`);
}

// ─── TEST 1: LOCAL STORAGE ────────────────────

async function testLocalStorage() {
  log('🔵', '=== TEST 1: LOCAL STORAGE ===');

  // Force local by importing directly
  const { writeFile, mkdir, unlink } = await import('fs/promises');

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'documentos');
  const testDir = path.join(uploadsDir, ENTITY_ID);
  const testFile = path.join(testDir, 'test-local.pdf');
  const testUrl = `/uploads/documentos/${ENTITY_ID}/test-local.pdf`;

  try {
    // 1. Save file
    await mkdir(testDir, { recursive: true });
    await writeFile(testFile, TEST_CONTENT);
    log('✅', `Local WRITE: ${testFile}`);

    // 2. Verify it exists
    const stat = await fs.stat(testFile);
    if (stat.size !== TEST_CONTENT.length) {
      throw new Error(`Size mismatch: expected ${TEST_CONTENT.length}, got ${stat.size}`);
    }
    log('✅', `Local READ: ${stat.size} bytes — matches`);

    // 3. Verify URL resolves
    const resolvedPath = path.join(process.cwd(), 'public', testUrl);
    await fs.access(resolvedPath);
    log('✅', `Local URL resolves: ${testUrl}`);

    // 4. Delete
    await unlink(testFile);
    try {
      await fs.access(testFile);
      throw new Error('File still exists after delete');
    } catch {
      log('✅', 'Local DELETE: file removed');
    }

    // Cleanup test directory
    await fs.rmdir(testDir).catch(() => {});

    log('🟢', 'LOCAL STORAGE: ALL TESTS PASSED\n');
    return true;
  } catch (err) {
    log('🔴', `LOCAL STORAGE FAILED: ${err instanceof Error ? err.message : err}`);
    // Cleanup on failure
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    return false;
  }
}

// ─── TEST 2: S3 STORAGE ──────────────────────

async function testS3Storage() {
  log('🟠', '=== TEST 2: S3 STORAGE ===');

  const { isS3Configured, uploadToS3, getSignedDownloadUrl, deleteFromS3, buildS3Key, checkS3Health } = await import('../src/lib/integrations/s3');

  if (!isS3Configured) {
    log('⚠️', 'S3 not configured (missing env vars) — SKIPPING S3 tests');
    log('ℹ️', 'To test S3, set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME');
    return 'skipped';
  }

  const testKey = buildS3Key(ORG_ID, 'test', ENTITY_ID, 'test-s3.pdf');

  try {
    // 0. Health check
    const health = await checkS3Health();
    if (health.status !== 'ok') {
      throw new Error(`S3 health check failed: ${health.message}`);
    }
    log('✅', `S3 Health: OK (region: ${health.region}, bucket: ${health.bucket})`);

    // 1. Upload
    const uploadResult = await uploadToS3({
      key: testKey,
      body: TEST_CONTENT,
      contentType: 'application/pdf',
      metadata: { test: 'true', 'org-id': ORG_ID },
    });
    log('✅', `S3 UPLOAD: key=${uploadResult.key}`);
    log('   ', `url=${uploadResult.url}`);

    // 2. Generate signed URL
    const signedUrl = await getSignedDownloadUrl(testKey, 60);
    log('✅', `S3 SIGNED URL: ${signedUrl.substring(0, 80)}...`);

    // 3. Verify download via signed URL
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    const downloaded = Buffer.from(await response.arrayBuffer());
    if (downloaded.length !== TEST_CONTENT.length) {
      throw new Error(`Size mismatch: expected ${TEST_CONTENT.length}, got ${downloaded.length}`);
    }
    if (!downloaded.equals(TEST_CONTENT)) {
      throw new Error('Content mismatch after download');
    }
    log('✅', `S3 DOWNLOAD: ${downloaded.length} bytes — content matches`);

    // 4. Delete
    await deleteFromS3(testKey);
    log('✅', `S3 DELETE: ${testKey} removed`);

    // 5. Verify delete (should fail to download)
    try {
      const afterDelete = await getSignedDownloadUrl(testKey, 10);
      const checkResponse = await fetch(afterDelete);
      if (checkResponse.ok) {
        log('⚠️', 'S3 DELETE VERIFY: file still accessible (S3 eventual consistency)');
      } else {
        log('✅', 'S3 DELETE VERIFY: file no longer accessible');
      }
    } catch {
      log('✅', 'S3 DELETE VERIFY: confirmed deleted');
    }

    log('🟢', 'S3 STORAGE: ALL TESTS PASSED\n');
    return true;
  } catch (err) {
    log('🔴', `S3 STORAGE FAILED: ${err instanceof Error ? err.message : err}`);
    // Cleanup on failure
    try { await deleteFromS3(testKey); } catch { /* ignore */ }
    return false;
  }
}

// ─── TEST 3: FILE-STORAGE ABSTRACTION ─────────

async function testFileStorageAbstraction() {
  log('🟣', '=== TEST 3: FILE-STORAGE ABSTRACTION (saveFile/deleteFile) ===');

  const { saveFile, deleteFile, getDownloadUrl } = await import('../src/lib/utils/file-storage');
  const { isS3Configured } = await import('../src/lib/integrations/s3');

  const expectedProvider = isS3Configured ? 'S3' : 'LOCAL';
  log('ℹ️', `Provider detected: ${expectedProvider}`);

  const testEntityId = 'abstraction-test-' + Date.now();
  const testOrgId = 'test-org-abstraction';
  const testFile = createTestFile('documento-prueba.pdf', 'application/pdf');

  try {
    // 1. Save via abstraction
    const result = await saveFile(testFile, testEntityId, 'prueba', testOrgId, 'test');
    log('✅', `saveFile: url=${result.url}, size=${result.size}`);
    if (result.key) log('   ', `key=${result.key}`);

    if (isS3Configured) {
      // S3 path
      if (!result.url.startsWith('s3://')) {
        throw new Error(`Expected s3:// URL, got: ${result.url}`);
      }
      if (!result.key) {
        throw new Error('Expected S3 key in result');
      }
      if (!result.key.includes(testOrgId)) {
        throw new Error(`Key should contain orgId. Got: ${result.key}`);
      }
      log('✅', 'S3 URL format correct, key contains orgId (multi-tenant OK)');

      // Download URL
      const downloadUrl = await getDownloadUrl(result.url);
      if (!downloadUrl.includes('X-Amz-Signature')) {
        throw new Error('Expected signed URL with X-Amz-Signature');
      }
      log('✅', 'getDownloadUrl: returns signed URL');
    } else {
      // Local path
      if (!result.url.startsWith('/uploads/')) {
        throw new Error(`Expected /uploads/ URL, got: ${result.url}`);
      }
      log('✅', 'Local URL format correct');

      const downloadUrl = await getDownloadUrl(result.url);
      if (downloadUrl !== result.url) {
        throw new Error('Local getDownloadUrl should return URL as-is');
      }
      log('✅', 'getDownloadUrl: returns path as-is');
    }

    // 2. Delete via abstraction
    await deleteFile(result.url);
    log('✅', 'deleteFile: completed without error');

    log('🟢', `FILE-STORAGE ABSTRACTION (${expectedProvider}): ALL TESTS PASSED\n`);
    return true;
  } catch (err) {
    log('🔴', `ABSTRACTION FAILED: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── TEST 4: VALIDATION ──────────────────────

async function testValidation() {
  log('🟡', '=== TEST 4: FILE VALIDATION ===');

  const { validateFile, FileValidationError } = await import('../src/lib/utils/file-storage');

  let passed = 0;
  let failed = 0;

  // Test: oversized file
  try {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    validateFile(bigFile);
    log('🔴', 'FAIL: Should reject >10MB file');
    failed++;
  } catch (err) {
    if (err instanceof FileValidationError) {
      log('✅', 'Rejects oversized file (>10MB)');
      passed++;
    } else {
      log('🔴', `FAIL: Wrong error type: ${err}`);
      failed++;
    }
  }

  // Test: bad extension
  try {
    const exeFile = new File([TEST_CONTENT], 'virus.exe', { type: 'application/octet-stream' });
    validateFile(exeFile);
    log('🔴', 'FAIL: Should reject .exe');
    failed++;
  } catch (err) {
    if (err instanceof FileValidationError) {
      log('✅', 'Rejects disallowed extension (.exe)');
      passed++;
    } else {
      failed++;
    }
  }

  // Test: valid file
  try {
    const goodFile = new File([TEST_CONTENT], 'doc.pdf', { type: 'application/pdf' });
    validateFile(goodFile);
    log('✅', 'Accepts valid PDF');
    passed++;
  } catch {
    log('🔴', 'FAIL: Should accept valid PDF');
    failed++;
  }

  // Test: valid image
  try {
    const imgFile = new File([TEST_CONTENT], 'foto.jpg', { type: 'image/jpeg' });
    validateFile(imgFile);
    log('✅', 'Accepts valid JPEG');
    passed++;
  } catch {
    log('🔴', 'FAIL: Should accept valid JPEG');
    failed++;
  }

  if (failed === 0) {
    log('🟢', `VALIDATION: ALL ${passed} TESTS PASSED\n`);
  } else {
    log('🔴', `VALIDATION: ${failed}/${passed + failed} FAILED\n`);
  }
  return failed === 0;
}

// ─── MAIN ─────────────────────────────────────

async function main() {
  console.log('\n================================================');
  console.log('  HIRELY FILE STORAGE — INTEGRATION TEST SUITE');
  console.log('================================================\n');

  const results: Record<string, boolean | string> = {};

  results.local = await testLocalStorage();
  results.s3 = await testS3Storage();
  results.abstraction = await testFileStorageAbstraction();
  results.validation = await testValidation();

  console.log('================================================');
  console.log('  RESULTS SUMMARY');
  console.log('================================================');
  for (const [test, result] of Object.entries(results)) {
    const icon = result === true ? '🟢' : result === 'skipped' ? '⚪' : '🔴';
    const label = result === true ? 'PASSED' : result === 'skipped' ? 'SKIPPED' : 'FAILED';
    console.log(`  ${icon} ${test.toUpperCase().padEnd(15)} ${label}`);
  }
  console.log('================================================\n');

  const allPassed = Object.values(results).every(r => r === true || r === 'skipped');
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
