import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getVacante, updateVacante, deleteVacante } from '@/lib/services/vacantes.service';
import { vacanteUpdateSchema } from '@/lib/validations/vacante.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const vacante = await getVacante(orgId, id);
    return apiResponse(vacante);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();
    const validated = vacanteUpdateSchema.parse(body);
    const vacante = await updateVacante(orgId, id, validated);
    return apiResponse(vacante);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    await deleteVacante(orgId, id);
    return apiResponse({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
