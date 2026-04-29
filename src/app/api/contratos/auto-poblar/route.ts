import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import { autoPoblarDatos } from '@/lib/services/contratos.service';
import { apiResponse, apiError } from '@/lib/utils/api-response';
import { ValidationError } from '@/lib/utils/errors';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);
    const aplicacionId = searchParams.get('aplicacion_id');
    const tipo = searchParams.get('tipo') || 'laboral';

    if (!aplicacionId) {
      throw new ValidationError('aplicacion_id es requerido');
    }

    const datos = await autoPoblarDatos(orgId, aplicacionId, tipo);
    return apiResponse(datos);
  } catch (error) {
    return apiError(error);
  }
}
