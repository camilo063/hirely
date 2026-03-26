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

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
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

    // Build S3 key and generate presigned upload URL
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const safeFilename = `${tipo}${ext}`;
    const key = buildS3Key(orgId, 'documentos', aplicacionId, safeFilename);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 900); // 15 min expiry

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
