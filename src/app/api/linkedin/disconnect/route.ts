import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { disconnectLinkedIn } from '@/lib/services/linkedin.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { requireEscritura } from '@/lib/auth/authorization';

export const maxDuration = 30;

export async function POST() {
  try {
        // Escritura: un rol de solo lectura no debe ejecutarla.
    await requireEscritura();
await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();

    await disconnectLinkedIn(orgId, userId);

    return apiResponse({ disconnected: true });
  } catch (error) {
    return apiError(error);
  }
}
