import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getVersiones } from '@/lib/services/contratos.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const versiones = await getVersiones(orgId, id);
    return apiResponse(versiones);
  } catch (error) {
    return apiError(error);
  }
}
