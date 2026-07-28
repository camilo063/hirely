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

  // Path local. Se contemplan las dos formas de URL que produce el
  // almacenamiento local:
  //   - `/api/archivos/{entidad}/{org}/{id}/{fichero}`  (actual: se sirve tras
  //     autenticacion y los ficheros viven en `.uploads/`)
  //   - `/uploads/{...}`                                (anterior: bajo `public/`)
  //
  // Cuando las subidas se movieron fuera de `public/` esta funcion se quedo
  // probando solo las rutas viejas, asi que TODO el scoring ATS y el parseo de
  // CV fallaban con ENOENT: los candidatos entraban sin puntuar y el umbral de
  // preseleccion quedaba inoperante.
  if (url.startsWith('/') && !url.startsWith('//')) {
    console.log(`[pdfUrlToBase64] Leyendo PDF local: ${url}`);

    const relativa = url
      .replace(/^\/api\/archivos\//, '')
      .replace(/^\/uploads\//, '')
      .replace(/^\//, '');

    const candidatos = [
      resolve(process.cwd(), '.uploads', relativa),          // ubicacion actual
      resolve(process.cwd(), 'public', 'uploads', relativa), // ubicacion anterior
      resolve(process.cwd(), 'public', url.replace(/^\//, '')),
      join(process.cwd(), url),
    ];

    for (const ruta of candidatos) {
      try {
        const buffer = await readFile(ruta);
        console.log(`[pdfUrlToBase64] PDF leido (${ruta}): ${buffer.length} bytes`);
        return buffer.toString('base64');
      } catch {
        // Se prueba la siguiente ubicacion.
      }
    }
    throw new Error(`[pdfUrlToBase64] No se encontro el PDF local para ${url}`);
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
