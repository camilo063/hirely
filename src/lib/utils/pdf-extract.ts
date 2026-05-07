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
 * o referencia S3 (s3://... o https://*.s3.*).
 * Detecta automaticamente el tipo y resuelve presigned URLs para S3.
 *
 * Logging detallado para diagnosticar fallas en produccion (Vercel logs).
 */
export async function pdfUrlToBase64(url: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    throw new Error(`[pdfUrlToBase64] URL invalida: ${JSON.stringify(url)}`);
  }

  const preview = url.length > 80 ? `${url.substring(0, 80)}...` : url;

  // S3 reference (s3://bucket/key)
  if (url.startsWith('s3://')) {
    console.log(`[pdfUrlToBase64] Detectada URL S3 (s3://): ${preview}`);
    const { resolveUrl } = await import('@/lib/integrations/s3');
    const presignedUrl = await resolveUrl(url);
    console.log(`[pdfUrlToBase64] Presigned URL generada, descargando...`);
    const response = await fetch(presignedUrl);
    if (!response.ok) {
      throw new Error(`[pdfUrlToBase64] Error HTTP ${response.status} ${response.statusText} descargando PDF de S3 (key=${url.replace(/^s3:\/\/[^/]+\//, '')})`);
    }
    const buffer = await response.arrayBuffer();
    console.log(`[pdfUrlToBase64] PDF descargado de S3: ${buffer.byteLength} bytes`);
    return Buffer.from(buffer).toString('base64');
  }

  // URL HTTPS de S3 (https://bucket.s3.region.amazonaws.com/key o variantes)
  // Pasarla por resolveUrl/extractS3Key garantiza que use credenciales aunque
  // la URL ya sea publica.
  if (/^https?:\/\//.test(url) && /\.s3[.-]|s3\.amazonaws\.com/.test(url)) {
    console.log(`[pdfUrlToBase64] Detectada URL S3 (HTTPS): ${preview}`);
    try {
      const { extractS3Key, getSignedDownloadUrl } = await import('@/lib/integrations/s3');
      const key = extractS3Key(url);
      const presignedUrl = await getSignedDownloadUrl(key);
      console.log(`[pdfUrlToBase64] Re-firmada como presigned (key=${key}), descargando...`);
      const response = await fetch(presignedUrl);
      if (!response.ok) {
        throw new Error(`[pdfUrlToBase64] HTTP ${response.status} con presigned`);
      }
      const buffer = await response.arrayBuffer();
      console.log(`[pdfUrlToBase64] PDF descargado: ${buffer.byteLength} bytes`);
      return Buffer.from(buffer).toString('base64');
    } catch (signErr) {
      // Si no se pudo firmar (ej. bucket diferente al configurado), intentar fetch directo
      console.warn(`[pdfUrlToBase64] No se pudo re-firmar, intentando fetch directo:`, signErr);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`[pdfUrlToBase64] Error HTTP ${response.status} ${response.statusText} descargando PDF de S3 (URL https)`);
      }
      const buffer = await response.arrayBuffer();
      console.log(`[pdfUrlToBase64] PDF descargado (fetch directo): ${buffer.byteLength} bytes`);
      return Buffer.from(buffer).toString('base64');
    }
  }

  // Path local: /uploads/... o ruta relativa sin protocolo
  if (url.startsWith('/') && !url.startsWith('//')) {
    console.log(`[pdfUrlToBase64] Leyendo PDF local: ${url}`);
    const localPath = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
    try {
      const buffer = await readFile(localPath);
      console.log(`[pdfUrlToBase64] PDF leido (public): ${buffer.length} bytes`);
      return buffer.toString('base64');
    } catch {
      const directPath = join(process.cwd(), url);
      const buffer = await readFile(directPath);
      console.log(`[pdfUrlToBase64] PDF leido (cwd): ${buffer.length} bytes`);
      return buffer.toString('base64');
    }
  }

  // URL remota generica: https://... o http://...
  console.log(`[pdfUrlToBase64] Descargando PDF de URL HTTP generica: ${preview}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[pdfUrlToBase64] Error HTTP ${response.status} ${response.statusText} descargando PDF de ${preview}`);
  }
  const buffer = await response.arrayBuffer();
  console.log(`[pdfUrlToBase64] PDF descargado: ${buffer.byteLength} bytes`);
  return Buffer.from(buffer).toString('base64');
}

export function pdfBufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
