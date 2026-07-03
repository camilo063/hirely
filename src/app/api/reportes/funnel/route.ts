import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerFunnelConversion } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { cached, cacheKeys, METRICS_TTL } from '@/lib/cache';
import type { FiltrosReporte } from '@/lib/types/reportes.types';

/** Serializa los filtros que afectan el resultado, para la key de cache. */
function filtrosVariant(f: FiltrosReporte): string {
  return `${f.periodo || ''}|${f.vacanteId || ''}|${f.desde || ''}|${f.hasta || ''}`;
}

export const maxDuration = 10;

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

    const data = await cached(
      cacheKeys.reportes(orgId, 'funnel', filtrosVariant(filtros)),
      () => obtenerFunnelConversion(orgId, filtros),
      METRICS_TTL
    );
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
