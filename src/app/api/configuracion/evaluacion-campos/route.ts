import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { getCamposEvaluacion, crearCampo } from '@/lib/services/evaluacion-humana-campos.service';

export const maxDuration = 10;

// GET /api/configuracion/evaluacion-campos — lista los campos de evaluacion humana de la org
export async function GET() {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const campos = await getCamposEvaluacion(orgId);
    return apiResponse(campos);
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/configuracion/evaluacion-campos — crea un nuevo campo
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const body = await request.json().catch(() => ({}));

    const campo = await crearCampo(orgId, {
      campo_key: body.campo_key,
      label: body.label,
      descripcion: body.descripcion ?? null,
      orden: body.orden,
      min_valor: body.min_valor,
      max_valor: body.max_valor,
      activo: body.activo,
    });

    return apiResponse(campo, 201);
  } catch (error) {
    return apiError(error);
  }
}
