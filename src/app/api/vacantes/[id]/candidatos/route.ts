import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { getAplicacionesByVacante, createAplicacion } from '@/lib/services/candidatos.service';
import { aplicacionCreateSchema } from '@/lib/validations/candidato.schema';
import { apiResponse, apiError } from '@/lib/utils/api-response';

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const aplicaciones = await getAplicacionesByVacante(orgId, id);
    return apiResponse(aplicaciones);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { id } = await params;
    const body = await request.json();
    const validated = aplicacionCreateSchema.parse({ ...body, vacante_id: id });
    const aplicacion = await createAplicacion(orgId, validated);
    return apiResponse(aplicacion, 201);
  } catch (error) {
    return apiError(error);
  }
}
