import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { sincronizarEstadoFirma, descargarDocumentoFirmado } from '@/lib/services/firma-electronica.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { resolveUrl } from '@/lib/integrations/s3';

// GET /api/contratos/[id]/firma — consultar estado de firma
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'descargar') {
      const result = await descargarDocumentoFirmado(id, orgId);
      if (!result.success) {
        return apiResponse({ success: false, error: result.error }, 400);
      }
      // Resolve s3:// URL to presigned download URL
      const url = result.url ? await resolveUrl(result.url) : result.url;
      return apiResponse({ success: true, url });
    }

    const estado = await sincronizarEstadoFirma(id, orgId);
    return apiResponse(estado);
  } catch (error) {
    return apiError(error);
  }
}
