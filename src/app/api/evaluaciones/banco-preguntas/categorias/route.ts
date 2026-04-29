import { getOrgId } from '@/lib/auth/middleware';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { obtenerCategorias } from '@/lib/services/banco-preguntas.service';

export const maxDuration = 10;

export async function GET() {
  try {
    const orgId = await getOrgId();
    const categorias = await obtenerCategorias(orgId);
    return apiResponse(categorias);
  } catch (error) {
    return apiError(error);
  }
}
