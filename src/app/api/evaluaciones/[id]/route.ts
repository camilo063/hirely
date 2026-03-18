import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { obtenerEvaluacion, cancelarEvaluacion } from '@/lib/services/evaluacion-tecnica.service';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const evaluacion = await obtenerEvaluacion(params.id, orgId);
    return apiResponse(evaluacion);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    await cancelarEvaluacion(params.id, orgId);
    return apiResponse({ message: 'Evaluación cancelada' });
  } catch (error) {
    return apiError(error);
  }
}
