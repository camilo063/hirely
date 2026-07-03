import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerKPIsGenerales } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { cached, cacheKeys, METRICS_TTL } from '@/lib/cache';

export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const data = await cached(
      cacheKeys.reportes(orgId, 'kpis'),
      () => obtenerKPIsGenerales(orgId),
      METRICS_TTL
    );
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
