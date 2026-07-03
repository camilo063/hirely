import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerTopVacantes } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { cached, cacheKeys, METRICS_TTL } from '@/lib/cache';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const limite = parseInt(searchParams.get('limite') || '10');

    const data = await cached(
      cacheKeys.reportes(orgId, 'top-vacantes', String(limite)),
      () => obtenerTopVacantes(orgId, limite),
      METRICS_TTL
    );
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
