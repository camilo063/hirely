import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getOnboardingConfig, updateOnboardingConfig } from '@/lib/services/onboarding.service';

// GET — Config de onboarding de la org
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();

    const config = await getOnboardingConfig(orgId);
    return apiResponse(config);
  } catch (error) {
    return apiError(error);
  }
}

// PUT — Actualizar config de onboarding
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json();

    await updateOnboardingConfig(orgId, {
      plantilla_bienvenida: body.plantilla_bienvenida,
      asunto_bienvenida: body.asunto_bienvenida,
      email_remitente: body.email_remitente,
      nombre_remitente: body.nombre_remitente,
    });

    const config = await getOnboardingConfig(orgId);
    return apiResponse(config);
  } catch (error) {
    return apiError(error);
  }
}
