import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { removeDocumentoOnboarding } from '@/lib/services/onboarding.service';

// DELETE — Eliminar documento de onboarding
export const maxDuration = 10;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    await removeDocumentoOnboarding(id, orgId);

    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
