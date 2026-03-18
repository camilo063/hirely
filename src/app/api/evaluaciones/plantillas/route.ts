import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { listarPlantillas, crearPlantilla } from '@/lib/services/evaluacion-tecnica.service';
import { plantillaCreateSchema } from '@/lib/validations/evaluacion.schema';

export async function GET() {
  try {
    const orgId = await getOrgId();
    const plantillas = await listarPlantillas(orgId);
    return apiResponse(plantillas);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const validated = plantillaCreateSchema.parse(body);

    const plantilla = await crearPlantilla(orgId, validated, userId);
    return apiResponse(plantilla, 201);
  } catch (error) {
    return apiError(error);
  }
}
