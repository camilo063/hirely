import { NextRequest } from 'next/server';
import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { enviarEvaluacion } from '@/lib/services/evaluacion-tecnica.service';

export const maxDuration = 30;

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId();
    const result = await enviarEvaluacion(params.id, orgId);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}
