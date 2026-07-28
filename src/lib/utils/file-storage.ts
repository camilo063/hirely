/**
 * File storage utility — abstraction over local FS and S3.
 *
 * Provider selection:
 *   - S3 configured (AWS keys + bucket present) → uses S3
 *   - Otherwise → falls back to local .uploads/ served via /api/archivos (dev/MVP)
 *
 * All S3 keys follow multi-tenant convention:
 *   {orgId}/{entity}/{entityId}/{filename}
 */

import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { isS3Configured, uploadToS3, deleteFromS3, getSignedDownloadUrl, buildS3Key, extractS3Key } from '@/lib/integrations/s3';

/**
 * Directorio de subidas locales, FUERA de `public/`.
 *
 * Mientras vivieron en `public/uploads/`, Next los servia como estaticos: los
 * CVs y las cedulas eran descargables sin sesion por cualquiera que conociera la
 * ruta. Ahora se guardan aparte y solo se entregan a traves de
 * `/api/archivos/...`, que exige sesion y comprueba la organizacion.
 *
 * Solo aplica al modo local (desarrollo/MVP). En produccion se usa S3.
 */
const UPLOADS_DIR = path.join(process.cwd(), '.uploads', 'documentos');

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
  if (file.size === 0) {
    throw new FileValidationError('El archivo esta vacio.');
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
 * Firmas binarias de los formatos aceptados.
 *
 * La extension y el `Content-Type` los declara el cliente y ambos se pueden
 * mentir: se podia guardar un SVG con script dentro de un `.png` en un
 * directorio servido publicamente. Comprobar los primeros bytes verifica que el
 * contenido es de verdad lo que dice ser.
 */
const FIRMAS: { ext: string[]; bytes: number[][] }[] = [
  { ext: ['.pdf'], bytes: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  { ext: ['.png'], bytes: [[0x89, 0x50, 0x4e, 0x47]] }, // \x89PNG
  { ext: ['.jpg', '.jpeg'], bytes: [[0xff, 0xd8, 0xff]] },
  // DOC (OLE2) y DOCX (ZIP)
  { ext: ['.doc'], bytes: [[0xd0, 0xcf, 0x11, 0xe0]] },
  { ext: ['.docx'], bytes: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]] },
];

function validarContenido(buffer: Buffer, filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  const firma = FIRMAS.find((f) => f.ext.includes(ext));
  if (!firma) return; // extension ya validada antes; sin firma conocida, se deja pasar

  const coincide = firma.bytes.some((patron) =>
    patron.every((byte, i) => buffer[i] === byte)
  );
  if (!coincide) {
    throw new FileValidationError(
      `El contenido del archivo no corresponde a un ${ext.slice(1).toUpperCase()} valido.`
    );
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
/**
 * Reduce un identificador a un nombre de archivo seguro.
 *
 * `tipo` y `entityId` llegan desde endpoints PUBLICOS (el portal del candidato
 * no pide login). Sin esto, un valor como `../../../../tmp/evil` se concatenaba
 * con path.join y permitia escribir archivos en cualquier ruta del servidor.
 * Se conservan solo caracteres inocuos; si no queda nada, se usa un fallback.
 */
function nombreSeguro(valor: string, fallback = 'archivo'): string {
  const limpio = valor
    .replace(/[^a-zA-Z0-9_-]/g, '_') // mata separadores de ruta, puntos y nulos
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return limpio || fallback;
}

export async function saveFile(
  file: File,
  entityId: string,
  tipo: string,
  orgId?: string,
  entity: string = 'documentos'
): Promise<{ url: string; key?: string; size: number }> {
  validateFile(file);

  const ext = path.extname(file.name).toLowerCase();
  const filename = `${nombreSeguro(tipo, 'documento')}${ext}`;
  entityId = nombreSeguro(entityId, 'sin-id');
  const buffer = Buffer.from(await file.arrayBuffer());

  // El contenido debe corresponder con la extension declarada.
  validarContenido(buffer, file.name);

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

  // Local fallback.
  //
  // La organizacion forma parte de la ruta. Antes se ignoraba por completo el
  // `orgId` y la ruta era `documentos/{entityId}/...`, asi que dos empresas que
  // usaran el mismo `entity_id` compartian carpeta: cualquier usuario podia
  // sobrescribir los documentos de otra organizacion, y los archivos quedaban
  // ademas bajo /public/, legibles sin sesion por URL directa.
  const orgSegmento = nombreSeguro(orgId || 'sin-org', 'sin-org');
  const dir = path.join(UPLOADS_DIR, orgSegmento, entityId);
  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  await writeFile(filePath, buffer);

  // La URL apunta al endpoint AUTENTICADO, no a un directorio estatico.
  // Antes era /uploads/..., servido por Next sin ninguna comprobacion: quien
  // conociera la ruta descargaba el CV o la cedula sin sesion.
  const url = `/api/archivos/documentos/${orgSegmento}/${entityId}/${filename}`;
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
    // Se aceptan las dos formas: la nueva (`/api/archivos/...`) y la antigua
    // (`/uploads/...`) que sigue en filas ya guardadas.
    const relativa = urlOrKey
      .replace(/^\/api\/archivos\//, '')
      .replace(/^\/uploads\//, '');

    for (const base of [path.join(process.cwd(), '.uploads'), path.join(process.cwd(), 'public', 'uploads')]) {
      try {
        // La url viene de la BD y puede haber sido influida por un endpoint
        // publico, asi que se confina el borrado al directorio de subidas: una
        // ruta con `..` no puede terminar borrando archivos de la aplicacion.
        const filePath = path.resolve(base, relativa);
        if (filePath !== base && !filePath.startsWith(base + path.sep)) {
          console.warn('[Storage] Se ignoro un borrado fuera de uploads:', urlOrKey);
          continue;
        }
        await unlink(filePath);
      } catch {
        // El archivo puede no existir en esa ubicacion; se prueba la siguiente.
      }
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
    const key = extractS3Key(urlOrKey);
    return getSignedDownloadUrl(key);
  }
  // Local or http URLs pass through
  return urlOrKey;
}
