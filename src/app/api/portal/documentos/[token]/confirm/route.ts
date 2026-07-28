import { NextRequest, NextResponse } from 'next/server';
import { uploadDocumentoPortal, getPortalData } from '@/lib/services/seleccion.service';
import { resolveUrl, buildS3Key, S3_BUCKET } from '@/lib/integrations/s3';
import { pool } from '@/lib/db';

/**
 * POST /api/portal/documentos/[token]/confirm
 *
 * Step 2 of direct-to-S3 upload flow.
 * After the browser uploads directly to S3, this endpoint updates the DB.
 *
 * Body: { tipo: string, documento_id: string, filename: string, s3Url: string }
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
    const { tipo, documento_id, filename, s3Url } = body;

    if (!tipo || !filename || !s3Url) {
      return NextResponse.json(
        { success: false, error: 'tipo, filename y s3Url son requeridos' },
        { status: 400 }
      );
    }

    // El `s3Url` lo propone el cliente, asi que se reconstruye el prefijo que
    // /presign habria emitido para esta aplicacion y se exige que coincida.
    // Sin este chequeo se podia confirmar una key ajena
    // (`s3://bucket/<otra-org>/documentos/<otra-app>/cedula.pdf`) y la app
    // terminaba sirviendo firmado el documento de otra empresa, tanto en el
    // portal del candidato como en el panel del reclutador.
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

    const prefijoEsperado = `s3://${S3_BUCKET}/${buildS3Key(orgId, 'documentos', aplicacionId, '')}`;
    if (typeof s3Url !== 'string' || !s3Url.startsWith(prefijoEsperado) || s3Url.includes('..')) {
      console.warn('[Portal Confirm] s3Url fuera del alcance de la aplicacion:', s3Url);
      return NextResponse.json(
        { success: false, error: 'La referencia del archivo no es valida.' },
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
