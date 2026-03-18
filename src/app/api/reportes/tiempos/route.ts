import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerTiemposPorEtapa } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const data = await obtenerTiemposPorEtapa(orgId);
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
