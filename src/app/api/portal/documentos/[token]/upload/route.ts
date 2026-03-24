import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { saveFile, FileValidationError } from '@/lib/utils/file-storage';
import { uploadDocumentoPortal, getPortalData } from '@/lib/services/seleccion.service';
import { pool } from '@/lib/db';

// POST /api/portal/documentos/[token]/upload — Public file upload (no auth required)
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tipo = formData.get('tipo') as string | null;
    const documentoId = formData.get('documento_id') as string | null;

    if (!file || !tipo) {
      return NextResponse.json(
        { success: false, error: 'file y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Get orgId for multi-tenant S3 isolation
    const aplicacionId = portalData.aplicacion_id as string;
    const orgResult = await pool.query(
      `SELECT v.organization_id FROM aplicaciones a JOIN vacantes v ON v.id = a.vacante_id WHERE a.id = $1`,
      [aplicacionId]
    );
    const orgId = orgResult.rows[0]?.organization_id;

    // Save file to storage
    const { url } = await saveFile(file, aplicacionId, tipo, orgId, 'documentos');

    // Update DB
    await uploadDocumentoPortal(
      token,
      documentoId || '',
      tipo,
      file.name,
      url
    );

    // Return updated progress
    const updatedData = await getPortalData(token);

    return NextResponse.json({
      success: true,
      data: {
        documento_id: documentoId,
        url,
        progreso: updatedData && 'progreso' in updatedData ? updatedData.progreso : null,
      },
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error('[Portal Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error subiendo archivo' },
      { status: 500 }
    );
  }
}
