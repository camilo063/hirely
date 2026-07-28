import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getOnboardingConfig, updateOnboardingConfig } from '@/lib/services/onboarding.service';
import { requireAdmin } from '@/lib/auth/authorization';
import { sanitizarHtml } from '@/lib/utils/sanitize-html';

// GET — Config de onboarding de la org
export const maxDuration = 10;

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
    // Solo administradores: esta ruta cambia configuracion de toda la empresa.
    await requireAdmin();
    const orgId = await getOrgId();
    const body = await request.json();

    await updateOnboardingConfig(orgId, {
      // HTML editable que se envia al candidato: se sanea al guardar.
      plantilla_bienvenida: sanitizarHtml(body.plantilla_bienvenida),
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
