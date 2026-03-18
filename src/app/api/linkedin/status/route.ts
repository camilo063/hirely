import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { getConnectionStatus } from '@/lib/services/linkedin.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    const status = await getConnectionStatus(orgId, userId);

    return apiResponse(status);
  } catch (error) {
    return apiError(error);
  }
}
