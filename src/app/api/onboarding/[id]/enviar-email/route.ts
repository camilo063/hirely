import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { enviarEmailBienvenida } from '@/lib/services/onboarding.service';
import { requireEscritura } from '@/lib/auth/authorization';

// POST — Enviar (o re-enviar) email de bienvenida
export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    // Escritura del pipeline: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const { id } = await params;

    const sent = await enviarEmailBienvenida(id, orgId);

    return apiResponse({ sent, message: sent ? 'Email enviado correctamente' : 'Error al enviar email' });
  } catch (error) {
    return apiError(error);
  }
}
