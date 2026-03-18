import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { guardarEvaluacionHumana } from '@/lib/services/scoring-dual.service';
import { evaluacionHumanaSchema } from '@/lib/validations/entrevista.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();

    body.evaluated_at = body.evaluated_at || new Date().toISOString();
    const validated = evaluacionHumanaSchema.parse(body);

    const result = await guardarEvaluacionHumana(
      id,
      { ...validated, evaluated_at: body.evaluated_at },
      orgId
    );

    return apiResponse(result);
  } catch (error) {
    return apiError(error);
  }
}
