/**
 * File storage utility for MVP.
 * - Dev/MVP: local fs in /public/uploads/
 * - Production: S3 (switch via FILE_STORAGE_PROVIDER env)
 */

import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'documentos');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

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

export async function saveFile(
  file: File,
  aplicacionId: string,
  tipo: string
): Promise<{ url: string; size: number }> {
  validateFile(file);

  const dir = path.join(UPLOADS_DIR, aplicacionId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  const filename = `${tipo}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const url = `/uploads/documentos/${aplicacionId}/${filename}`;
  return { url, size: file.size };
}

export async function deleteFile(url: string): Promise<void> {
  if (!url || url.startsWith('http')) return;
  try {
    const filePath = path.join(process.cwd(), 'public', url);
    await unlink(filePath);
  } catch {
    // File may not exist, ignore
  }
}
