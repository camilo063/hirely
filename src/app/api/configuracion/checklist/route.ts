import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getOrgChecklist, updateOrgChecklist } from '@/lib/services/seleccion.service';

// GET /api/configuracion/checklist — Get org document checklist
export const maxDuration = 10;

export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const checklist = await getOrgChecklist(orgId);
    return apiResponse(checklist);
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/configuracion/checklist — Update org document checklist
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    if (!Array.isArray(body.checklist)) {
      return apiError(new Error('checklist debe ser un array'));
    }

    await updateOrgChecklist(orgId, body.checklist);
    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
