import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { assertAplicacionDeOrg } from '@/lib/auth/authorization';
import { obtenerTimelineAplicacion } from '@/lib/services/timeline.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    await assertAplicacionDeOrg(id, orgId);
    const eventos = await obtenerTimelineAplicacion(id, orgId);
    return apiResponse(eventos);
  } catch (error) {
    return apiError(error);
  }
}
