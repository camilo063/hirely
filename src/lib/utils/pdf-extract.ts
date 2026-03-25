import { readFile } from 'fs/promises';
import { resolve, join } from 'path';

/**
 * Utilidades para extraer/convertir PDFs.
 *
 * Estrategia principal: Enviar el PDF como base64 directo a Claude API
 * (Claude puede leer PDFs nativamente, no necesita extraccion previa).
 */

export async function pdfToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString('base64');
}

/**
 * Convierte un PDF a base64 desde una URL (HTTP), path local (/uploads/...),
 * o referencia S3 (s3://...).
 * Detecta automaticamente el tipo y resuelve presigned URLs para S3.
 */
export async function pdfUrlToBase64(url: string): Promise<string> {
  // S3 reference: resolve to presigned URL first
  if (url.startsWith('s3://')) {
    const { resolveUrl } = await import('@/lib/integrations/s3');
    const presignedUrl = await resolveUrl(url);
    const response = await fetch(presignedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from S3: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  // Path local: /uploads/... o ruta relativa sin protocolo
  if (url.startsWith('/') && !url.startsWith('//')) {
    const localPath = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
    try {
      const buffer = await readFile(localPath);
      return buffer.toString('base64');
    } catch {
      // Try also without 'public' prefix (direct filesystem path)
      const directPath = join(process.cwd(), url);
      const buffer = await readFile(directPath);
      return buffer.toString('base64');
    }
  }

  // URL remota: https://... o http://...
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

export function pdfBufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
