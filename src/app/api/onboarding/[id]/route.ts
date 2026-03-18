import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getOnboarding, updateOnboarding } from '@/lib/services/onboarding.service';

// GET — Detalle de un onboarding
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;

    const onboarding = await getOnboarding(id, orgId);
    if (!onboarding) return apiError(new Error('Onboarding no encontrado'));

    return apiResponse(onboarding);
  } catch (error) {
    return apiError(error);
  }
}

// PATCH — Actualizar onboarding
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();

    await updateOnboarding(id, orgId, {
      fechaInicio: body.fecha_inicio,
      variablesCustom: body.variables_custom,
      notasOnboarding: body.notas_onboarding,
    });

    const updated = await getOnboarding(id, orgId);
    return apiResponse(updated);
  } catch (error) {
    return apiError(error);
  }
}
