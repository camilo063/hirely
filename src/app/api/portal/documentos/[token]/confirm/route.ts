import { NextRequest, NextResponse } from 'next/server';
import { uploadDocumentoPortal, getPortalData } from '@/lib/services/seleccion.service';
import { resolveUrl } from '@/lib/integrations/s3';

/**
 * POST /api/portal/documentos/[token]/confirm
 *
 * Step 2 of direct-to-S3 upload flow.
 * After the browser uploads directly to S3, this endpoint updates the DB.
 *
 * Body: { tipo: string, documento_id: string, filename: string, s3Url: string }
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
    const { tipo, documento_id, filename, s3Url } = body;

    if (!tipo || !filename || !s3Url) {
      return NextResponse.json(
        { success: false, error: 'tipo, filename y s3Url son requeridos' },
        { status: 400 }
      );
    }

    // Update DB with the S3 URL
    await uploadDocumentoPortal(
      token,
      documento_id || '',
      tipo,
      filename,
      s3Url
    );

    // Return updated progress with resolved URLs
    const updatedData = await getPortalData(token);

    let documentos = null;
    if (updatedData && 'documentos' in updatedData && Array.isArray(updatedData.documentos)) {
      documentos = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedData.documentos.map(async (doc: any) => ({
          ...doc,
          url: doc.url ? await resolveUrl(doc.url as string) : doc.url,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        documento_id,
        progreso: updatedData && 'progreso' in updatedData ? updatedData.progreso : null,
        documentos,
      },
    });
  } catch (error) {
    console.error('[Portal Confirm] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error confirmando subida' },
      { status: 500 }
    );
  }
}
