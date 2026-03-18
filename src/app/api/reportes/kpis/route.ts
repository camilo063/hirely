import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { obtenerKPIsGenerales } from '@/lib/services/reportes.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const data = await obtenerKPIsGenerales(orgId);
    return apiResponse(data);
  } catch (error) {
    return apiError(error);
  }
}
