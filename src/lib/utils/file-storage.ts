/**
 * File storage utility — abstraction over local FS and S3.
 *
 * Provider selection:
 *   - S3 configured (AWS keys + bucket present) → uses S3
 *   - Otherwise → falls back to local /public/uploads/ (dev/MVP)
 *
 * All S3 keys follow multi-tenant convention:
 *   {orgId}/{entity}/{entityId}/{filename}
 */

import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { isS3Configured, uploadToS3, deleteFromS3, getSignedDownloadUrl, buildS3Key } from '@/lib/integrations/s3';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'documentos');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

const useS3 = isS3Configured;

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(`Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new FileValidationError(`Formato no permitido. Formatos validos: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new FileValidationError(`Tipo de archivo no permitido: ${file.type}`);
  }
}

/**
 * Save a file. Uses S3 if configured, otherwise local filesystem.
 *
 * @param file - The File object to save
 * @param entityId - The entity ID (e.g. aplicacion_id) used in the path
 * @param tipo - File type/name (e.g. "cv", "cedula")
 * @param orgId - Organization ID for multi-tenant S3 isolation (optional for local)
 * @param entity - Entity type for S3 path (default: "documentos")
 */
export async function saveFile(
  file: File,
  entityId: string,
  tipo: string,
  orgId?: string,
  entity: string = 'documentos'
): Promise<{ url: string; key?: string; size: number }> {
  validateFile(file);

  const ext = path.extname(file.name).toLowerCase();
  const filename = `${tipo}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (useS3 && orgId) {
    const key = buildS3Key(orgId, entity, entityId, filename);
    const result = await uploadToS3({
      key,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
      metadata: {
        'organization-id': orgId,
        'entity-id': entityId,
        'original-name': file.name,
      },
    });
    return { url: result.url, key: result.key, size: file.size };
  }

  // Local fallback
  const dir = path.join(UPLOADS_DIR, entityId);
  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  await writeFile(filePath, buffer);

  const url = `/uploads/documentos/${entityId}/${filename}`;
  return { url, size: file.size };
}

/**
 * Delete a file. Handles both S3 keys and local paths.
 */
export async function deleteFile(urlOrKey: string): Promise<void> {
  if (!urlOrKey) return;

  // S3 key (starts with s3:// or contains org UUID pattern)
  if (urlOrKey.startsWith('s3://') && useS3) {
    const key = urlOrKey.replace(/^s3:\/\/[^/]+\//, '');
    await deleteFromS3(key);
    return;
  }

  // Local file
  if (!urlOrKey.startsWith('http')) {
    try {
      const filePath = path.join(process.cwd(), 'public', urlOrKey);
      await unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  }
}

/**
 * Get a download URL for a file.
 * - S3: returns a signed URL (1h expiry)
 * - Local: returns the path as-is (publicly accessible)
 */
export async function getDownloadUrl(urlOrKey: string): Promise<string> {
  if (urlOrKey.startsWith('s3://') && useS3) {
    const key = urlOrKey.replace(/^s3:\/\/[^/]+\//, '');
    return getSignedDownloadUrl(key);
  }
  // Local or http URLs pass through
  return urlOrKey;
}
