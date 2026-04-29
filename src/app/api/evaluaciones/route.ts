import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { listarEvaluaciones, crearEvaluacion } from '@/lib/services/evaluacion-tecnica.service';
import { evaluacionCreateSchema } from '@/lib/validations/evaluacion.schema';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const evaluaciones = await listarEvaluaciones(orgId, {
      vacante_id: searchParams.get('vacante_id') || undefined,
      estado: searchParams.get('estado') || undefined,
    });

    return apiResponse(evaluaciones);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const validated = evaluacionCreateSchema.parse(body);

    const evaluacion = await crearEvaluacion({
      organization_id: orgId,
      aplicacion_id: validated.aplicacion_id,
      candidato_id: validated.candidato_id,
      vacante_id: validated.vacante_id,
      plantilla_id: validated.plantilla_id,
      titulo: validated.titulo,
      duracion_minutos: validated.duracion_minutos,
      puntaje_aprobatorio: validated.puntaje_aprobatorio,
      estructura: validated.estructura,
      asignado_por: userId,
    });

    return apiResponse(evaluacion, 201);
  } catch (error) {
    return apiError(error);
  }
}
