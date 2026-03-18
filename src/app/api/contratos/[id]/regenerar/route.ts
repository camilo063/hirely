import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { regenerarHtml } from '@/lib/services/contratos.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const { id } = await params;
    const contrato = await regenerarHtml(orgId, id, userId);
    return apiResponse(contrato);
  } catch (error) {
    return apiError(error);
  }
}
