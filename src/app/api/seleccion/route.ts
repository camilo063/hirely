import { NextRequest } from 'next/server';
import { requireAuth, getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { seleccionarCandidato, rechazarCandidatos } from '@/lib/services/seleccion.service';

// POST /api/seleccion — Seleccionar candidato
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();

    if (!body.aplicacion_id) {
      return apiError(new Error('aplicacion_id es requerido'));
    }

    const result = await seleccionarCandidato(body, orgId, userId);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/seleccion — Rechazar candidato(s)
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();

    if (!body.aplicacion_ids || !Array.isArray(body.aplicacion_ids) || body.aplicacion_ids.length === 0) {
      return apiError(new Error('aplicacion_ids es requerido'));
    }

    const result = await rechazarCandidatos(body, orgId, userId);
    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}
