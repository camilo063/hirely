import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getEntrevistaIAReport } from '@/lib/services/entrevista-ia.service';
import { getEntrevistaHumana } from '@/lib/services/entrevista-humana.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

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
      // Sin fila (inexistente o de otra organizacion) la respuesta era 200 con
      // `data:null`, que el cliente no distingue de "existe pero vacia".
      if (!entrevista) return apiResponse({ error: 'Entrevista no encontrada' }, 404);
      return apiResponse(entrevista);
    } else {
      const entrevista = await getEntrevistaHumana(orgId, id);
      if (!entrevista) return apiResponse({ error: 'Entrevista no encontrada' }, 404);
      return apiResponse(entrevista);
    }
  } catch (error) {
    return apiError(error);
  }
}
