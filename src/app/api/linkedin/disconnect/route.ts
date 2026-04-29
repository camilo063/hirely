import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { disconnectLinkedIn } from '@/lib/services/linkedin.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 30;

export async function POST() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    await disconnectLinkedIn(orgId, userId);

    return apiResponse({ disconnected: true });
  } catch (error) {
    return apiError(error);
  }
}
