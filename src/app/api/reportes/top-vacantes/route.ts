import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerTopVacantes } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const limite = parseInt(searchParams.get('limite') || '10');

    const data = await obtenerTopVacantes(orgId, limite);
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
