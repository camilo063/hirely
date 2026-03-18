import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { enviarParaFirma } from '@/lib/services/firma-electronica.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const result = await enviarParaFirma(orgId, id);

    if (!result.success) {
      return apiResponse({ success: false, error: result.error }, 400);
    }

    return apiResponse({ message: 'Contrato enviado para firma', signingUrl: result.signingUrl });
  } catch (error) {
    return apiError(error);
  }
}
