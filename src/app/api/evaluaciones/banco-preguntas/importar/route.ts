import { NextRequest } from 'next/server';
import { getOrgId, getUserId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { importarPreguntas } from '@/lib/services/banco-preguntas.service';
import { importarPreguntasSchema } from '@/lib/validations/evaluacion.schema';
import { requireEscritura } from '@/lib/auth/authorization';

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    // Escritura: un rol de solo lectura no debe mutar datos.
    await requireEscritura();
    const orgId = await getOrgId();
    const userId = await getUserId();
    const body = await request.json();
    const validated = importarPreguntasSchema.parse(body);

    const result = await importarPreguntas(orgId, validated.preguntas as any[], userId);
    return apiResponse(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
