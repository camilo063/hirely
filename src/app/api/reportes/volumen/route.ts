import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerVolumenSemanal } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { cached, cacheKeys, METRICS_TTL } from '@/lib/cache';
import type { FiltrosReporte } from '@/lib/types/reportes.types';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const filtros: FiltrosReporte = {
      periodo: (searchParams.get('periodo') as FiltrosReporte['periodo']) || '90d',
    };

    const data = await cached(
      cacheKeys.reportes(orgId, 'volumen', filtros.periodo || ''),
      () => obtenerVolumenSemanal(orgId, filtros),
      METRICS_TTL
    );
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
