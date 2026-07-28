import { NextRequest, NextResponse } from 'next/server';
import { getPortalData } from '@/lib/services/seleccion.service';
import { pool } from '@/lib/db';
import { isS3Configured, getPresignedUploadUrl, buildS3Key, S3_BUCKET } from '@/lib/integrations/s3';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/portal/documentos/[token]/presign
 *
 * Step 1 of direct-to-S3 upload flow (bypasses Vercel 4.5MB body limit).
 * Returns a presigned PUT URL for the browser to upload directly to S3.
 *
 * Body: { tipo: string, documento_id: string, filename: string, contentType: string, fileSize: number }
 * Returns: { uploadUrl: string, key: string, s3Url: string } or falls back to { useFormData: true }
 */
export const maxDuration = 15;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token
    const portalData = await getPortalData(token);
    if (!portalData || !('token_valid' in portalData) || !portalData.token_valid) {
      return NextResponse.json(
        { success: false, error: 'Token invalido o expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tipo, documento_id, filename, contentType, fileSize } = body;

    if (!tipo || !filename || !contentType) {
      return NextResponse.json(
        { success: false, error: 'tipo, filename y contentType son requeridos' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no permitido. Use PDF, JPG, PNG o DOC.' },
        { status: 400 }
      );
    }

    // Validate file size.
    // `fileSize` lo declara el cliente, asi que se exige: omitirlo era la forma
    // de saltarse el limite y obtener una URL presignada sin tope de tamaño,
    // con la que se podia subir un archivo de cualquier peso al bucket desde un
    // endpoint publico.
    const tamano = Number(fileSize);
    if (!Number.isFinite(tamano) || tamano <= 0) {
      return NextResponse.json(
        { success: false, error: 'No pudimos determinar el tamaño del archivo. Intenta de nuevo.' },
        { status: 400 }
      );
    }
    if (tamano > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // La extension tambien se valida (el MIME lo declara el cliente y puede
    // mentir; el nombre termina siendo la key en el bucket).
    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { success: false, error: 'Formato no permitido. Use PDF, JPG, PNG o Word.' },
        { status: 400 }
      );
    }

    // If S3 is not configured, tell the client to use the old FormData upload
    if (!isS3Configured) {
      return NextResponse.json({
        success: true,
        useFormData: true,
      });
    }

    // Get orgId for multi-tenant S3 key
    const aplicacionId = portalData.aplicacion_id as string;
    const orgResult = await pool.query(
      `SELECT v.organization_id FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id WHERE a.id = $1`,
      [aplicacionId]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organizacion no encontrada' },
        { status: 500 }
      );
    }

    // Build S3 key and generate presigned upload URL.
    // El nombre se ancla al documento (id si viene, si no el tipo) y no al
    // nombre original del archivo: asi resubir un documento sobrescribe la
    // version anterior en vez de acumular copias en el bucket.
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    // Igual que en la subida directa: la clave sale del `tipo`, no del
    // `documento_id` del cliente, para que dos requisitos no colisionen en el
    // mismo objeto del bucket.
    const safeFilename = `${tipo}${ext}`;
    const key = buildS3Key(orgId, 'documentos', aplicacionId, safeFilename);
    // El tamaño se firma en la URL: S3 rechaza el PUT si no coincide, asi que el
    // limite de 10 MB deja de depender de la buena fe del cliente.
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 900, tamano); // 15 min expiry

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      s3Url: `s3://${S3_BUCKET}/${key}`,
      documento_id,
    });
  } catch (error) {
    console.error('[Portal Presign] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generando URL de subida' },
      { status: 500 }
    );
  }
}
