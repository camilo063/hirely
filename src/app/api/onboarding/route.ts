import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { iniciarOnboarding, listOnboardings } from '@/lib/services/onboarding.service';

// POST — Iniciar onboarding (contratar candidato)
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();

    if (!body.aplicacion_id || !body.fecha_inicio) {
      return apiError(new Error('aplicacion_id y fecha_inicio son requeridos'));
    }

    const onboarding = await iniciarOnboarding({
      aplicacionId: body.aplicacion_id,
      fechaInicio: body.fecha_inicio,
      variablesCustom: body.variables_custom,
      notasOnboarding: body.notas,
      enviarEmailAhora: body.enviar_email_ahora ?? false,
      liderId: body.lider_id,
      orgId,
      userId,
    });

    return apiResponse(onboarding, 201);
  } catch (error) {
    return apiError(error);
  }
}

// GET — Listar onboardings
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const onboardings = await listOnboardings(orgId, {
      estado: searchParams.get('estado') || undefined,
      vacanteId: searchParams.get('vacante_id') || undefined,
    });

    return apiResponse(onboardings);
  } catch (error) {
    return apiError(error);
  }
}
