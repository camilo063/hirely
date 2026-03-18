import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getEntrevistaIAReport } from '@/lib/services/entrevista-ia.service';
import { getEntrevistaHumana } from '@/lib/services/entrevista-humana.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'ia';

    if (tipo === 'ia') {
      const entrevista = await getEntrevistaIAReport(id, orgId);
      return apiResponse(entrevista);
    } else {
      const entrevista = await getEntrevistaHumana(orgId, id);
      return apiResponse(entrevista);
    }
  } catch (error) {
    return apiError(error);
  }
}
