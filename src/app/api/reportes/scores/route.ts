import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerDistribucionScores } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import type { FiltrosReporte } from '@/lib/types/reportes.types';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const filtros: FiltrosReporte = {
      vacanteId: searchParams.get('vacanteId') || undefined,
      desde: searchParams.get('desde') || undefined,
      hasta: searchParams.get('hasta') || undefined,
      periodo: (searchParams.get('periodo') as FiltrosReporte['periodo']) || undefined,
    };

    const data = await obtenerDistribucionScores(orgId, filtros);
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
